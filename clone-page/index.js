import { input, select } from '@inquirer/prompts'
import * as dotenv from 'dotenv'
import path from 'path'
import { getEnvConfig, ENV_CHOICES } from './helpers/envConfig.js'
import { fetchDocument, findByTitle, createDocument } from './helpers/api.js'
import { processDocumentRelationships, stripSystemFields } from './helpers/cloneDocument.js'
import { SYSTEM_FIELDS } from './helpers/relationshipMap.js'
import { remapIds } from './helpers/remapIds.js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  // --- Prompts ---
  const sourceEnvKey = await select({
    message: 'Source environment (copy FROM):',
    choices: ENV_CHOICES.map((e) => ({ name: e, value: e })),
  })

  const destEnvKey = await select({
    message: 'Destination environment (copy TO):',
    choices: ENV_CHOICES.filter((e) => e !== sourceEnvKey).map((e) => ({ name: e, value: e })),
  })

  const orgSlug = await input({ message: 'Organization slug (the org in both source and destination — e.g. "acme-corp"):' })
  if (!orgSlug) { console.error('Organization slug is required.'); process.exit(1) }

  const destSiteId = await input({ message: `Destination site ID (in ${destEnvKey}):` })
  if (!destSiteId) { console.error('Destination site ID is required.'); process.exit(1) }

  const pageId = await input({ message: 'Page ID to clone:' })
  if (!pageId) { console.error('Page ID is required.'); process.exit(1) }

  const sourceEnv = getEnvConfig(sourceEnvKey, orgSlug)
  const destEnv = getEnvConfig(destEnvKey, orgSlug)
  const suffix = `(${sourceEnv.label} clone)`

  console.log(`\nCloning page ${pageId} from ${sourceEnv.label} → ${destEnv.label}`)
  console.log(`Cloned documents will be suffixed with "${suffix}"\n`)

  // --- Fetch source page ---
  console.log(`Fetching page ${pageId} from ${sourceEnv.label}...`)
  let sourcePage
  try {
    sourcePage = await fetchDocument(sourceEnv, 'pages', pageId)
  } catch (err) {
    console.error(`Failed to fetch page: ${err.message}`)
    process.exit(1)
  }

  console.log(`Found page: "${sourcePage.title}"\n`)

  // --- Shared clone context ---
  const context = {
    sourceEnv,
    destEnv,
    suffix,
    idMap: new Map(), // sourceId → destId
    visited: new Set([pageId]), // mark page as visited to prevent circular loops
    destSiteId,
  }

  // --- Recursively resolve and clone all relationships ---
  // This populates context.idMap before we create the page itself.
  console.log('Resolving relationships...')
  await processDocumentRelationships('pages', sourcePage, context)

  // --- Build final page document ---
  const cleanedPage = stripSystemFields(sourcePage)
  // Preserve slug and pathname from source; override sites with the destination site.
  cleanedPage.sites = [destSiteId]
  cleanedPage.title = `${cleanedPage.title} ${suffix}`
  const finalPage = remapIds(cleanedPage, context.idMap)

  // --- Duplicate check ---
  const existing = await findByTitle(destEnv, 'pages', finalPage.title).catch(() => null)
  if (existing) {
    const choice = await select({
      message: `A page named "${finalPage.title}" already exists in ${destEnv.label}. What do you want to do?`,
      choices: [
        { name: 'Create duplicate', value: 'duplicate' },
        { name: 'Abort', value: 'abort' },
      ],
    })
    if (choice === 'abort') {
      console.log('\nAborted.')
      process.exit(0)
    }
  }

  // --- Create page in destination ---
  console.log(`\nCreating page "${finalPage.title}" in ${destEnv.label}...`)
  let createdPage
  try {
    createdPage = await createDocument(destEnv, 'pages', finalPage)
  } catch (err) {
    console.error(`Failed to create page: ${err.message}`)
    process.exit(1)
  }

  if (!createdPage?.id) {
    console.error('Page was created but no ID was returned.')
    process.exit(1)
  }

  const adminUrl = `${destEnv.baseUrl}/${destEnv.orgSlug}/admin/collections/pages/${createdPage.id}`
  console.log(`\n✅ Page cloned successfully!`)
  console.log(`   Title: ${finalPage.title}`)
  console.log(`   ID:    ${createdPage.id}`)
  console.log(`   URL:   ${adminUrl}`)

  if (context.idMap.size > 0) {
    console.log(`\n   Relationships cloned: ${context.idMap.size}`)
  }

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('\n✗ Fatal error:', err.message)
  process.exit(1)
})
