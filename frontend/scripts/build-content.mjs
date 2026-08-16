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
  'difficulty', 'season', 'habitat', 'underside', 'spore_print', 'image',
]

marked.use({ gfm: true })

const files = (await readdir(contentDirectory)).filter(file => file.endsWith('.md')).sort()
const guides = []

for (const file of files) {
  const source = await readFile(path.join(contentDirectory, file), 'utf8')
  const { data, content } = matter(source)
  const missing = requiredFields.filter(field => data[field] == null)
  if (missing.length) throw new Error(`${file} is missing: ${missing.join(', ')}`)
  if (!Array.isArray(data.lookalikes)) throw new Error(`${file} needs a lookalikes list`)

  guides.push({
    ...data,
    taxon_id: Number(data.taxon_id),
    last_reviewed: data.last_reviewed instanceof Date
      ? data.last_reviewed.toISOString().slice(0, 10)
      : String(data.last_reviewed),
    content_html: await marked.parse(content),
  })
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
