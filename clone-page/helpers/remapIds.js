/**
 * Deep-walk `data` and replace any string values that appear in `idMap`
 * with their mapped destination IDs. Also strips block-level `id` fields
 * that Payload auto-generates (so destination creates fresh ones).
 */
export function remapIds(data, idMap) {
  return walk(data, idMap)
}

function walk(node, idMap) {
  if (node === null || node === undefined) return node

  if (typeof node === 'string') {
    return idMap.has(node) ? idMap.get(node) : node
  }

  if (Array.isArray(node)) {
    return node.map((item) => walk(item, idMap))
  }

  if (typeof node === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(node)) {
      // Strip Payload-generated block IDs so destination creates fresh ones.
      // Top-level document id is already stripped before we call remapIds.
      if (key === 'id' && typeof value === 'string' && isInsideBlock(node)) {
        continue
      }
      result[key] = walk(value, idMap)
    }
    return result
  }

  return node
}

// Heuristic: an object is "inside a block" (not a top-level doc) if it has
// a `blockType` sibling — i.e., the parent object has blockType.
// We detect this by checking if the current object IS a block itself.
function isInsideBlock(obj) {
  return typeof obj.blockType === 'string'
}
