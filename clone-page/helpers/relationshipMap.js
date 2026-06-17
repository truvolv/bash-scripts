/**
 * Fingerprints used by the generic relationship walker to identify which
 * collection an expanded Payload document belongs to.
 * Checked in order — first match wins. Keep most-specific entries first.
 */
export const COLLECTION_FINGERPRINTS = [
  { requiredFields: ['filename', 'mimeType'], collection: 'media' },
  { requiredFields: ['base_block'],           collection: 'reusable_blocks' },
  { requiredFields: ['gallery_images'],       collection: 'galleries' },
  { requiredFields: ['crm'],                  collection: 'form-integrations' },
  { requiredFields: ['submitButtonLabel'],    collection: 'forms' },
  // page_templates have 'layout' but not 'sites'; pages have both (and are in SKIP_COLLECTIONS)
  { requiredFields: ['layout'], forbiddenFields: ['sites'], collection: 'page_templates' },
]

/**
 * Collections to never follow. Relationships pointing here are left as
 * the source ID (potential broken link) rather than cloned.
 */
export const SKIP_COLLECTIONS = new Set([
  'pages',                          // circular — never follow page back-references
  'sites',                          // handled separately via destSiteId prompt
  'reviews',
  'third-party-review-integrations',
  'menus',
  'team-members',
  'posts',
  'users',
  'organizations',
])

/**
 * Explicit relationship handling for fields that cannot be auto-detected
 * by fingerprinting (categories and tags have no distinctive fields).
 * Only populated for collections where generic walking falls short.
 */
export const COLLECTION_RELATIONSHIPS = {
  pages: [
    { field: 'categories', collection: 'categories', treatment: 'match_title', hasMany: true },
    { field: 'tags',       collection: 'tags',       treatment: 'match_title', hasMany: true },
  ],
}

// System fields stripped from every document before creating in destination
export const SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt', 'tenant', '__v', 'globalType', '_status']
