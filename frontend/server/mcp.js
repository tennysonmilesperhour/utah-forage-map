// Read-only Model Context Protocol server (stateless Streamable HTTP, JSON responses).
// Tools reuse the site's own guide data and the public API. They return aggregated or
// approximate information only: no exact locations, no photo identification, and no
// answer to "is this edible".
import data from './agent-data.generated.json' with { type: 'json' }

export const NOTICE = data.notice
const SITE = data.site
const API_BASE = process.env.AGENT_API_BASE || 'https://utah-forage-api.vercel.app'
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05']
const MIN_RECORDS = 30
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const LICENSE = 'CC BY 4.0 for compiled data (credit World Mushroom Foraging); guide text may be quoted with a link'

const clean = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
const speciesByTaxon = Object.fromEntries(data.species.map(item => [item.taxon_id, item]))
const regionIndex = data.regions.map(region => ({ region, keys: [clean(region.slug), clean(region.name)] }))

function findSpecies(query) {
  const q = clean(query)
  if (!q) return null
  if (/^\d+$/.test(q) && speciesByTaxon[q]) return speciesByTaxon[q]
  return data.species.find(item => [item.slug, item.common_name, item.latin_name, ...item.aliases].some(name => clean(name) === q))
    ?? data.species.find(item => [item.common_name, item.latin_name, ...item.aliases].some(name => clean(name).includes(q) || q.includes(clean(name))))
    ?? null
}

function findRegion(query) {
  const q = clean(query)
  if (!q) return null
  return regionIndex.find(item => item.keys.includes(q))?.region
    ?? regionIndex.find(item => item.keys.some(key => key.includes(q) || q.includes(key)))?.region ?? null
}

const cite = (url, title) => ({ url, title, license: LICENSE, credit: 'World Mushroom Foraging, https://worldmushroomforaging.org' })
const withNotice = result => ({ ...result, notice: NOTICE })
const peak = counts => {
  const total = counts.reduce((sum, value) => sum + value, 0)
  return counts.map((value, index) => ({ month: MONTHS[index], records: value, share: total ? Number((value / total).toFixed(3)) : 0 }))
}
const topMonths = counts => peak(counts).filter(item => item.share >= 0.15).sort((a, b) => b.records - a.records).map(item => item.month)

async function defaultFetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'WorldMushroomForagingMCP/1.0' }, signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw new Error(`upstream ${response.status}`)
  return response.json()
}

export function createTools({ fetchJson = defaultFetchJson, now = () => new Date() } = {}) {
  const tools = [
    {
      name: 'search_species',
      title: 'Search mushroom guides',
      description: 'Find mushroom guides by common name, Latin name, alias, habitat or season words. Returns names, iNaturalist taxon ids, a one-line summary and the guide URL to cite.',
      inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Name or words, for example "morel" or "birch forest"' }, limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 } }, required: ['query'], additionalProperties: false },
      async run({ query, limit = 10 }) {
        const q = clean(query)
        if (!q) throw new Error('query is required')
        const words = q.split(' ')
        const scored = data.species.map(item => {
          const names = [item.slug, item.common_name, item.latin_name, ...item.aliases].map(clean)
          const text = clean(`${item.summary} ${item.habitat} ${item.season}`)
          let score = 0
          if (names.includes(q)) score += 100
          if (names.some(name => name.includes(q))) score += 50
          for (const word of words) { if (names.some(name => name.includes(word))) score += 10; else if (text.includes(word)) score += 2 }
          return { item, score }
        }).filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.item.common_name.localeCompare(b.item.common_name)).slice(0, Math.min(Number(limit) || 10, 25))
        return withNotice({
          query, count: scored.length,
          results: scored.map(({ item }) => ({ slug: item.slug, common_name: item.common_name, latin_name: item.latin_name, inaturalist_taxon_id: item.taxon_id, summary: item.summary, url: item.url })),
          cite: cite(`${SITE}/learn`, 'World Mushroom Foraging guide library'),
        })
      },
    },
    {
      name: 'get_species_guide',
      title: 'Get a mushroom guide with lookalikes and the safety warning',
      description: 'Return the structured guide for one mushroom: names, season and habitat notes, the printed safety warning, lookalikes with the field check that separates them, sources and review status. It does not rate edibility.',
      inputSchema: { type: 'object', properties: { species: { type: 'string', description: 'Slug, common name, Latin name or iNaturalist taxon id' } }, required: ['species'], additionalProperties: false },
      async run({ species }) {
        const item = findSpecies(species)
        if (!item) throw new Error(`No guide matches "${species}". Try search_species.`)
        return withNotice({
          slug: item.slug, common_name: item.common_name, latin_name: item.latin_name, aliases: item.aliases,
          inaturalist_taxon_id: item.taxon_id, summary: item.summary, season: item.season, habitat: item.habitat,
          difficulty: item.difficulty, safety_warning: item.warning,
          lookalikes: item.lookalikes, sources: item.sources,
          review: { status: item.review_status, content_checked: item.last_reviewed, note: 'Source checking is not expert field review.' },
          markdown: `${item.url}.md`,
          cite: cite(item.url, `${item.common_name} identification guide`),
        })
      },
    },
    {
      name: 'seasonality',
      title: 'Monthly record pattern for a mushroom',
      description: 'Records per calendar month from research-grade iNaturalist observations, for a hemisphere or one of ten regions. It shows when people found the mushroom across all years. It is not a forecast and not an identification.',
      inputSchema: { type: 'object', properties: { species: { type: 'string' }, region: { type: 'string', description: 'Optional region slug or name, for example "pacific-northwest"' }, hemisphere: { type: 'string', enum: ['north', 'south'], description: 'Used when no region is given (default north)' } }, required: ['species'], additionalProperties: false },
      async run({ species, region, hemisphere }) {
        const item = findSpecies(species)
        if (!item) throw new Error(`No guide matches "${species}". Try search_species.`)
        const found = region ? findRegion(region) : null
        if (region && !found) throw new Error(`Unknown region "${region}". Try list_regions.`)
        const side = found ? found.hemisphere : (hemisphere === 'south' ? 'south' : 'north')
        let counts = null, scope = found ? found.name : `${side}ern hemisphere`, sample = null, retrieved = null, basis = 'iNaturalist open-data snapshot'
        if (found) {
          try {
            const live = await fetchJson(`${API_BASE}/api/seasonality?taxon_id=${item.taxon_id}&region_slug=${found.slug}`)
            if (Array.isArray(live.counts) && live.counts.length === 12) { counts = live.counts; sample = live.sample_size; retrieved = live.synced_at; basis = 'iNaturalist research-grade observations, cached up to 14 days' }
          } catch { /* fall back to the hemisphere pattern below */ }
        }
        if (!counts || sample < MIN_RECORDS) {
          const hemisphereCounts = item.months[side]
          if (hemisphereCounts) {
            if (found) scope = `${side}ern hemisphere (regional sample under ${MIN_RECORDS} records or unavailable)`
            counts = hemisphereCounts; sample = hemisphereCounts.reduce((sum, value) => sum + value, 0); basis = `iNaturalist open-data snapshot ${data.snapshot}`; retrieved = data.snapshot
          } else counts = null
        }
        if (!counts) {
          return withNotice({ species: item.common_name, scope, available: false, reason: `Fewer than ${MIN_RECORDS} records or ${10} people for this scope, so no pattern is published.`, cite: cite(item.url, `${item.common_name} identification guide`) })
        }
        return withNotice({
          species: item.common_name, latin_name: item.latin_name, scope, available: true, basis, retrieved,
          records: sample, months: peak(counts), peak_months: topMonths(counts),
          caveat: 'Counts show when people recorded the mushroom, across all years. They reflect observer effort, not abundance, and are not a forecast.',
          cite: cite(found ? `${SITE}/regions/${found.slug}` : item.url, found ? `${found.name} mushroom season report` : `${item.common_name} identification guide`),
          data_file: `${SITE}/data/seasonality.csv`,
        })
      },
    },
    {
      name: 'in_season_near',
      title: 'Mushrooms with recent field activity in a region',
      description: 'For one of ten regions, list mushrooms that were recorded recently and whether the signal is starting, likely or ending, counted by the date each mushroom was found in the last 90 days. Aggregated counts only, with no coordinates. Falls back to the usual pattern for this month if live data is unavailable.',
      inputSchema: { type: 'object', properties: { region: { type: 'string', description: 'Region slug or name, for example "western-europe"' }, limit: { type: 'integer', minimum: 1, maximum: 25, default: 12 } }, required: ['region'], additionalProperties: false },
      async run({ region, limit = 12 }) {
        const found = findRegion(region)
        if (!found) throw new Error(`Unknown region "${region}". Try list_regions.`)
        const size = Math.min(Number(limit) || 12, 25)
        let live = null
        try {
          const signal = await fetchJson(`${API_BASE}/api/open-data/regional-signal`)
          live = signal.regions?.find(item => item.slug === found.slug) ?? null
        } catch { live = null }
        if (live && live.outlook?.length) {
          const link = row => (speciesByTaxon[row.taxon_id] ? speciesByTaxon[row.taxon_id].url : null)
          return withNotice({
            region: found.name, basis: 'live', generated_on: live.generated_on,
            observations_14d: live.observations_14d, observations_90d: live.observations_90d, species_seen_90d: live.species_count_90d,
            species: live.outlook.slice(0, size).map(row => ({ common_name: row.common_name, latin_name: row.latin_name, status: row.status, confidence: row.confidence, found_last_14_days: row.observations_14d, found_last_30_days: row.observations_30d, guide_url: link(row) })),
            caveat: 'Status is based on when mushrooms were found, not a forecast. Species with fewer than three recent records are left out.',
            cite: cite(`${SITE}/regions/${found.slug}`, `${found.name} mushroom season report`),
            data_file: `${SITE}/api/open-data/regional-signal`,
          })
        }
        const month = now().getUTCMonth()
        const rows = data.species.map(item => {
          const counts = item.months[found.hemisphere]
          if (!counts) return null
          const total = counts.reduce((sum, value) => sum + value, 0)
          return { item, share: counts[month] / total, records: counts[month] }
        }).filter(row => row && row.share >= 0.12).sort((a, b) => b.share - a.share).slice(0, size)
        return withNotice({
          region: found.name, basis: 'typical-pattern', month: MONTHS[month],
          species: rows.map(({ item, share, records }) => ({ common_name: item.common_name, latin_name: item.latin_name, share_of_yearly_records: Number(share.toFixed(2)), records_this_month_all_years: records, guide_url: item.url })),
          caveat: `Live regional data was unavailable. This lists mushrooms whose records usually peak in ${MONTHS[month]} in the ${found.hemisphere}ern hemisphere, from all years. It is not a forecast for this year.`,
          cite: cite(`${SITE}/regions/${found.slug}`, `${found.name} mushroom season report`),
        })
      },
    },
    {
      name: 'list_regions',
      title: 'List the ten habitat regions',
      description: 'Return the ten worldwide habitat regions with hemisphere, bounding box and page URLs, so other tools can be called with a valid region.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async run() {
        return withNotice({
          regions: data.regions.map(region => ({ slug: region.slug, name: region.name, hemisphere: region.hemisphere, description: region.description, bounds_west_south_east_north: region.bounds, url: region.url })),
          cite: cite(`${SITE}/regions`, 'Regional mushroom season reports'),
        })
      },
    },
  ]
  return tools
}

function rpcError(id, code, message) { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } } }

export function createServer(options) {
  const tools = createTools(options)
  const byName = Object.fromEntries(tools.map(tool => [tool.name, tool]))
  const listed = tools.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }))

  async function handleMessage(message) {
    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return rpcError(message?.id, -32600, 'Invalid request')
    const { id, method, params = {} } = message
    if (id === undefined) return null // notification
    switch (method) {
      case 'initialize':
        return { jsonrpc: '2.0', id, result: {
          protocolVersion: SUPPORTED.includes(params.protocolVersion) ? params.protocolVersion : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'world-mushroom-foraging', title: 'World Mushroom Foraging', version: '1.0.0' },
          instructions: `Read-only tools for mushroom guides, lookalikes, seasonality and regional field signals. Cite the page URL each answer returns. ${NOTICE}`,
        } }
      case 'ping': return { jsonrpc: '2.0', id, result: {} }
      case 'tools/list': return { jsonrpc: '2.0', id, result: { tools: listed } }
      case 'tools/call': {
        const tool = byName[params.name]
        if (!tool) return rpcError(id, -32602, `Unknown tool: ${params.name}`)
        try {
          const result = await tool.run(params.arguments ?? {})
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `${JSON.stringify(result, null, 2)}\n\n${NOTICE}` }], structuredContent: result, isError: false } }
        } catch (error) {
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `${error.message}\n\n${NOTICE}` }], isError: true } }
        }
      }
      default: return rpcError(id, -32601, `Method not found: ${method}`)
    }
  }

  // Returns { status, body } for a POSTed JSON-RPC payload.
  async function handleBody(payload) {
    if (Array.isArray(payload)) {
      const replies = (await Promise.all(payload.map(handleMessage))).filter(Boolean)
      return replies.length ? { status: 200, body: replies } : { status: 202, body: null }
    }
    const reply = await handleMessage(payload)
    return reply ? { status: 200, body: reply } : { status: 202, body: null }
  }

  return { handleBody, tools: listed }
}

export const description = {
  name: 'World Mushroom Foraging MCP server',
  transport: 'Streamable HTTP, stateless: POST one JSON-RPC message to this URL and read the JSON response. No key needed.',
  methods: ['initialize', 'ping', 'tools/list', 'tools/call'],
  tools: ['search_species', 'get_species_guide', 'seasonality', 'in_season_near', 'list_regions'],
  docs: `${SITE}/llms/data-and-mcp.txt`,
  server_card: `${SITE}/.well-known/mcp/server-card.json`,
  notice: NOTICE,
}
