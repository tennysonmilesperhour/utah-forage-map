import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const template = await readFile(path.join(dist, 'index.html'), 'utf8')
const manifest = JSON.parse(await readFile(path.join(dist, '.vite/manifest.json'), 'utf8'))
const renderer = await import(pathToFileURL(path.join(root, '.ssr', 'ssr.js')).href)
const routes = renderer.guideRoutes()
const herbRoutes = renderer.herbGuideRoutes()
const siteUrl = 'https://worldmushroomforaging.org'
const appRoutes = ['/', '/community', '/field-guide', '/herbs']
// Public, aggregate responses only. An unavailable upstream must never break the static guide.
const publicQueries = [
  { key: ['guide-species-summaries'], endpoint: '/api/guide/species' },
  { key: ['regions'], endpoint: '/api/regions' },
  ...routes.filter(route => /^\/regions\/[^/]+$/.test(route)).map(route => ({ key: ['region', route.split('/').at(-1)], endpoint: `/api${route}` })),
]
const snapshots = []
let queryCursor = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queryCursor < publicQueries.length) {
    const query = publicQueries[queryCursor++]
    try {
      const response = await fetch(`${siteUrl}${query.endpoint}`, { signal: AbortSignal.timeout(6000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if ((query.key[0] === 'region' && (!data || !Array.isArray(data.recent_observations))) || (query.key[0] !== 'region' && !Array.isArray(data))) throw new Error('Unexpected response shape')
      snapshots.push({ key: query.key, data, updatedAt: Date.now() })
    } catch (error) { console.warn(`Static public data unavailable for ${query.endpoint}: ${error.message}`) }
  }
}))
function snapshotFor(route) {
  return snapshots.filter(entry =>
    (entry.key[0] === 'guide-species-summaries' && (route === '/learn' || route.startsWith('/learn/species/'))) ||
    (entry.key[0] === 'regions' && route === '/regions') ||
    (entry.key[0] === 'region' && route === `/regions/${entry.key[1]}`))
}


function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function latestDate(...values) {
  return values.filter(Boolean).sort((left, right) => new Date(right) - new Date(left))[0]
}

function gitLastModified(paths) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
    }).trim() || undefined
  } catch {
    return undefined
  }
}

function updateMeta($, selector, attribute, value) {
  const element = $(selector)
  if (element.length) element.attr(attribute, value)
}

function applyMetadata($, metadata) {
  const entry = metadata.path.startsWith('/herbs/') ? 'src/HerbAtlasApp.jsx' : metadata.path === '/herbs' ? 'src/HerbalApp.jsx' : appRoutes.includes(metadata.path) ? 'src/App.jsx' : 'src/GuideApp.jsx'
  const visited = new Set()
  function preload(key) {
    if (visited.has(key) || !manifest[key]) return
    visited.add(key)
    const chunk = manifest[key]
    if (chunk.file.endsWith('.js') && !$(`link[href="/${chunk.file}"]`).length) $('head').append($('<link rel="modulepreload" crossorigin>').attr('href', `/${chunk.file}`))
    for (const css of chunk.css || []) if (!$(`link[href="/${css}"]`).length) $('head').append($('<link rel="stylesheet">').attr('href', `/${css}`))
    for (const dependency of chunk.imports || []) preload(dependency)
  }
  preload(entry)

  const canonical = `${siteUrl}${metadata.path}`
  $('title').text(metadata.title)
  updateMeta($, 'meta[name="description"]', 'content', metadata.description)
  updateMeta($, 'meta[property="og:title"]', 'content', metadata.title)
  updateMeta($, 'meta[property="og:description"]', 'content', metadata.description)
  updateMeta($, 'meta[property="og:url"]', 'content', canonical)
  updateMeta($, 'meta[name="twitter:title"]', 'content', metadata.title)
  updateMeta($, 'meta[name="twitter:description"]', 'content', metadata.description)
  updateMeta($, 'link[rel="canonical"]', 'href', canonical)
  if (metadata.image) {
    for (const [attribute, key] of [['property', 'og:image'], ['name', 'twitter:image']]) {
      const imageMeta = $(`meta[${attribute}="${key}"]`)
      if (imageMeta.length) imageMeta.attr('content', metadata.image)
      else $('head').append($('<meta>').attr(attribute, key).attr('content', metadata.image))
    }
  }
  for (const [attribute, name] of [['property', 'og:image:alt'], ['name', 'twitter:image:alt']]) $('head').append($('<meta>').attr(attribute, name).attr('content', metadata.imageAlt || metadata.title))
  updateMeta($, 'meta[property="og:type"]', 'content', metadata.article || metadata.species || metadata.plant ? 'article' : 'website')
  updateMeta($, 'meta[name="twitter:card"]', 'content', 'summary_large_image')
  if (metadata.noindex || metadata.missing) updateMeta($, 'meta[name="robots"]', 'content', 'noindex, follow')
}

for (const route of appRoutes) {
  const metadata = renderer.pageMetadataForPath(route)
  const $ = load(template)
  $('#root').html(renderer.renderApp(route))
  applyMetadata($, metadata)
  const structuredData = renderer.pageStructuredDataForPath(route)
  if (structuredData) {
    $('script[type="application/ld+json"]').remove()
    $('head').append(`<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>`)
  }

  const outputDirectory = path.join(dist, route.slice(1))
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(path.join(outputDirectory, 'index.html'), $.html(), 'utf8')
}

for (const route of routes) {
  const metadata = renderer.guideMetadataForPath(route)
  const $ = load(template)
  const snapshot = snapshotFor(route)
  $('#root').html(renderer.renderGuide(route, snapshot))
  if (snapshot.length) $('body').append(`<script id="public-query-snapshot" type="application/json">${JSON.stringify(snapshot).replace(/</g, '\\u003c')}</script>`)

  applyMetadata($, metadata)
  updateMeta($, 'meta[property="og:type"]', 'content', metadata.species || metadata.article ? 'article' : 'website')
  $('script[type="application/ld+json"]').remove()
  $('head').append(`<script id="guide-structured-data" type="application/ld+json">${JSON.stringify(renderer.guideStructuredData(route)).replace(/</g, '\\u003c')}</script>`)

  const outputDirectory = path.join(dist, route.slice(1))
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(path.join(outputDirectory, 'index.html'), $.html(), 'utf8')
}

for (const route of herbRoutes) {
  const metadata = renderer.herbGuideMetadata(route)
  const $ = load(template)
  $('#root').html(renderer.renderHerbGuide(route))
  applyMetadata($, metadata)
  updateMeta($, 'meta[property="og:type"]', 'content', metadata.plant ? 'article' : 'website')
  $('script[type="application/ld+json"]').remove()
  $('head').append(`<script id="herb-guide-structured-data" type="application/ld+json">${JSON.stringify(renderer.herbGuideStructuredData(route)).replace(/</g, '\\u003c')}</script>`)
  const outputDirectory = path.join(dist, route.slice(1))
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(path.join(outputDirectory, 'index.html'), $.html(), 'utf8')
}

const appLastModified = gitLastModified([
  'src/App.jsx', 'src/lib/seo.js', 'src/components/CommunityPanel.jsx', 'src/index.css',
])
const guideLastModified = gitLastModified([
  'src/GuideApp.jsx', 'src/lib/guideSeo.js', 'src/data/regions.js', 'src/index.css',
])
const sitemapFormatLastModified = gitLastModified(['scripts/prerender.mjs'])
const speciesMetadata = routes
  .map(route => renderer.guideMetadataForPath(route))
  .filter(metadata => metadata.species)
const latestSpeciesReview = latestDate(...speciesMetadata.map(metadata => metadata.species.last_reviewed))

const pageEntries = [
  ...appRoutes.map(pathname => ({ path: pathname, lastmod: appLastModified })),
  { path: '/learn', lastmod: latestDate(guideLastModified, latestSpeciesReview) },
  { path: '/learn/safety', lastmod: guideLastModified },
  { path: '/learn/foraging', lastmod: gitLastModified(['content/foraging']) || '2026-09-09' },
  ...routes.map(route => renderer.guideMetadataForPath(route)).filter(metadata => metadata.article).map(metadata => ({ path: metadata.path, lastmod: metadata.article.updated })),
  { path: '/regions', lastmod: guideLastModified },
  { path: '/about', lastmod: guideLastModified },
  { path: '/privacy', lastmod: guideLastModified },
  { path: '/disclaimer', lastmod: guideLastModified },
]
const speciesEntries = speciesMetadata.map(metadata => ({
  path: metadata.path,
  lastmod: latestDate(gitLastModified([metadata.species.source_file]), metadata.species.last_reviewed),
  image: metadata.species.image.url,
}))
const regionEntries = routes
  .map(route => renderer.guideMetadataForPath(route))
  .filter(metadata => metadata.region)
  .map(metadata => ({ path: metadata.path, lastmod: guideLastModified }))

function urlSet(entries, { images = false } = {}) {
  const namespace = images ? '\n    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${namespace}>
${entries.map(entry => `  <url>
    <loc>${escapeXml(`${siteUrl}${entry.path}`)}</loc>${entry.lastmod ? `
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''}${entry.image ? `
    <image:image>
      <image:loc>${escapeXml(entry.image)}</image:loc>
    </image:image>` : ''}
  </url>`).join('\n')}
</urlset>
`
}

const childSitemaps = [
  { name: 'sitemap-pages.xml', entries: pageEntries },
  { name: 'sitemap-herbs.xml', entries: herbRoutes.filter(path => !renderer.herbGuideMetadata(path).noindex).map(path => ({ path, lastmod: gitLastModified(['src/data/herbGuide.js', 'src/data/herbFieldcraft.js']) || '2026-09-09' })) },
  { name: 'sitemap-species.xml', entries: speciesEntries, images: true },
  { name: 'sitemap-regions.xml', entries: regionEntries },
].map(sitemap => ({
  ...sitemap,
  lastmod: latestDate(sitemapFormatLastModified, ...sitemap.entries.map(entry => entry.lastmod)),
}))

for (const sitemap of childSitemaps) {
  await writeFile(path.join(dist, sitemap.name), urlSet(sitemap.entries, { images: sitemap.images }), 'utf8')
}

const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${childSitemaps.map(sitemap => `  <sitemap>
    <loc>${siteUrl}/${sitemap.name}</loc>${sitemap.lastmod ? `
    <lastmod>${sitemap.lastmod}</lastmod>` : ''}
  </sitemap>`).join('\n')}
</sitemapindex>
`
await writeFile(path.join(dist, 'sitemap.xml'), sitemapIndex, 'utf8')
console.log(`Prerendered ${routes.length + herbRoutes.length} guide routes and ${appRoutes.length} app routes.`)
console.log(`Generated ${childSitemaps.length} sitemaps with ${childSitemaps.reduce((sum, sitemap) => sum + sitemap.entries.length, 0)} canonical URLs.`)

// Optional plain-text discovery aids mirror the visible, canonical HTML; they do not instruct bots to rank the site.
const referencePages = []
await mkdir(path.join(dist, 'reference'), { recursive: true })
for (const route of [...appRoutes, ...routes, ...herbRoutes]) {
  const metadata = route.startsWith('/herbs/') ? renderer.herbGuideMetadata(route) : appRoutes.includes(route) ? renderer.pageMetadataForPath(route) : renderer.guideMetadataForPath(route)
  if (metadata.noindex || metadata.missing) continue
  const $ = load(await readFile(path.join(dist, route.slice(1), 'index.html'), 'utf8'))
  const main = $('main').first().clone()
  main.find('script, style, button, select, input, textarea, svg').remove()
  main.find('a[href]').each((index, element) => {
    const text = $(element).text().trim()
    const href = $(element).attr('href')
    if (text) $(element).replaceWith(`[${text}](${new URL(href, `${siteUrl}${route}`).href})`)
  })
  main.find('h1, h2, h3, p, li, dt, dd, tr, section, article, nav, div').each((index, element) => { $(element).append('\n\n'); if (/h[123]/.test(element.tagName)) $(element).prepend('#'.repeat(Number(element.tagName[1])) + ' ') })
  const body = main.text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim()
  const filename = route === '/' ? 'map.md' : `${route.slice(1).replaceAll('/', '--')}.md`
  await writeFile(path.join(dist, 'reference', filename), `# ${metadata.title}\n\nCanonical: ${siteUrl}${route}\n\n${metadata.description}\n\nThis text mirrors the public page. Consult the canonical page for current observations, source credits, and review status. Educational reference only; it does not establish edibility or land access.\n\n${body}\n`)
  referencePages.push({ title: metadata.title, description: metadata.description, url: `${siteUrl}${route}`, text: `${siteUrl}/reference/${filename}` })
}
await writeFile(path.join(dist, 'reference', 'index.json'), JSON.stringify({ site: siteUrl, scope: '30 mushroom guides, 44 plant profiles, 10 mushroom habitat regions, and practical field skills. Global observation coverage varies.', editorialPolicy: `${siteUrl}/about#editorial`, pages: referencePages }, null, 2))
await writeFile(path.join(dist, 'llms.txt'), `# Mushroom Forage Map and The Verdant Hours

> A worldwide public mushroom observation map, 30 mushroom profiles, 44 wild plant profiles, ten mushroom habitat regions, and practical field-skills guides. Coverage is developing and varies by place. Independent expert review is pending where indicated on each page.

Observation records are not identification, proof of edibility, or access permission. Traditional herb associations are distinguished from scientific evidence. Photographs retain their source licenses; the decorative fungi hero includes disclosed AI outpainting.

## Start here
- [Mushroom map](${siteUrl}/): Filter dated public observations by species and place.
- [Mushroom identification atlas](${siteUrl}/learn): Field marks, lookalikes, photographs, sources, and recent observations.
- [Wild plant atlas](${siteUrl}/herbs/atlas): Plant identification, toxic lookalikes, regional context, and source notes.
- [Practical foraging guides](${siteUrl}/learn/foraging): Identification process, seasons, land access, and recording finds.
- [Regional mushroom records](${siteUrl}/regions): Observation-based reports with coverage limitations.
- [Herb fieldcraft](${siteUrl}/herbs/fieldcraft): Gathering practice and source library.

## Provenance and safety
- [Editorial standards and corrections](${siteUrl}/about)
- [Mushroom safety and poison response](${siteUrl}/learn/safety)
- [Identification and access disclaimer](${siteUrl}/disclaimer)
- [Privacy](${siteUrl}/privacy)

## Reference formats
- [Canonical URL sitemap](${siteUrl}/sitemap.xml)
- [Reference index](${siteUrl}/reference/index.json): Public page titles, canonical URLs, descriptions, and text versions generated from the same visible content.
`)
await writeFile(path.join(dist, 'indexnow-urls.json'), JSON.stringify(referencePages.map(page => page.url), null, 2))
console.log(`Published ${referencePages.length} readable reference pages; ${snapshots.length}/${publicQueries.length} public data snapshots available.`)
