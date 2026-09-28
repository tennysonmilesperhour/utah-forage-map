import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { marked } from 'marked'
import { load } from 'cheerio'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentDirectory = path.join(root, 'content', 'species')
const outputPath = path.join(root, 'src', 'content', 'species.generated.js')
const requiredFields = [
  'slug', 'common_name', 'latin_name', 'taxon_id', 'summary', 'edibility',
  'difficulty', 'season', 'habitat', 'underside', 'spore_print', 'warning',
  'author', 'reviewer', 'last_reviewed', 'image',
]
const requiredImageFields = [
  'url', 'alt', 'credit', 'source', 'creator', 'copyright_notice', 'license',
]

marked.use({ gfm: true })

// YAML parses unquoted dates as Date objects, which would serialize as full
// timestamps; the guide renders these as calendar days, so keep YYYY-MM-DD.
function calendarDate(value, file, field) {
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${file} ${field} must be a YYYY-MM-DD date: ${value}`)
  return date
}

// Files are numbered in catalogue order; compare numerically so 100 follows 99.
const files = (await readdir(contentDirectory)).filter(file => file.endsWith('.md')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b))
const guides = []
const slugs = new Set()
const taxonIds = new Set()

for (const file of files) {
  const source = await readFile(path.join(contentDirectory, file), 'utf8')
  const { data, content } = matter(source)
  const missing = requiredFields.filter(field => data[field] == null)
  if (missing.length) throw new Error(`${file} is missing: ${missing.join(', ')}`)
  if (!Array.isArray(data.lookalikes)) throw new Error(`${file} needs a lookalikes list`)
  const missingImageFields = requiredImageFields.filter(field => data.image?.[field] == null)
  if (missingImageFields.length) throw new Error(`${file} image is missing: ${missingImageFields.join(', ')}`)
  if (data.lookalikes.some(item => !item.name || !item.severity || !item.check)) {
    throw new Error(`${file} has an incomplete lookalike`)
  }
  if (slugs.has(data.slug)) throw new Error(`${file} duplicates slug: ${data.slug}`)
  if (taxonIds.has(Number(data.taxon_id))) throw new Error(`${file} duplicates taxon_id: ${data.taxon_id}`)
  slugs.add(data.slug)
  taxonIds.add(Number(data.taxon_id))

  const $ = load(await marked.parse(content), null, false)
  const headings = []
  $('h2, h3').each((index, element) => {
    const text = $(element).text()
    const id = `section-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    $(element).attr('id', id)
    if (element.tagName === 'h2') headings.push({ id, text })
  })
  const sources = []
  $('#section-sources').nextUntil('h2').find('a[href]').each((index, element) => {
    const url = $(element).attr('href')
    if (url.startsWith('https://') || url.startsWith('http://')) sources.push({ title: $(element).text(), url })
  })
  guides.push({
    ...data,
    taxon_id: Number(data.taxon_id),
    last_reviewed: calendarDate(data.last_reviewed, file, 'last_reviewed'),
    ...(data.last_updated != null && { last_updated: calendarDate(data.last_updated, file, 'last_updated') }),
    content_html: $.html(), headings, sources, source_file: `content/species/${file}`,
  })
}

for (const guide of guides) {
  for (const lookalike of guide.lookalikes) {
    if (lookalike.slug && !slugs.has(lookalike.slug)) {
      throw new Error(`${guide.slug} links to missing lookalike slug: ${lookalike.slug}`)
    }
  }
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `// Generated from content/species/*.md by scripts/build-content.mjs.\n` +
  `export const speciesGuides = ${JSON.stringify(guides, null, 2)}\n\n` +
  `export const speciesBySlug = Object.fromEntries(speciesGuides.map(item => [item.slug, item]))\n` +
  `export function speciesPathForTaxon(taxonId) {\n` +
  `  const guide = speciesGuides.find(item => item.taxon_id === Number(taxonId))\n` +
  `  return guide ? \`/learn/species/\${guide.slug}\` : null\n` +
  `}\n`, 'utf8')

// A light index for the field maps and ID helper, without guide bodies.
const index = guides.map(guide => ({
  slug: guide.slug, common_name: guide.common_name, latin_name: guide.latin_name, taxon_id: guide.taxon_id,
  edibility: guide.edibility, summary: guide.summary, image: guide.image.url,
  lookalikes: guide.lookalikes.map(({ name, slug, severity }) => ({ name, slug: slug ?? null, severity })),
}))
await writeFile(path.join(root, 'src', 'content', 'species-index.generated.js'), `// Generated from content/species/*.md by scripts/build-content.mjs.\n` +
  `export const speciesIndex = ${JSON.stringify(index, null, 2)}\n\n` +
  `export const speciesIndexBySlug = Object.fromEntries(speciesIndex.map(item => [item.slug, item]))\n` +
  `export const speciesIndexByTaxon = Object.fromEntries(speciesIndex.map(item => [item.taxon_id, item]))\n` +
  `export function speciesPathForTaxon(taxonId) {\n` +
  `  const guide = speciesIndexByTaxon[Number(taxonId)]\n` +
  `  return guide ? \`/learn/species/\${guide.slug}\` : null\n` +
  `}\n`, 'utf8')

console.log(`Built ${guides.length} species guides.`)

await import('./build-foraging.mjs')
