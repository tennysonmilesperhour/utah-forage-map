// Weekly agent-access export. Reads the AI traffic summary (when a service credential is present),
// checks the live data files and the MCP server, prunes old log rows, and writes
// docs/agent-review/YYYY-MM-DD.json. Run from the repo root: node frontend/scripts/agent-review.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SITE = process.env.SITE_URL || 'https://worldmushroomforaging.org'
const SECRET = process.env.CRON_SECRET
const DAYS = Number(process.env.REVIEW_DAYS || 7)
const RETENTION_DAYS = 180
const date = new Date().toISOString().slice(0, 10)
const NOTICE = 'Never eat a wild mushroom based on this data.'

async function request(url, options = {}) {
  const started = Date.now()
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) })
    return { ok: response.ok, status: response.status, ms: Date.now() - started, response }
  } catch (error) {
    return { ok: false, status: 0, ms: Date.now() - started, error: String(error.message || error) }
  }
}

const authorised = { headers: { Authorization: `Bearer ${SECRET}` } }
const report = { date, site: SITE, days: DAYS, traffic: null, prune: null, checks: {} }

// 1. Traffic summary and prune (service credential only)
if (!SECRET) {
  report.traffic = { available: false, reason: 'CRON_SECRET is not set for this run' }
  report.prune = { skipped: true }
} else {
  const summary = await request(`${SITE}/api/admin/agent-traffic?days=${DAYS}`, authorised)
  report.traffic = summary.ok ? { available: true, ...(await summary.response.json()) } : { available: false, status: summary.status, reason: summary.error || 'summary request failed' }
  const longer = await request(`${SITE}/api/admin/agent-traffic?days=28`, authorised)
  report.traffic_28d = longer.ok ? await longer.response.json() : null
  const prune = await request(`${SITE}/api/admin/agent-traffic/prune?older_than_days=${RETENTION_DAYS}`, { ...authorised, method: 'POST' })
  report.prune = prune.ok ? await prune.response.json() : { skipped: true, status: prune.status }
}

// 2. Live data files
const catalogResult = await request(`${SITE}/data/index.json`)
const datasets = []
if (catalogResult.ok) {
  const catalog = await catalogResult.response.json()
  for (const dataset of catalog.datasets) {
    for (const format of ['json', 'csv']) {
      if (!dataset[format]) continue
      const result = await request(dataset[format])
      let rows = null
      if (result.ok && format === 'json' && dataset.id !== 'regional-signal') rows = (await result.response.json()).rows?.length ?? null
      datasets.push({ id: dataset.id, format, status: result.status, ms: result.ms, rows, expected_rows: dataset.rows ?? null })
    }
  }
}
report.checks.catalog = { status: catalogResult.status, datasets }
for (const file of ['/llms.txt', '/robots.txt', '/.well-known/api-catalog', '/.well-known/mcp/server-card.json', '/learn/species/morel.md', '/data']) {
  const result = await request(`${SITE}${file}`)
  const check = { status: result.status, ms: result.ms }
  if (result.ok && file.endsWith('.md')) check.canonical_link = result.response.headers.get('link')
  if (result.ok && file === '/llms.txt') check.bytes = (await result.response.text()).length
  report.checks[file] = check
}

// 3. MCP server
const rpc = async (id, method, params) => {
  const result = await request(`${SITE}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'agent-review-action/1.0' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) })
  return { result, body: result.ok ? await result.response.json() : null }
}
const mcp = { initialize: null, tools: [], calls: [] }
const init = await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'agent-review', version: '1.0' } })
mcp.initialize = { status: init.result.status, ok: Boolean(init.body?.result?.serverInfo) }
const list = await rpc(2, 'tools/list')
mcp.tools = list.body?.result?.tools?.map(tool => tool.name) ?? []
for (const [name, args] of [['search_species', { query: 'morel' }], ['get_species_guide', { species: 'morel' }], ['seasonality', { species: 'morel', region: 'pacific-northwest' }], ['in_season_near', { region: 'western-europe' }], ['list_regions', {}]]) {
  const call = await rpc(10, 'tools/call', { name, arguments: args })
  const text = call.body?.result?.content?.[0]?.text ?? ''
  mcp.calls.push({ tool: name, status: call.result.status, ms: call.result.ms, is_error: call.body?.result?.isError ?? null, has_notice: text.includes(NOTICE), has_cite_url: /"url": "https:\/\/worldmushroomforaging\.org\//.test(text) })
}
report.checks.mcp = mcp

report.problems = [
  ...(!catalogResult.ok ? ['data catalog unreachable'] : []),
  ...datasets.filter(item => item.status !== 200).map(item => `dataset ${item.id}.${item.format} returned ${item.status}`),
  ...datasets.filter(item => item.rows != null && item.expected_rows != null && item.rows !== item.expected_rows).map(item => `dataset ${item.id} row count differs from catalog`),
  ...Object.entries(report.checks).filter(([key, value]) => key.startsWith('/') && value.status !== 200).map(([key, value]) => `${key} returned ${value.status}`),
  ...(!mcp.initialize.ok ? ['mcp initialize failed'] : []),
  ...mcp.calls.filter(call => call.status !== 200 || call.is_error || !call.has_notice).map(call => `mcp tool ${call.tool} failed or lacks the safety notice`),
  ...(report.checks['/learn/species/morel.md']?.canonical_link ? [] : ['markdown twin has no canonical Link header']),
]

const directory = path.join(process.cwd(), 'docs', 'agent-review')
await mkdir(directory, { recursive: true })
const file = path.join(directory, `${date}.json`)
await writeFile(file, `${JSON.stringify(report, null, 2)}\n`)
console.log(`Wrote ${path.relative(process.cwd(), file)} with ${report.problems.length} problem(s).`)
for (const problem of report.problems) console.log(`- ${problem}`)
