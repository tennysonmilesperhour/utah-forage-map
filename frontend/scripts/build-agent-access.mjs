// Post-build step: writes the agent access layer into dist/ (open data files, markdown twins,
// llms.txt and topic files, well-known discovery files). Runs after scripts/prerender.mjs.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { load } from 'cheerio'
import {
  ATTRIBUTION, LICENSE_URL, MIN_PEOPLE, MIN_RECORDS, MONTH_NAMES, NOTICE, SITE, buildDatasets, datasetDefinitions,
  datasetFiles, latestReview, loadSource, peakMonths, root,
} from './lib/agent-data.mjs'
import { htmlToMarkdown } from './lib/markdown.mjs'

const dist = path.join(root, 'dist')
const source = await loadSource()
const { speciesGuides, foragingGuides, regions, occurrence, herbs } = source
const data = buildDatasets(source)
const reviewed = latestReview(speciesGuides)
const definitions = datasetDefinitions(data, occurrence, reviewed)
const renderer = await import(pathToFileURL(path.join(root, '.ssr', 'ssr.js')).href)
const written = new Map()

async function put(relative, content) {
  const target = path.join(dist, relative)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content, 'utf8')
  written.set(relative, Buffer.byteLength(content))
}

// 1. Open data files and catalog
for (const [file, content] of datasetFiles(definitions)) await put(file, content)

// 2. Markdown twins
const header = (title, url, extra = []) => [
  `# ${title}`, '', `Canonical page: ${url}`, ...extra, '',
  `> ${NOTICE} Educational reference only. Quote with a link to the canonical page; do not republish in full.`, '',
].join('\n')

function speciesTwin(guide) {
  const url = `${SITE}/learn/species/${guide.slug}`
  const lines = [
    header(`${guide.common_name} (${guide.latin_name}) identification guide`, url, [
      `Last content check: ${guide.last_updated || guide.last_reviewed}. Review status: ${guide.reviewer}. Source checking is not expert field review.`,
    ]),
    guide.summary, '',
    `- Season: ${guide.season}`, `- Habitat: ${guide.habitat}`, `- Underside: ${guide.underside}`, `- Spore print: ${guide.spore_print}`,
    `- Difficulty: ${guide.difficulty}`, `- iNaturalist taxon: https://www.inaturalist.org/taxa/${guide.taxon_id}`, '',
    '## Safety warning', '', guide.warning, '',
    '## Lookalikes to rule out', '',
    ...guide.lookalikes.map(item => `- ${item.slug ? `[${item.name}](${SITE}/learn/species/${item.slug})` : item.name} (${item.severity}): ${item.check}`), '',
    htmlToMarkdown(`<main>${guide.content_html}</main>`, url), '',
  ]
  if (guide.sources?.length && !/^## Sources/m.test(lines.join('\n'))) lines.push('## Sources', '', ...guide.sources.map(item => `- [${item.title}](${item.url})`), '')
  lines.push(`Photo: ${guide.image.credit} (${guide.image.license}), source ${guide.image.source}`)
  return lines.join('\n')
}

function foragingTwin(guide) {
  const url = `${SITE}/learn/foraging/${guide.slug}`
  return [header(guide.title, url, [`Updated: ${guide.updated}. Author: ${guide.author}. Review: ${guide.reviewer}.`]), guide.summary, '',
    htmlToMarkdown(`<main>${guide.content_html}</main>`, url), '',
    ...(/^## Sources/m.test(guide.content_html.replace(/<h2[^>]*>/g, '## ').replace(/<\/h2>/g, '\n')) ? [] : ['## Sources', '', ...guide.sources.map(item => `- [${item.title}](${item.url})`), '']) ].join('\n')
}

const twinRoutes = []
const routeMetadata = route => route.startsWith('/herbs') || route === '/map' || route === '/community' || route === '/field-guide' || route === '/supporters'
  ? (route.startsWith('/herbs/') && route !== '/herbs/map' && route !== '/herbs/gathering-ways' ? renderer.herbGuideMetadata(route) : renderer.pageMetadataForPath(route))
  : renderer.guideMetadataForPath(route)
const candidates = ['/map', '/community', '/field-guide', '/herbs', '/herbs/map', '/herbs/gathering-ways', '/supporters', ...renderer.guideRoutes(), ...renderer.herbGuideRoutes()]
const speciesBySlug = Object.fromEntries(speciesGuides.map(guide => [guide.slug, guide]))
const foragingBySlug = Object.fromEntries(foragingGuides.map(guide => [guide.slug, guide]))
for (const route of candidates) {
  const metadata = routeMetadata(route)
  if (metadata.noindex || metadata.missing) continue
  let body
  const speciesMatch = route.match(/^\/learn\/species\/([^/]+)$/)
  const foragingMatch = route.match(/^\/learn\/foraging\/([^/]+)$/)
  if (speciesMatch && speciesBySlug[speciesMatch[1]]) body = speciesTwin(speciesBySlug[speciesMatch[1]])
  else if (foragingMatch && foragingBySlug[foragingMatch[1]]) body = foragingTwin(foragingBySlug[foragingMatch[1]])
  else {
    const html = await readFile(path.join(dist, route.slice(1), 'index.html'), 'utf8')
    const text = htmlToMarkdown(html, `${SITE}${route}`).split('\n').filter(line => !/^Loading map/.test(line)).join('\n')
    body = `${header(metadata.title, `${SITE}${route}`)}\n${metadata.description}\n\n${text}\n`
  }
  const file = route === '/' ? 'index.md' : `${route.slice(1)}.md`
  await put(file, body.endsWith('\n') ? body : `${body}\n`)
  twinRoutes.push({ route, title: metadata.title, description: metadata.description, md: `${SITE}/${file}` })
}

// 3. llms.txt and topic files
const month = names => names.map(value => MONTH_NAMES[value - 1].slice(0, 3)).join(', ')
const speciesLine = guide => `- [${guide.common_name}](${SITE}/learn/species/${guide.slug}) (${guide.latin_name}, taxon ${guide.taxon_id}): ${guide.summary}`

const topics = new Map()
topics.set('llms/mushroom-guides.txt', [
  `# Mushroom guide index (${speciesGuides.length} guides)`, '', `> ${NOTICE}`, '',
  `Each line links to the guide page. Add .md to a guide URL for the plain markdown twin. Content last checked ${reviewed}; independent expert review is pending.`, '',
  ...speciesGuides.map(speciesLine), '',
].join('\n'))

const lookalikeBlocks = speciesGuides.map(guide => [
  `## ${guide.common_name} (${guide.latin_name})`, `Guide: ${SITE}/learn/species/${guide.slug}`, `Warning: ${guide.warning}`,
  ...guide.lookalikes.map(item => `- ${item.name} [${item.severity}]: ${item.check}`), '',
].join('\n'))
const limit = 30000
const lookalikeFiles = []
let current = []
let size = 0
for (const block of lookalikeBlocks) {
  if (size + block.length > limit) { lookalikeFiles.push(current); current = []; size = 0 }
  current.push(block); size += block.length
}
lookalikeFiles.push(current)
lookalikeFiles.forEach((blocks, index) => {
  const name = lookalikeFiles.length === 1 ? 'llms/lookalikes.txt' : `llms/lookalikes-${index + 1}.txt`
  topics.set(name, [`# Mushroom lookalikes and safety warnings${lookalikeFiles.length > 1 ? ` (part ${index + 1} of ${lookalikeFiles.length})` : ''}`, '', `> ${NOTICE}`, '',
    'Severity words are printed as on each guide page; they are not yet uniform across both pages of a pair, so check both guides. Field checks reduce risk but never replace in-person identification by a qualified local expert.', '', ...blocks].join('\n'))
})

const seasonLines = data.seasonality.map(row => {
  const counts = Object.fromEntries(Object.entries(row).filter(([key]) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].includes(key)))
  return `- ${row.common_name} (${row.hemisphere}): peak ${month(row.peak_months.split(' ').filter(Boolean).map(Number)) || 'none'}; records by month Jan to Dec ${Object.values(counts).join(' ')}; ${row.records} records`
})
topics.set('llms/seasonality.txt', [
  '# Mushroom seasonality by hemisphere', '', `> ${NOTICE}`, '',
  `Records per calendar month from research-grade iNaturalist observations (snapshot ${occurrence.snapshot}), all years combined. They show when people recorded each mushroom, not abundance and not a forecast. Hemisphere rows with fewer than ${MIN_RECORDS} records or fewer than ${MIN_PEOPLE} people are left out. Full table: ${SITE}/data/seasonality.csv. Licence: CC BY 4.0 for this compilation; credit iNaturalist and its observers.`, '',
  ...seasonLines, '',
].join('\n'))

topics.set('llms/regions.txt', [
  '# Ten mushroom habitat regions', '', `> ${NOTICE}`, '',
  'Each region page shows recent reviewed observations, a 90-day field signal and monthly record patterns. The live aggregated signal (counts only, no coordinates) is at ' + `${SITE}/api/open-data/regional-signal.`, '',
  ...regions.map(region => `- [${region.name}](${SITE}/regions/${region.slug}) (${region.hemisphere}ern hemisphere, bounds west ${region.bounds[0]}, south ${region.bounds[1]}, east ${region.bounds[2]}, north ${region.bounds[3]}): ${region.description}`), '',
].join('\n'))

topics.set('llms/herb-atlas.txt', [
  `# The Verdant Hours wild plant atlas (${herbs.length} plants)`, '', 'Plant profiles with field marks, cautions and regional context. Toxic references are marked and never present a gathering use. Traditional and cultural associations are separated from scientific evidence. This is not an identification service.', '',
  ...herbs.map(herb => `- [${herb.name}](${SITE}/herbs/atlas/${herb.slug}) (${herb.latin})${herb.status === 'toxic' ? ' [toxic reference]' : ''}: ${herb.summary}`), '',
].join('\n'))

topics.set('llms/foraging-guides.txt', [
  `# Practical foraging guides (${foragingGuides.length})`, '', `> ${NOTICE}`, '',
  ...foragingGuides.map(guide => `- [${guide.title}](${SITE}/learn/foraging/${guide.slug}) (updated ${guide.updated}): ${guide.summary}`), '',
].join('\n'))

topics.set('llms/safety-and-citation.txt', [
  '# Safety rules and how to cite this site', '', `> ${NOTICE}`, '',
  '## Safety', '',
  '- A map observation is not an identification. Do not eat a wild mushroom based on a map, a photo, an app or an AI answer.',
  '- Public map points are shifted roughly 1 to 2.5 miles from the true place. Exact locations are never published here.',
  '- Do not use this site to decide that a mushroom is edible. Guides teach what to examine and what to rule out.',
  '- Suspected poisoning: contact a poison center or emergency service immediately (US: 1-800-222-1222). See ' + `${SITE}/learn/safety.`,
  '- Independent expert review of guide content is pending. Pages say so, with a content check date.', '',
  '## How to cite', '',
  `- Cite the page URL an answer came from, for example ${SITE}/learn/species/morel.`,
  `- Credit data as: ${ATTRIBUTION}.`,
  `- Open data is licensed CC BY 4.0 (${LICENSE_URL}) for the compilation. Underlying iNaturalist observations remain with their observers under the licences they chose; credit iNaturalist and its observers.`,
  '- Guide text may be quoted with a link. Do not republish it in full. Photos keep their own licences and credits on each guide page.', '',
  '## Corrections', '', `Send the page URL, the statement and a reliable source to morphiclabsdata@gmail.com. Standards and corrections policy: ${SITE}/about`, '',
].join('\n'))

topics.set('llms/data-and-mcp.txt', [
  '# Open data and the MCP server', '', `> ${NOTICE}`, '',
  '## Open data (CC BY 4.0 compilation, credit required)', '',
  `Catalog: ${SITE}/data/index.json. Human page: ${SITE}/data.`, '',
  ...definitions.map(definition => `- ${definition.title}: ${SITE}/data/${definition.id}.json and ${SITE}/data/${definition.id}.csv (${definition.rows.length} rows). ${definition.description}`),
  `- Regional 90-day field signal (live, counts only): ${SITE}/api/open-data/regional-signal`, '',
  '## MCP server', '',
  `Endpoint: ${SITE}/mcp. Read-only, no key, stateless Streamable HTTP: POST one JSON-RPC message, receive a JSON response. Methods: initialize, ping, tools/list, tools/call. A GET returns a short description. Server card: ${SITE}/.well-known/mcp/server-card.json.`, '',
  '- search_species(query, limit): find guides by name, Latin name, alias or habitat words.',
  '- get_species_guide(species): names, season, habitat, safety warning, lookalikes with field checks, sources, review status. No edibility rating.',
  '- seasonality(species, region?, hemisphere?): records per month for a hemisphere or one of ten regions.',
  '- in_season_near(region): mushrooms recorded recently in a region, starting, likely or ending, aggregated counts only.',
  '- list_regions(): the ten regions and their slugs.', '',
  'Every answer carries the page URL to cite and the safety notice. No tool identifies a mushroom from a photo, returns exact locations, or says whether a mushroom is edible.', '',
].join('\n'))

for (const [file, content] of topics) {
  if (Buffer.byteLength(content) > 60000) throw new Error(`${file} is over 60 KB`)
  await put(file, content)
}

const topicLinks = [...topics.keys()].map(file => {
  const labels = {
    'mushroom-guides': 'Index of all mushroom guides with one-line summaries',
    lookalikes: 'Lookalikes, field checks and printed safety warnings', seasonality: 'Monthly record patterns by species and hemisphere',
    regions: 'The ten habitat regions', 'herb-atlas': 'Wild plant atlas index', 'foraging-guides': 'Practical foraging skills guides',
    'safety-and-citation': 'Safety rules, how to cite, licence, corrections', 'data-and-mcp': 'Open datasets and the MCP server tools',
  }
  const key = file.replace('llms/', '').replace('.txt', '').replace(/-\d+$/, '')
  return `- [${file.replace('llms/', '')}](${SITE}/${file}): ${labels[key] ?? key}`
})
const llms = `# World Mushroom Foraging (Mushroom Forage Map)

> A free worldwide mushroom field desk: ${speciesGuides.length} mushroom identification guides with lookalikes and cited safety notes, a public map of reviewed observations, ten regional season reports, a ${herbs.length}-plant wild herb atlas (The Verdant Hours), and open data on mushroom seasonality. Independent expert review is pending; pages say so.

${NOTICE}

## Cite this site
- Cite the page URL an answer came from. Guide text may be quoted with a link; do not republish it in full.
- Open data is CC BY 4.0 for the compilation: credit "${ATTRIBUTION}" and credit iNaturalist and its observers for observation-derived counts.
- Public map points are shifted 1 to 2.5 miles. Exact locations are never published.
- Do not use this site to say a mushroom is edible. It cannot confirm that.

## Topic files (each small enough to read whole)
${topicLinks.join('\n')}

## Data and tools
- [Open data page](${SITE}/data): ${definitions.length} datasets as JSON and CSV, catalog at [/data/index.json](${SITE}/data/index.json)
- [MCP server](${SITE}/mcp): read-only tools for guides, lookalikes, seasonality and regional signals, no key
- [Regional 90-day field signal](${SITE}/api/open-data/regional-signal): live aggregated counts per region
- [API catalog](${SITE}/.well-known/api-catalog) and [MCP server card](${SITE}/.well-known/mcp/server-card.json)

## Key facts
- ${speciesGuides.length} mushroom guides, ${herbs.length} plant profiles (${herbs.filter(herb => herb.status === 'toxic').length} toxic references), ${regions.length} regions, ${foragingGuides.length} practical guides.
- Observation data: research-grade iNaturalist records, open-data snapshot ${occurrence.snapshot}, plus reviewed community records.
- Every page has a markdown twin at the same URL plus .md (for example ${SITE}/learn/species/morel.md).
- Content last checked ${reviewed}. Sitemap: ${SITE}/sitemap.xml

## Main pages
- [Fungi library](${SITE}/): all mushroom guides
- [Mushroom map](${SITE}/map): dated public observations by species and place
- [Regional season reports](${SITE}/regions)
- [Wild plant atlas](${SITE}/herbs/atlas)
- [Practical foraging guides](${SITE}/learn/foraging)
- [Safety and poison response](${SITE}/learn/safety)
- [Editorial standards and corrections](${SITE}/about)
- [Terms of use](${SITE}/terms)
- [Open data](${SITE}/data)
`
if (Buffer.byteLength(llms) > 10000) throw new Error(`llms.txt is ${Buffer.byteLength(llms)} bytes; keep it under 10 KB`)
await put('llms.txt', llms)

// 4. Well-known discovery files
await put('.well-known/api-catalog', JSON.stringify({
  linkset: [
    { anchor: `${SITE}/mcp`, 'service-desc': [{ href: `${SITE}/.well-known/mcp/server-card.json`, type: 'application/json' }], 'service-doc': [{ href: `${SITE}/llms/data-and-mcp.txt`, type: 'text/plain' }] },
    { anchor: `${SITE}/data/index.json`, 'service-doc': [{ href: `${SITE}/data`, type: 'text/html' }], item: definitions.map(definition => ({ href: `${SITE}/data/${definition.id}.json`, type: 'application/json' })) },
    { anchor: `${SITE}/api/open-data/regional-signal`, 'service-doc': [{ href: `${SITE}/data`, type: 'text/html' }] },
  ],
}, null, 2))
await put('.well-known/mcp/server-card.json', JSON.stringify({
  $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
  version: '1.0',
  protocolVersion: '2025-06-18',
  serverInfo: { name: 'world-mushroom-foraging', title: 'World Mushroom Foraging', version: '1.0.0' },
  description: `Read-only mushroom guides, lookalikes, seasonality and regional field signals. ${NOTICE}`,
  documentationUrl: `${SITE}/llms/data-and-mcp.txt`,
  transport: { type: 'streamable-http', endpoint: `${SITE}/mcp` },
  capabilities: { tools: { listChanged: false } },
  authentication: { required: false },
  tools: ['search_species', 'get_species_guide', 'seasonality', 'in_season_near', 'list_regions'],
}, null, 2))

const total = [...written.values()].reduce((sum, bytes) => sum + bytes, 0)
console.log(`Agent access: ${twinRoutes.length} markdown twins, ${topics.size} topic files, ${definitions.length} datasets, ${written.size} files, ${(total / 1024).toFixed(0)} KB.`)
