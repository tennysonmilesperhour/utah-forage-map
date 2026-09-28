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
const speciesFiles = (await readdir(speciesDir)).filter(p => p.endsWith('.md')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
const species = await Promise.all(speciesFiles.map(async file => matter(await readFile(new URL(file, speciesDir), 'utf8')).data))
const entries = [...species.map(p => ({ key: `fungi:${p.slug}`, name: p.common_name, href: `/learn/species/${p.slug}`, priority: ['deadly', 'poisonous', 'caution'].includes(p.edibility) ? 0 : 1 })), ...profiles.map(p => ({ key: `herbs:${p.slug}`, name: p.name, href: `/herbs/atlas/${p.slug}`, priority: p.status === 'toxic' ? 0 : 1 }))].sort((a,b) => a.priority - b.priority || a.name.localeCompare(b.name))
await writeFile(new URL('../src/data/editorialCoverage.json', import.meta.url), JSON.stringify(entries, null, 2) + '\n')

// The backend seed adds any guide species it does not already define, so the importer and
// map filters cover the whole library. Written in guide order.
const fungi = species
  .map(data => ({
    common_name: data.common_name,
    latin_name: data.latin_name,
    inaturalist_taxon_id: Number(data.taxon_id),
    edibility: data.edibility,
    look_alikes: data.lookalikes.map(item => item.name).join(', '),
    habitat_notes: data.habitat,
    range_notes: data.summary,
    notes: data.warning,
  }))
await writeFile(new URL('../../backend/app/data/fungi-species.json', import.meta.url), JSON.stringify(fungi, null, 2) + '\n')

// Photo ID compares a photo against this fixed list; the server never takes names from the browser.
const identifyCandidates = {
  fungi: species.map(data => ({ slug: data.slug, name: data.common_name, latin: data.latin_name })),
  herbs: profiles.map(({ slug, name, latin }) => ({ slug, name, latin })),
}
await writeFile(new URL('../../backend/app/data/identify-candidates.json', import.meta.url), JSON.stringify(identifyCandidates, null, 2) + '\n')

// Page copy and metadata read these so catalogue counts cannot drift from the data.
const counts = { fungi: species.length, herbs: profiles.length, herbToxic: profiles.filter(p => p.status === 'toxic').length }
await writeFile(new URL('../src/data/catalogue-counts.json', import.meta.url), JSON.stringify(counts, null, 2) + '\n')
