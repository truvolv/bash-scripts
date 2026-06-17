import { select } from '@inquirer/prompts'
import {
  fetchDocument,
  findByTitle,
  findBySlug,
  createDocument,
  uploadMedia,
} from './api.js'
import {
  COLLECTION_RELATIONSHIPS,
  BLOCK_RELATIONSHIPS,
  SKIP_COLLECTIONS,
  SYSTEM_FIELDS,
} from './relationshipMap.js'
import { remapIds } from './remapIds.js'

const LAYOUT_FIELDS = {
  pages: 'layout',
  page_templates: 'layout',
  reusable_blocks: 'base_block', // single block object, not an array
}

/**
 * context shape:
 * {
 *   sourceEnv,    // envConfig for source
 *   destEnv,      // envConfig for destination
 *   suffix,       // e.g. "(Prod clone)"
 *   idMap,        // Map<sourceId, destId>
 *   visited,      // Set<sourceId> — prevents infinite loops
 * }
 */

/**
 * Recursively clone a document (and all its relationship dependencies)
 * from source to destination. Returns the new destination ID, or null if skipped.
 */
export async function cloneDocument(collection, sourceId, context) {
  const { sourceEnv, destEnv, suffix, idMap, visited } = context

  if (!sourceId) return null
  const id = extractId(sourceId)
  if (!id) return null

  // Already processed — return the mapped destination ID
  if (idMap.has(id)) return idMap.get(id)

  // Circular reference guard
  if (visited.has(id)) {
    console.log(`  ⚠ Skipping circular reference: ${collection}/${id}`)
    return null
  }
  visited.add(id)

  if (SKIP_COLLECTIONS.has(collection)) {
    console.log(`  ↷ Skipping ${collection}/${id} (excluded collection)`)
    return null
  }

  // --- Fetch source document ---
  console.log(`\n  Fetching ${collection}/${id} from ${sourceEnv.label}...`)
  let doc
  try {
    doc = await fetchDocument(sourceEnv, collection, id)
  } catch (err) {
    console.error(`  ✗ Could not fetch ${collection}/${id}: ${err.message}`)
    return null
  }

  // --- Media: special handling (requires file upload) ---
  if (collection === 'media') {
    return cloneMedia(doc, context)
  }

  // --- Resolve all nested relationships (populates idMap) ---
  await processDocumentRelationships(collection, doc, context)

  // --- Build cleaned document ---
  const cleanedDoc = stripSystemFields(doc)
  const titleField = getTitleField(cleanedDoc)
  if (titleField) {
    cleanedDoc[titleField] = `${cleanedDoc[titleField]} ${suffix}`
  }

  const remappedDoc = remapIds(cleanedDoc, idMap)

  // --- Duplicate check in destination ---
  const existingTitle = titleField ? remappedDoc[titleField] : null
  if (existingTitle) {
    const existing = await findByTitle(destEnv, collection, existingTitle).catch(() => null)
    if (existing) {
      const choice = await select({
        message: `A ${collection} named "${existingTitle}" already exists in ${destEnv.label}. What do you want to do?`,
        choices: [
          { name: 'Reuse existing', value: 'reuse' },
          { name: 'Create duplicate', value: 'duplicate' },
          { name: 'Skip (drop this relationship)', value: 'skip' },
        ],
      })
      if (choice === 'reuse') {
        console.log(`  ✓ Reusing existing ${collection}: ${existing.id}`)
        idMap.set(id, existing.id)
        return existing.id
      }
      if (choice === 'skip') {
        console.log(`  ↷ Skipped ${collection}/${id}`)
        return null
      }
    }
  }

  // --- Create document in destination ---
  const label = existingTitle ?? id
  console.log(`  Creating ${collection} "${label}" in ${destEnv.label}...`)
  let created
  try {
    created = await createDocument(destEnv, collection, remappedDoc)
  } catch (err) {
    console.error(`  ✗ Failed to create ${collection} "${label}": ${err.message}`)
    return null
  }

  if (!created?.id) {
    console.error(`  ✗ Created ${collection} but received no ID`)
    return null
  }

  console.log(`  ✓ Created ${collection} "${label}" → ${created.id}`)
  idMap.set(id, created.id)
  return created.id
}

/**
 * Process all relationship fields on a document (collection-level + layout blocks).
 * Populates context.idMap without creating the document itself.
 * Exported so index.js can call this for the page before creating it separately.
 */
export async function processDocumentRelationships(collection, doc, context) {
  await processCollectionRelationships(collection, doc, context)

  if (LAYOUT_FIELDS[collection]) {
    await processLayout(collection, doc, context)
  }
}

// --- Internal helpers ---

async function cloneMedia(doc, context) {
  const { destEnv, idMap, suffix } = context
  const id = doc.id

  const suffixedAlt = `${doc.alt || doc.filename || 'media'} ${suffix}`
  const existing = await findByTitle(destEnv, 'media', suffixedAlt).catch(() => null)

  if (existing) {
    const choice = await select({
      message: `Media "${suffixedAlt}" already exists in ${destEnv.label}. What do you want to do?`,
      choices: [
        { name: 'Reuse existing', value: 'reuse' },
        { name: 'Upload duplicate', value: 'duplicate' },
        { name: 'Skip (drop this reference)', value: 'skip' },
      ],
    })
    if (choice === 'reuse') { idMap.set(id, existing.id); return existing.id }
    if (choice === 'skip') return null
  }

  let created
  try {
    created = await uploadMedia(destEnv, { ...doc, alt: suffixedAlt })
  } catch (err) {
    console.error(`  ✗ Failed to upload media "${doc.filename}": ${err.message}`)
    return null
  }

  if (!created?.id) return null
  console.log(`  ✓ Uploaded media "${doc.filename}" → ${created.id}`)
  idMap.set(id, created.id)
  return created.id
}

async function processCollectionRelationships(collection, doc, context) {
  const { sourceEnv, destEnv, idMap } = context
  const rels = COLLECTION_RELATIONSHIPS[collection] ?? []

  for (const rel of rels) {
    // Array-of-items pattern (e.g. gallery_images[].image)
    if (rel.arrayField) {
      const items = doc[rel.arrayField]
      if (!Array.isArray(items)) continue
      for (const item of items) {
        for (const fieldRel of rel.fields) {
          await resolveFieldRel(item, fieldRel, context)
        }
      }
      continue
    }

    const rawValue = doc[rel.field]
    if (!rawValue) continue
    if (rel.treatment === 'skip') continue

    if (rel.treatment === 'match_slug') {
      const ids = toArray(rawValue, rel.hasMany)
      for (const rawId of ids) {
        const relId = extractId(rawId)
        if (!relId || idMap.has(relId)) continue

        let sourceDoc
        try { sourceDoc = await fetchDocument(sourceEnv, rel.collection, relId) } catch { continue }

        const slug = sourceDoc?.slug
        if (!slug) continue

        const destDoc = await findBySlug(destEnv, rel.collection, slug).catch(() => null)
        if (destDoc) {
          idMap.set(relId, destDoc.id)
          console.log(`  ✓ Matched ${rel.collection} by slug "${slug}" → ${destDoc.id}`)
        } else {
          console.warn(`  ⚠ No ${rel.collection} with slug "${slug}" in ${destEnv.label}. Relationship will be dropped.`)
        }
      }
      continue
    }

    const ids = toArray(rawValue, rel.hasMany)
    for (const rawId of ids) {
      const relId = extractId(rawId)
      if (relId) await cloneDocument(rel.collection, relId, context)
    }
  }
}

async function processLayout(collection, doc, context) {
  const layoutField = LAYOUT_FIELDS[collection]
  const layout = doc[layoutField]
  if (!layout) return

  const blocks = Array.isArray(layout) ? layout : [layout]
  for (const block of blocks) {
    if (block?.blockType) await processBlockRelationships(block, context)
  }
}

async function processBlockRelationships(block, context) {
  const blockRels = BLOCK_RELATIONSHIPS[block.blockType] ?? []

  for (const rel of blockRels) {
    if (rel.treatment === 'skip') continue

    if (rel.arrayField) {
      const items = block[rel.arrayField]
      if (!Array.isArray(items)) continue
      for (const item of items) {
        for (const fieldRel of rel.fields) {
          if (fieldRel.arrayField) {
            // One level of nested arrays (e.g. services[].subServices[])
            const subItems = item[fieldRel.arrayField]
            if (Array.isArray(subItems)) {
              for (const subItem of subItems) {
                for (const subRel of fieldRel.fields) {
                  await resolveFieldRel(subItem, subRel, context)
                }
              }
            }
          } else {
            await resolveFieldRel(item, fieldRel, context)
          }
        }
      }
      continue
    }

    await resolveFieldRel(block, rel, context)
  }
}

async function resolveFieldRel(obj, rel, context) {
  if (rel.treatment === 'skip') return
  const value = getNestedValue(obj, rel.field)
  if (!value) return
  const ids = toArray(value, rel.hasMany)
  for (const rawId of ids) {
    const relId = extractId(rawId)
    if (relId) await cloneDocument(rel.collection, relId, context)
  }
}

function extractId(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value.id) return value.id
  return null
}

function toArray(value, hasMany) {
  if (hasMany) return Array.isArray(value) ? value : [value]
  return [value]
}

function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((cur, key) => cur?.[key], obj)
}

export function stripSystemFields(doc) {
  const result = { ...doc }
  for (const field of SYSTEM_FIELDS) delete result[field]
  return result
}

function getTitleField(doc) {
  if (typeof doc.title === 'string') return 'title'
  if (typeof doc.name === 'string') return 'name'
  return null
}
