import { select } from '@inquirer/prompts'
import {
  fetchDocument,
  findByTitle,
  createDocument,
  uploadMedia,
} from './api.js'
import {
  COLLECTION_FINGERPRINTS,
  COLLECTION_RELATIONSHIPS,
  SKIP_COLLECTIONS,
  SYSTEM_FIELDS,
} from './relationshipMap.js'
import { remapIds } from './remapIds.js'

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

  if (idMap.has(id)) return idMap.get(id)

  if (visited.has(id)) {
    console.log(`  ⚠ Skipping circular reference: ${collection}/${id}`)
    return null
  }
  visited.add(id)

  if (SKIP_COLLECTIONS.has(collection)) {
    console.log(`  ↷ Skipping ${collection}/${id} (excluded collection)`)
    return null
  }

  console.log(`\n  Fetching ${collection}/${id} from ${sourceEnv.label}...`)
  let doc
  try {
    doc = await fetchDocument(sourceEnv, collection, id)
  } catch (err) {
    console.error(`  ✗ Could not fetch ${collection}/${id}: ${err.message}`)
    return null
  }

  if (collection === 'media') {
    return cloneMedia(doc, context)
  }

  // Resolve all nested relationships by walking the full document.
  // fetchDocument uses depth=1 so all immediate relationship fields are
  // expanded to full objects — the generic walker handles them automatically.
  await processDocumentRelationships(collection, doc, context)

  const cleanedDoc = stripSystemFields(doc)
  const titleField = getTitleField(cleanedDoc)
  if (titleField) {
    cleanedDoc[titleField] = `${cleanedDoc[titleField]} ${suffix}`
  }

  const remappedDoc = remapIds(cleanedDoc, idMap)

  // Duplicate check
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
 * Walk all fields of a document, cloning any embedded relationship objects
 * discovered via fingerprinting. Also handles explicit special cases
 * (categories/tags) that cannot be auto-detected.
 *
 * Exported so index.js can call it for the source page before creating it.
 */
export async function processDocumentRelationships(collection, doc, context) {
  // 1. Explicit handling for fields that can't be fingerprinted (categories/tags).
  await processExplicitRelationships(collection, doc, context)

  // 2. Generic walk — finds any expanded Payload document anywhere in the tree.
  for (const value of Object.values(doc)) {
    await walkAndClone(value, context)
  }
}

// --- Generic walker ---

/**
 * Recursively walk `data`. Any object that looks like an expanded Payload
 * document ({id, createdAt, updatedAt}) is fingerprinted and cloned.
 */
async function walkAndClone(data, context) {
  if (!data || typeof data !== 'object') return

  if (Array.isArray(data)) {
    for (const item of data) await walkAndClone(item, context)
    return
  }

  if (isPayloadDoc(data)) {
    const collection = detectCollection(data)
    if (collection && !SKIP_COLLECTIONS.has(collection)) {
      await cloneDocument(collection, data.id, context)
    }
    // Unknown or skipped — leave as source ID; remapIds will collapse the
    // expanded object to the source ID string (may be a broken link in dest).
    return
  }

  // Embedded object (block, group field, richtext node, etc.) — walk into it.
  for (const value of Object.values(data)) {
    await walkAndClone(value, context)
  }
}

function isPayloadDoc(obj) {
  return (
    typeof obj.id === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  )
}

function detectCollection(obj) {
  for (const fp of COLLECTION_FINGERPRINTS) {
    const hasRequired = fp.requiredFields.every((f) => f in obj)
    const hasForbidden = fp.forbiddenFields?.some((f) => f in obj) ?? false
    if (hasRequired && !hasForbidden) return fp.collection
  }
  return null
}

// --- Explicit handling for categories / tags ---

async function processExplicitRelationships(collection, doc, context) {
  const { destEnv, idMap } = context
  const rels = COLLECTION_RELATIONSHIPS[collection] ?? []

  for (const rel of rels) {
    const rawValue = doc[rel.field]
    if (!rawValue) continue

    if (rel.treatment === 'match_title') {
      const values = rel.hasMany
        ? (Array.isArray(rawValue) ? rawValue : [rawValue])
        : [rawValue]

      for (const rawVal of values) {
        const relId = extractId(rawVal)
        if (!relId || idMap.has(relId)) continue

        // At depth=1 rawVal is the expanded object — read title directly.
        const title = typeof rawVal === 'object' ? rawVal.title : null
        if (!title) continue

        const destDoc = await findByTitle(destEnv, rel.collection, title).catch(() => null)
        if (destDoc) {
          idMap.set(relId, destDoc.id)
          console.log(`  ✓ Matched ${rel.collection} by title "${title}" → ${destDoc.id}`)
        } else {
          console.warn(`  ⚠ No ${rel.collection} titled "${title}" in ${destEnv.label}. Relationship will be dropped.`)
        }
      }
    }
  }
}

// --- Media ---

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

// --- Utilities ---

function extractId(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value.id) return value.id
  return null
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
