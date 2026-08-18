import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const template = await readFile(path.join(dist, 'index.html'), 'utf8')
const renderer = await import(pathToFileURL(path.join(root, '.ssr', 'ssr.js')).href)
const routes = renderer.guideRoutes()
const siteUrl = 'https://worldmushroomforaging.org'
const appRoutes = ['/community', '/field-guide']

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
  const canonical = `${siteUrl}${metadata.path}`
  $('title').text(metadata.title)
  updateMeta($, 'meta[name="description"]', 'content', metadata.description)
  updateMeta($, 'meta[property="og:title"]', 'content', metadata.title)
  updateMeta($, 'meta[property="og:description"]', 'content', metadata.description)
  updateMeta($, 'meta[property="og:url"]', 'content', canonical)
  updateMeta($, 'meta[name="twitter:title"]', 'content', metadata.title)
  updateMeta($, 'meta[name="twitter:description"]', 'content', metadata.description)
  updateMeta($, 'link[rel="canonical"]', 'href', canonical)
}

for (const route of appRoutes) {
  const metadata = renderer.pageMetadataForPath(route)
  const $ = load(template)
  applyMetadata($, metadata)

  const outputDirectory = path.join(dist, route.slice(1))
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(path.join(outputDirectory, 'index.html'), $.html(), 'utf8')
}

for (const route of routes) {
  const metadata = renderer.guideMetadataForPath(route)
  const $ = load(template)
  $('#root').html(renderer.renderGuide(route))
  applyMetadata($, metadata)
  updateMeta($, 'meta[property="og:type"]', 'content', metadata.species ? 'article' : 'website')
  $('script[type="application/ld+json"]').remove()
  $('head').append(`<script id="guide-structured-data" type="application/ld+json">${JSON.stringify(renderer.guideStructuredData(route)).replace(/</g, '\\u003c')}</script>`)

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
  { path: '/', lastmod: appLastModified },
  ...appRoutes.map(pathname => ({ path: pathname, lastmod: appLastModified })),
  { path: '/learn', lastmod: latestDate(guideLastModified, latestSpeciesReview) },
  { path: '/learn/safety', lastmod: guideLastModified },
  { path: '/regions', lastmod: guideLastModified },
  { path: '/about', lastmod: guideLastModified },
  { path: '/disclaimer', lastmod: guideLastModified },
]
const speciesEntries = speciesMetadata.map(metadata => ({
  path: metadata.path,
  lastmod: latestDate(guideLastModified, metadata.species.last_reviewed),
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
console.log(`Prerendered ${routes.length} guide routes and ${appRoutes.length} app routes.`)
console.log(`Generated ${childSitemaps.length} sitemaps with ${pageEntries.length + speciesEntries.length + regionEntries.length} canonical URLs.`)
