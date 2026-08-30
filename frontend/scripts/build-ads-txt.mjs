// Emits dist/ads.txt when an AdSense publisher client ID is configured.
//
// AdSense requires an ads.txt file at the site root declaring the publisher
// account authorized to sell the site's ad inventory. It is generated from
// VITE_ADSENSE_CLIENT at build time so no placeholder publisher ID is ever
// committed; when the variable is unset no file is written (nothing to declare).
//
// Runs after the Vite build so it lands in dist/ alongside the other static
// files Vercel serves directly (like robots.txt).

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

const client = (process.env.VITE_ADSENSE_CLIENT ?? '').trim()

if (!client.startsWith('ca-pub-')) {
  console.log('[ads.txt] VITE_ADSENSE_CLIENT not set; skipping ads.txt generation.')
  process.exit(0)
}

// ads.txt lists the bare publisher ID (pub-...), not the ca-pub- account label.
const publisherId = client.replace(/^ca-/, '')
// f08c47fec0942fa0 is Google's fixed AdSense certification authority ID.
const line = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`

await writeFile(path.join(dist, 'ads.txt'), line, 'utf8')
console.log(`[ads.txt] Wrote dist/ads.txt for ${publisherId}.`)
