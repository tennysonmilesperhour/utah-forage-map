import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const template = await readFile(path.join(dist, 'index.html'), 'utf8')
const renderer = await import(pathToFileURL(path.join(root, '.ssr', 'ssr.js')).href)
const routes = renderer.guideRoutes()

function updateMeta($, selector, attribute, value) {
  const element = $(selector)
  if (element.length) element.attr(attribute, value)
}

for (const route of routes) {
  const metadata = renderer.guideMetadataForPath(route)
  const canonical = `https://utah-forage-map.vercel.app${metadata.path}`
  const $ = load(template)
  $('#root').html(renderer.renderGuide(route))
  $('title').text(metadata.title)
  updateMeta($, 'meta[name="description"]', 'content', metadata.description)
  updateMeta($, 'meta[property="og:title"]', 'content', metadata.title)
  updateMeta($, 'meta[property="og:description"]', 'content', metadata.description)
  updateMeta($, 'meta[property="og:url"]', 'content', canonical)
  updateMeta($, 'meta[property="og:type"]', 'content', metadata.species ? 'article' : 'website')
  updateMeta($, 'meta[name="twitter:title"]', 'content', metadata.title)
  updateMeta($, 'meta[name="twitter:description"]', 'content', metadata.description)
  updateMeta($, 'link[rel="canonical"]', 'href', canonical)
  $('script[type="application/ld+json"]').remove()
  $('head').append(`<script id="guide-structured-data" type="application/ld+json">${JSON.stringify(renderer.guideStructuredData(route)).replace(/</g, '\\u003c')}</script>`)

  const outputDirectory = path.join(dist, route.slice(1))
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(path.join(outputDirectory, 'index.html'), $.html(), 'utf8')
}

const today = new Date().toISOString().slice(0, 10)
const allRoutes = ['/', '/community', '/field-guide', ...routes]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map(route => `  <url>
    <loc>https://utah-forage-map.vercel.app${route}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${route === '/' ? '1.0' : route === '/learn' ? '0.9' : '0.7'}</priority>
  </url>`).join('\n')}
</urlset>
`
await writeFile(path.join(dist, 'sitemap.xml'), sitemap, 'utf8')
console.log(`Prerendered ${routes.length} guide routes.`)
