/**
 * Defines which fields in each collection contain relationships,
 * what collection they point to, and how to handle them.
 *
 * treatment:
 *   'clone'      - recursively fetch and create in destination
 *   'match_slug' - find by slug in destination and reuse (don't copy the doc)
 *   'skip'       - ignore this relationship (prevents circular loops)
 *
 * hasMany: true  - field is an array of IDs
 * items: [...]   - nested array field: { arrayField, itemRelationships[] }
 */

// Top-level fields on documents (non-block relationships)
export const COLLECTION_RELATIONSHIPS = {
  pages: [
    { field: 'page_template', collection: 'page_templates', treatment: 'clone' },
    // 'sites' is handled separately — destination site ID is provided by the user at runtime
    { field: 'categories', collection: 'categories', treatment: 'match_slug', hasMany: true },
    { field: 'tags', collection: 'tags', treatment: 'match_slug', hasMany: true },
    { field: 'featuredImage', collection: 'media', treatment: 'clone' },
  ],
  forms: [
    { field: 'formIntegration', collection: 'form-integrations', treatment: 'clone' },
    { field: 'secondFormIntegration', collection: 'form-integrations', treatment: 'clone' },
    // 'redirect' points to pages — skip to prevent circular cloning
    { field: 'redirect', collection: 'pages', treatment: 'skip' },
  ],
  page_templates: [
    // layout blocks handled dynamically (same block walker as pages)
  ],
  reusable_blocks: [
    // base_block handled dynamically (same block walker as pages)
  ],
  // Leaf collections — no nested relationships to follow
  'form-integrations': [],
  media: [],
  locations: [],
  galleries: [],
  categories: [],
  tags: [],
  sites: [],
}

/**
 * Relationship fields within each block type.
 *
 * path supports dot notation for nested fields: 'backgroundImage.media'
 * For array items (carousel slides, tabs, etc.), use items[] notation:
 *   { arrayField: 'items', fields: [{ field: 'image', collection: 'media', treatment: 'clone' }] }
 */
export const BLOCK_RELATIONSHIPS = {
  formBlock: [
    { field: 'form', collection: 'forms', treatment: 'clone' },
    { field: 'backgroundImage.media', collection: 'media', treatment: 'clone' },
  ],
  reusableBlock: [
    { field: 'selectedReusableBlock', collection: 'reusable_blocks', treatment: 'clone' },
  ],
  contentBlock: [
    { field: 'selectedReusableBlock', collection: 'reusable_blocks', treatment: 'clone', hasMany: true },
    { field: 'backgroundImage.media', collection: 'media', treatment: 'clone' },
  ],
  imageCallToActionBlock: [
    { field: 'image', collection: 'media', treatment: 'clone' },
  ],
  contactMapBlock: [
    { field: 'backgroundImage.media', collection: 'media', treatment: 'clone' },
    { field: 'primaryLocation', collection: 'locations', treatment: 'clone' },
    { field: 'secondaryLocation', collection: 'locations', treatment: 'clone' },
    { field: 'tertiaryLocation', collection: 'locations', treatment: 'clone' },
  ],
  textWithImageBlock: [
    { field: 'backgroundImage.media', collection: 'media', treatment: 'clone' },
    // images array: items with an 'image' field
    { arrayField: 'images', fields: [{ field: 'image', collection: 'media', treatment: 'clone' }] },
  ],
  columnCalloutsBlock: [
    { field: 'backgroundImage.media', collection: 'media', treatment: 'clone' },
    { arrayField: 'callouts', fields: [{ field: 'icon', collection: 'media', treatment: 'clone' }] },
  ],
  columnCTAsBlock: [
    { field: 'backgroundImage.media', collection: 'media', treatment: 'clone' },
    { arrayField: 'ctas', fields: [{ field: 'image', collection: 'media', treatment: 'clone' }] },
  ],
  columnCardsBlock: [
    {
      arrayField: 'cards',
      fields: [
        { field: 'image', collection: 'media', treatment: 'clone' },
        { field: 'tags', collection: 'tags', treatment: 'match_slug', hasMany: true },
      ],
    },
  ],
  textWithCarouselBlock: [
    {
      arrayField: 'items',
      fields: [{ field: 'image', collection: 'media', treatment: 'clone' }],
    },
  ],
  textWithCarouselContentBlock: [
    {
      arrayField: 'items',
      fields: [{ field: 'image', collection: 'media', treatment: 'clone' }],
    },
  ],
  galleryCarouselBlock: [
    { field: 'gallery', collection: 'galleries', treatment: 'clone' },
  ],
  cardGalleryBlock: [
    { field: 'gallery', collection: 'galleries', treatment: 'clone' },
  ],
  tabbedGalleryBlock: [
    { field: 'gallery', collection: 'galleries', treatment: 'clone' },
  ],
  beforeAndAfterGalleryBlock: [
    { field: 'gallery', collection: 'galleries', treatment: 'clone' },
  ],
  tabbedBlock: [
    {
      arrayField: 'tabs',
      fields: [{ field: 'image', collection: 'media', treatment: 'clone' }],
    },
  ],
  teamMemberBlock: [
    { field: 'teamMember', collection: 'team-members', treatment: 'skip' },
  ],
  reviewsCarouselBlock: [
    { field: 'review', collection: 'reviews', treatment: 'skip' },
    { field: 'thirdPartyReviewIntegration', collection: 'third-party-review-integrations', treatment: 'skip' },
    {
      arrayField: 'items',
      fields: [{ field: 'image', collection: 'media', treatment: 'clone' }],
    },
  ],
  featuredReviewBlock: [
    { field: 'review', collection: 'reviews', treatment: 'skip' },
  ],
  serviceSelectorBlock: [
    {
      arrayField: 'services',
      fields: [
        { field: 'image', collection: 'media', treatment: 'clone' },
        {
          arrayField: 'subServices',
          fields: [{ field: 'image', collection: 'media', treatment: 'clone' }],
        },
      ],
    },
  ],
  videoCarouselBlock: [
    {
      arrayField: 'items',
      fields: [
        { field: 'thumbnail', collection: 'media', treatment: 'clone' },
        { field: 'truspeedMedia', collection: 'media', treatment: 'clone' },
      ],
    },
  ],
  menuBlock: [
    { field: 'menu', collection: 'menus', treatment: 'skip' },
  ],
  locationsBlock: [], // locations are tenant-specific config, skip
  archiveBlock: [],
  recentPostsBlock: [],
  reviewListingBlock: [],
  teamMemberListingBlock: [],
  calloutBannerBlock: [],
  countdownClockBlock: [],
  eventsBlock: [],
  mapBlock: [],
  tableBlock: [],
  codeBlock: [],
  thirdPartyFormBlock: [],
}

// Collections whose IDs should never be followed (skip silently)
export const SKIP_COLLECTIONS = new Set([
  'reviews',
  'third-party-review-integrations',
  'menus',
  'team-members',
  'posts',
  'users',
  'organizations',
])

// System fields to strip from a document before creating it in destination
export const SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt', 'tenant', '__v', 'globalType', '_status']
