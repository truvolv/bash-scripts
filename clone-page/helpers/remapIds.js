/**
 * Deep-walk `data` and:
 * - Replace any string that appears in `idMap` with its mapped destination ID.
 * - Collapse any expanded Payload document object {id, createdAt, updatedAt, ...}
 *   to just its (remapped) ID — because fetchDocument uses depth=1 and those
 *   objects would otherwise be sent verbatim in the POST body.
 * - Strip auto-generated `id` fields from block objects so Payload assigns
 *   fresh ones in the destination.
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
    // Collapse expanded Payload documents to their (remapped) ID.
    // isPayloadDoc checks for id + createdAt + updatedAt, which only Payload
    // collection documents have (blocks only have id, not the timestamps).
    if (isPayloadDoc(node)) {
      const destId = idMap.has(node.id) ? idMap.get(node.id) : node.id
      return destId // may be null if the relationship was dropped
    }

    const result = {}
    for (const [key, value] of Object.entries(node)) {
      // Strip Payload-generated block IDs — destination will create new ones.
      if (key === 'id' && typeof value === 'string' && isBlock(node)) {
        continue
      }
      result[key] = walk(value, idMap)
    }
    return result
  }

  return node
}

function isPayloadDoc(obj) {
  return (
    typeof obj.id === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  )
}

function isBlock(obj) {
  return typeof obj.blockType === 'string'
}
