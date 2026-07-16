const collectionAttributes = {
  pages: ["slug", "pathname"],
  media: ['alt', 'filename'],
  form: ['fields'],
  reusable_blocks: ['base_block'],
  modals: ['modalSettings']
//   'page_templates': []
};

export function identifyCollection(document) {
  const potentialCollections = [];
  for (const [collection, attributes] of Object.entries(collectionAttributes)) {
    // must have all attributes to be a potential collection
    if (attributes.every((attr) => document.hasOwnProperty(attr))) {
      potentialCollections.push(collection);
    }
  }
  return potentialCollections;
};
