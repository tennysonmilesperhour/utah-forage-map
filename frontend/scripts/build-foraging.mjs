import { readdir, readFile, writeFile } from 'node:fs/promises'
import matter from 'gray-matter'
import { marked } from 'marked'
import { load } from 'cheerio'

const directory = new URL('../content/foraging/', import.meta.url)
const guides = []
for (const file of (await readdir(directory)).filter(file => file.endsWith('.md')).sort()) {
  const { data, content } = matter(await readFile(new URL(file, directory), 'utf8'))
  for (const field of ['slug', 'title', 'summary', 'category', 'author', 'reviewer', 'published', 'updated']) {
    if (!data[field]) throw new Error(`${file}: missing ${field}`)
  }
  if (guides.some(guide => guide.slug === data.slug)) throw new Error(`Duplicate guide: ${data.slug}`)
  const $ = load(await marked.parse(content), null, false)
  const headings = []
  $('h2').each((index, element) => {
    const text = $(element).text()
    const id = `section-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    $(element).attr('id', id)
    headings.push({ id, text })
  })
  const sources = new Map()
  $('a[href^="https://"]').each((index, element) => sources.set($(element).attr('href'), $(element).text()))
  if (!sources.size) throw new Error(`${file}: needs primary source citations`)
  guides.push({ ...data,
    published: new Date(data.published).toISOString().slice(0, 10),
    updated: new Date(data.updated).toISOString().slice(0, 10),
    content_html: $.html(), headings,
    sources: [...sources].map(([url, title]) => ({ url, title })),
    source_file: `content/foraging/${file}`,
  })
}
await writeFile(new URL('../src/content/foraging.generated.js', import.meta.url),
  `// Generated from content/foraging/*.md.\nexport const foragingGuides = ${JSON.stringify(guides, null, 2)}\nexport const foragingBySlug = Object.fromEntries(foragingGuides.map(guide => [guide.slug, guide]))\n`)
console.log(`Built ${guides.length} foraging skills guides.`)
