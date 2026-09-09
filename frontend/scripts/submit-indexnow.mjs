import { readFile } from 'node:fs/promises'

// This verification key is intentionally public, not an API secret.
const { key } = JSON.parse(await readFile(new URL('./indexnow-key.json', import.meta.url), 'utf8'))
const origin = 'https://worldmushroomforaging.org'
const keyLocation = `${origin}/${key}.txt`
const [keyResponse, urlsResponse] = await Promise.all([
  fetch(keyLocation, { signal: AbortSignal.timeout(15000) }),
  fetch(`${origin}/indexnow-urls.json`, { signal: AbortSignal.timeout(15000) }),
])
if (!keyResponse.ok || (await keyResponse.text()).trim() !== key || !urlsResponse.ok) {
  throw new Error('Publish and verify the production discovery files before submitting URLs.')
}
const urlList = await urlsResponse.json()
if (!Array.isArray(urlList) || !urlList.length || urlList.length > 10000 || urlList.some(url => new URL(url).origin !== origin || new URL(url).search)) {
  throw new Error('Expected 1–10,000 canonical production URLs without query strings.')
}
if (!process.argv.includes('--submit')) {
  console.log(`Verified ${urlList.length} live canonical URLs. Add --submit to notify IndexNow.`)
} else {
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host: new URL(origin).host, key, keyLocation, urlList }),
    signal: AbortSignal.timeout(30000),
  })
  if (![200, 202].includes(response.status)) throw new Error(`IndexNow HTTP ${response.status}: ${await response.text()}`)
  console.log(`IndexNow accepted ${urlList.length} URLs (HTTP ${response.status}). Acceptance does not guarantee indexing or ranking.`)
}
