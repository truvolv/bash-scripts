async function apiRequest(envConfig, method, collection, queryOrPath = '', body = null) {
  const url = `${envConfig.baseUrl}/${envConfig.orgSlug}/api/${collection}${queryOrPath}`
  const headers = { Authorization: `users API-Key ${envConfig.token}` }

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`[${envConfig.label}] ${method} ${collection}${queryOrPath} → ${res.status}: ${text}`)
  }

  return res.json()
}

export async function fetchDocument(envConfig, collection, id) {
  return apiRequest(envConfig, 'GET', collection, `/${id}?depth=1`)
}

export async function findByTitle(envConfig, collection, title) {
  const data = await apiRequest(
    envConfig,
    'GET',
    collection,
    `?where[title][equals]=${encodeURIComponent(title)}&depth=0&limit=1`,
  )
  return data?.docs?.[0] ?? null
}

export async function findBySlug(envConfig, collection, slug) {
  const data = await apiRequest(
    envConfig,
    'GET',
    collection,
    `?where[slug][equals]=${encodeURIComponent(slug)}&depth=0&limit=1`,
  )
  return data?.docs?.[0] ?? null
}

export async function createDocument(envConfig, collection, data) {
  const res = await apiRequest(envConfig, 'POST', collection, '', data)
  return res?.doc ?? null
}

export async function uploadMedia(envConfig, mediaDoc) {
  if (!mediaDoc.url) throw new Error(`Media doc ${mediaDoc.id} has no url to download from`)

  console.log(`  Downloading media file: ${mediaDoc.filename} (${mediaDoc.url})`)
  const fileRes = await fetch(mediaDoc.url)
  if (!fileRes.ok) throw new Error(`Failed to download media from ${mediaDoc.url}: ${fileRes.status}`)

  const buffer = await fileRes.arrayBuffer()
  const formData = new FormData()
  const blob = new Blob([buffer], { type: mediaDoc.mimeType || 'application/octet-stream' })
  formData.append('file', blob, mediaDoc.filename)
  // Payload v3 expects non-file fields as a JSON string in a '_payload' part
  formData.append('_payload', JSON.stringify({ alt: mediaDoc.alt || mediaDoc.filename || 'Imported media' }))

  const url = `${envConfig.baseUrl}/${envConfig.orgSlug}/api/media`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `users API-Key ${envConfig.token}` },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`[${envConfig.label}] Media upload failed: ${res.status}: ${text}`)
  }

  const body = await res.json()
  return body?.doc ?? null
}
