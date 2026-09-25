import matter from 'gray-matter'
import { readdir } from 'node:fs/promises'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
const profiles = JSON.parse(await readFile(new URL('../src/data/herb-guide.json', import.meta.url), 'utf8'))
const catalogue = profiles.map(({ slug, name, latin, status, caution }) => ({ slug, name, latin, status, caution }))
const json = JSON.stringify(catalogue, null, 2) + '\n'
await writeFile(new URL('../src/data/companion-plants.json', import.meta.url), json)
await mkdir(new URL('../../backend/app/data/', import.meta.url), { recursive: true })
await writeFile(new URL('../../backend/app/data/companion-plants.json', import.meta.url), json)

const speciesDir = new URL('../content/species/', import.meta.url)
const species = await Promise.all((await readdir(speciesDir)).filter(p => p.endsWith('.md')).map(async file => matter(await readFile(new URL(file, speciesDir), 'utf8')).data))
const entries = [...species.map(p => ({ key: `fungi:${p.slug}`, name: p.common_name, href: `/learn/species/${p.slug}`, priority: ['deadly', 'poisonous', 'caution'].includes(p.edibility) ? 0 : 1 })), ...profiles.map(p => ({ key: `herbs:${p.slug}`, name: p.name, href: `/herbs/atlas/${p.slug}`, priority: p.status === 'toxic' ? 0 : 1 }))].sort((a,b) => a.priority - b.priority || a.name.localeCompare(b.name))
await writeFile(new URL('../src/data/editorialCoverage.json', import.meta.url), JSON.stringify(entries, null, 2) + '\n')
