// Open datasets for people, AI assistants and automation. Everything here is a pure function of
// committed content (species guides, the iNaturalist open-data summary and the region list), so the
// pages, files, markdown twins and the MCP server all describe the same numbers.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SITE = 'https://worldmushroomforaging.org'
export const NOTICE = 'A map observation is not an identification. Never eat a wild mushroom based on this data.'
export const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'
export const ATTRIBUTION = 'World Mushroom Foraging (Mushroom Forage Map), https://worldmushroomforaging.org'
export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
// Hemisphere month counts are published only when they rest on enough records and people.
export const MIN_RECORDS = 30
export const MIN_PEOPLE = 10

const INAT_SOURCE = 'iNaturalist research-grade observations (iNaturalist open data, AWS Open Data Program)'

async function importFile(relative) {
  return import(pathToFileURL(path.join(root, relative)).href)
}

export async function loadSource() {
  const { speciesGuides } = await importFile('src/content/species.generated.js')
  const { foragingGuides } = await importFile('src/content/foraging.generated.js')
  const { regions } = await importFile('src/data/regions.js')
  const occurrence = JSON.parse(await readFile(path.join(root, 'src/data/occurrence-summary.json'), 'utf8'))
  const herbs = JSON.parse(await readFile(path.join(root, 'src/data/herb-guide.json'), 'utf8'))
  return { speciesGuides, foragingGuides, regions, occurrence, herbs }
}

export function csv(rows, columns) {
  const cell = value => {
    const text = value == null ? '' : String(value)
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return `${columns.join(',')}\n${rows.map(row => columns.map(column => cell(row[column])).join(',')).join('\n')}\n`
}

export function peakMonths(counts, share = 0.15) {
  const total = counts.reduce((sum, value) => sum + value, 0)
  if (!total) return []
  return counts.map((value, index) => [value, index + 1]).filter(([value]) => value / total >= share).sort((a, b) => b[0] - a[0]).map(([, month]) => month)
}

export function latestReview(speciesGuides) {
  return speciesGuides.map(guide => guide.last_updated || guide.last_reviewed).sort().at(-1)
}

export function buildDatasets({ speciesGuides, regions, occurrence }) {
  const pageUrl = guide => `${SITE}/learn/species/${guide.slug}`
  const species = speciesGuides.map(guide => ({
    slug: guide.slug,
    common_name: guide.common_name,
    latin_name: guide.latin_name,
    inaturalist_taxon_id: guide.taxon_id,
    difficulty: guide.difficulty,
    season_text: guide.season,
    habitat: guide.habitat,
    safety_warning: guide.warning,
    lookalike_count: guide.lookalikes.length,
    last_reviewed: guide.last_reviewed,
    review_status: guide.reviewer,
    page_url: pageUrl(guide),
    markdown_url: `${pageUrl(guide)}.md`,
  }))

  const seasonality = []
  const suppressed = []
  for (const guide of speciesGuides) {
    const entry = occurrence.fungi[guide.slug]
    if (!entry) continue
    for (const hemisphere of ['north', 'south']) {
      const counts = entry.months?.[hemisphere] ?? []
      const records = counts.reduce((sum, value) => sum + value, 0)
      if (records < MIN_RECORDS || entry.observers < MIN_PEOPLE) { suppressed.push(`${guide.slug}:${hemisphere}`); continue }
      const row = {
        species_slug: guide.slug, common_name: guide.common_name, latin_name: guide.latin_name,
        inaturalist_taxon_id: guide.taxon_id, hemisphere, records,
        people_all_hemispheres: entry.observers,
      }
      MONTHS.forEach((month, index) => { row[month] = counts[index] })
      row.peak_months = peakMonths(counts).join(' ')
      row.first_year = entry.firstYear
      row.last_month = entry.lastMonth
      row.snapshot = occurrence.snapshot
      row.page_url = pageUrl(guide)
      seasonality.push(row)
    }
  }

  const bySlug = Object.fromEntries(speciesGuides.map(guide => [guide.slug, guide]))
  const lookalikes = []
  for (const guide of speciesGuides) {
    for (const lookalike of guide.lookalikes) {
      const other = lookalike.slug ? bySlug[lookalike.slug] : null
      lookalikes.push({
        species_slug: guide.slug, species_name: guide.common_name,
        lookalike_name: lookalike.name, lookalike_slug: lookalike.slug ?? '',
        severity: lookalike.severity, how_to_tell_apart: lookalike.check,
        listed_back: other ? other.lookalikes.some(item => item.slug === guide.slug) : '',
        sources: (guide.sources ?? []).map(source => source.url).join(' '),
        page_url: pageUrl(guide),
      })
    }
  }

  const regionRows = regions.map(region => ({
    slug: region.slug, name: region.name, hemisphere: region.hemisphere, description: region.description,
    west: region.bounds[0], south: region.bounds[1], east: region.bounds[2], north: region.bounds[3],
    page_url: `${SITE}/regions/${region.slug}`,
  }))

  return { species, seasonality, suppressed, lookalikes, regions: regionRows }
}

const COMMON = {
  creator: { '@type': 'Organization', name: 'World Mushroom Foraging', url: `${SITE}/` },
  license: LICENSE_URL,
  isAccessibleForFree: true,
  inLanguage: 'en',
}

export function datasetDefinitions(data, occurrence, date) {
  const columns = rows => Object.keys(rows[0])
  const inat = `Derived from ${INAT_SOURCE}, snapshot ${occurrence.snapshot}. Counts only: no record ids, observers or coordinates. The CC BY 4.0 licence covers this compilation. Underlying observations belong to iNaturalist and its observers under the licences they chose; credit iNaturalist and its observers when you reuse it.`
  return [
    {
      id: 'seasonality', title: 'Mushroom seasonality by species and hemisphere',
      description: `Records per calendar month for each catalogue mushroom, split by hemisphere. A month count is how many research-grade records fall in that month across all years, not a forecast. Hemisphere rows with fewer than ${MIN_RECORDS} records, or species seen by fewer than ${MIN_PEOPLE} people, are left out.`,
      rows: data.seasonality, columns: columns(data.seasonality), notes: inat, source: INAT_SOURCE, snapshot: occurrence.snapshot,
      temporal: occurrence.snapshot, keywords: ['mushroom', 'seasonality', 'phenology', 'foraging', 'iNaturalist'], page: `${SITE}/learn`,
    },
    {
      id: 'lookalikes', title: 'Mushroom lookalike pairs with field checks',
      description: 'Dangerous and harmless lookalikes for each guide, the field check that separates them, and whether the lookalike lists the species back. Severity words are the ones printed on each guide page and are not yet uniform across pairs, so read both pages of a pair. This is study material, not an edibility judgement.',
      rows: data.lookalikes, columns: columns(data.lookalikes), notes: 'Written by the World Mushroom Foraging field desk with cited sources on each species page. Independent expert review is pending.', source: 'World Mushroom Foraging species guides', snapshot: date,
      temporal: date, keywords: ['mushroom', 'lookalike', 'poisonous', 'identification', 'safety'], page: `${SITE}/learn`,
    },
    {
      id: 'species', title: 'Mushroom guide catalogue',
      description: 'The mushroom guides on World Mushroom Foraging with names, iNaturalist taxon ids, season and habitat notes, the printed safety warning, review status and page links. Edibility ratings are deliberately not part of this dataset.',
      rows: data.species, columns: columns(data.species), notes: 'Written by the World Mushroom Foraging field desk. Independent expert review is pending.', source: 'World Mushroom Foraging species guides', snapshot: date,
      temporal: date, keywords: ['mushroom', 'species list', 'taxonomy', 'field guide'], page: `${SITE}/learn`,
    },
    {
      id: 'regions', title: 'Mushroom habitat regions',
      description: 'Ten worldwide habitat regions used for regional seasonality and the 90-day field signal, with bounding boxes (west, south, east, north) and hemisphere.',
      rows: data.regions, columns: columns(data.regions), notes: 'Region boundaries are rectangles for grouping observations, not ecological borders.', source: 'World Mushroom Foraging', snapshot: date,
      temporal: date, keywords: ['mushroom', 'regions', 'habitat'], page: `${SITE}/regions`,
    },
  ]
}

export function datasetJsonLd(definition) {
  const base = `${SITE}/data/${definition.id}`
  return {
    '@type': 'Dataset', '@id': `${SITE}/data#${definition.id}`, name: definition.title,
    description: `${definition.description} ${definition.notes}`, url: `${SITE}/data#${definition.id}`,
    identifier: `${SITE}/data/${definition.id}.json`, keywords: definition.keywords,
    ...COMMON, temporalCoverage: definition.temporal, dateModified: definition.snapshot,
    spatialCoverage: { '@type': 'Place', name: 'Worldwide' },
    isBasedOn: definition.source, creditText: ATTRIBUTION,
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${base}.json` },
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${base}.csv` },
    ],
    includedInDataCatalog: { '@id': `${SITE}/data#catalog` },
  }
}

export function liveDataset() {
  return {
    '@type': 'Dataset', '@id': `${SITE}/data#regional-signal`, name: 'Regional 90-day field signal',
    description: 'For each of ten regions, how many reviewed public observations were found in the last 14 and 90 days, and which species are starting, likely or ending, counted by when each mushroom was found. Species with fewer than three recent records are left out. Live data, aggregated counts only. A map observation is not an identification. Never eat a wild mushroom based on this data.',
    url: `${SITE}/data#regional-signal`, ...COMMON, creditText: ATTRIBUTION,
    spatialCoverage: { '@type': 'Place', name: 'Worldwide' },
    isBasedOn: INAT_SOURCE,
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/api/open-data/regional-signal` }],
    includedInDataCatalog: { '@id': `${SITE}/data#catalog` },
  }
}

export function catalogJsonLd(definitions) {
  return {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'DataCatalog', '@id': `${SITE}/data#catalog`, name: 'World Mushroom Foraging open data',
      description: 'Open mushroom seasonality, lookalike and regional field-signal data, free to reuse with credit.',
      url: `${SITE}/data`, ...COMMON, publisher: { '@id': `${SITE}/#organization` },
      dataset: [...definitions.map(definition => ({ '@id': `${SITE}/data#${definition.id}` })), { '@id': `${SITE}/data#regional-signal` }],
    }, ...definitions.map(datasetJsonLd), liveDataset()],
  }
}

export function catalogIndex(definitions) {
  return {
    name: 'World Mushroom Foraging open data',
    url: `${SITE}/data`,
    license: LICENSE_URL,
    attribution: ATTRIBUTION,
    notice: NOTICE,
    datasets: [...definitions.map(definition => ({
      id: definition.id, title: definition.title, description: definition.description, rows: definition.rows.length,
      snapshot: definition.snapshot, source: definition.source, notes: definition.notes,
      json: `${SITE}/data/${definition.id}.json`, csv: `${SITE}/data/${definition.id}.csv`,
    })), {
      id: 'regional-signal', title: 'Regional 90-day field signal', live: true,
      description: 'Live aggregated counts per region. Species with fewer than three recent records are left out.',
      json: `${SITE}/api/open-data/regional-signal`,
    }],
  }
}

export function datasetFiles(definitions) {
  const files = new Map()
  for (const definition of definitions) {
    files.set(`data/${definition.id}.csv`, csv(definition.rows, definition.columns))
    files.set(`data/${definition.id}.json`, JSON.stringify({
      title: definition.title, description: definition.description, license: LICENSE_URL, attribution: ATTRIBUTION,
      notice: NOTICE, notes: definition.notes, snapshot: definition.snapshot, rows: definition.rows,
    }, null, 1))
  }
  files.set('data/index.json', JSON.stringify(catalogIndex(definitions), null, 1))
  return files
}
