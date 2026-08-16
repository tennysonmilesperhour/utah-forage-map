import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { marked } from 'marked'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentDirectory = path.join(root, 'content', 'species')
const outputPath = path.join(root, 'src', 'content', 'species.generated.js')
const requiredFields = [
  'slug', 'common_name', 'latin_name', 'taxon_id', 'summary', 'edibility',
  'difficulty', 'season', 'habitat', 'underside', 'spore_print', 'warning',
  'author', 'reviewer', 'last_reviewed', 'image',
]
const requiredImageFields = ['url', 'alt', 'credit', 'source']

marked.use({ gfm: true })

const files = (await readdir(contentDirectory)).filter(file => file.endsWith('.md')).sort()
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

  guides.push({
    ...data,
    taxon_id: Number(data.taxon_id),
    last_reviewed: data.last_reviewed instanceof Date
      ? data.last_reviewed.toISOString().slice(0, 10)
      : String(data.last_reviewed),
    content_html: await marked.parse(content),
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

console.log(`Built ${guides.length} species guides.`)
