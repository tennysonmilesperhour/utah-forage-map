import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, NOTICE } from '../server/mcp.js'

const regional = { regions: [{ slug: 'pacific-northwest', generated_on: '2026-10-07', observations_14d: 40, observations_90d: 300, species_count_90d: 20, outlook: [{ taxon_id: 58682, common_name: 'Morel', latin_name: 'Morchella esculenta', status: 'likely', confidence: 'high', observations_14d: 9, observations_30d: 12, previous_30d: 4 }] }] }
const fetchJson = async url => {
  if (url.includes('regional-signal')) return regional
  if (url.includes('/api/seasonality')) return { counts: [0, 0, 5, 50, 80, 20, 0, 0, 0, 0, 0, 0], sample_size: 155, synced_at: '2026-10-01T00:00:00' }
  throw new Error('unexpected')
}
const server = createServer({ fetchJson, now: () => new Date('2026-10-07T00:00:00Z') })
const rpc = async (method, params, id = 1) => (await server.handleBody({ jsonrpc: '2.0', id, method, params })).body
const call = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result

test('initialize, ping and tools/list follow the protocol; notifications get 202', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18' })
  assert.equal(init.result.protocolVersion, '2025-06-18')
  assert.deepEqual((await rpc('ping')).result, {})
  const list = (await rpc('tools/list')).result.tools
  assert.deepEqual(list.map(tool => tool.name), ['search_species', 'get_species_guide', 'seasonality', 'in_season_near', 'list_regions'])
  assert.ok(list.every(tool => tool.annotations.readOnlyHint))
  assert.equal((await server.handleBody({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202)
  assert.equal((await rpc('nope')).error.code, -32601)
})

test('every tool answer carries the safety notice and a page URL to cite', async () => {
  const calls = [
    ['search_species', { query: 'morel' }], ['get_species_guide', { species: 'morel' }],
    ['seasonality', { species: 'morel' }], ['seasonality', { species: 'morel', region: 'pacific northwest' }],
    ['in_season_near', { region: 'pacific-northwest' }], ['list_regions', {}],
  ]
  for (const [name, args] of calls) {
    const result = await call(name, args)
    assert.equal(result.isError, false, name)
    assert.equal(result.structuredContent.notice, NOTICE, name)
    assert.match(result.content[0].text, /Never eat a wild mushroom based on this data\./, name)
    assert.match(result.structuredContent.cite.url, /^https:\/\/worldmushroomforaging\.org\//, name)
  }
})

test('species guide includes lookalikes and the warning but no edibility rating', async () => {
  const { structuredContent } = await call('get_species_guide', { species: 'Morchella esculenta' })
  assert.ok(structuredContent.safety_warning)
  assert.ok(structuredContent.lookalikes.some(item => item.name === 'False Morel'))
  assert.ok(!JSON.stringify(structuredContent).toLowerCase().includes('edibility'))
  assert.ok(!('edibility' in structuredContent))
})

test('regional seasonality prefers live data and in_season_near returns aggregates only', async () => {
  const season = (await call('seasonality', { species: 'morel', region: 'pacific-northwest' })).structuredContent
  assert.equal(season.records, 155)
  assert.deepEqual(season.peak_months, ['May', 'April'])
  const near = (await call('in_season_near', { region: 'pacific-northwest' })).structuredContent
  assert.equal(near.basis, 'live')
  assert.ok(!/latitude|longitude|coordinates/.test(JSON.stringify(near.species)))
})

test('tools fall back to static data when the API is down and reject unknown input', async () => {
  const offline = createServer({ fetchJson: async () => { throw new Error('down') }, now: () => new Date('2026-04-15T00:00:00Z') })
  const reply = await offline.handleBody({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'in_season_near', arguments: { region: 'rocky mountains' } } })
  assert.equal(reply.body.result.structuredContent.basis, 'typical-pattern')
  assert.ok(reply.body.result.structuredContent.species.length > 0)
  assert.equal((await call('get_species_guide', { species: 'zzz-not-real' })).isError, true)
  assert.equal((await call('in_season_near', { region: 'mars' })).isError, true)
})

test('bot classifier logs known bots and agent-file fetches but never ordinary browsers', async () => {
  const { classify } = await import('../server/agent-bots.js')
  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
  assert.deepEqual(classify('Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2; +https://openai.com/gptbot)', '/learn/species/morel'), { agent: 'GPTBot', kind: 'training' })
  assert.deepEqual(classify('Mozilla/5.0 (compatible; ChatGPT-User/1.0)', '/mcp'), { agent: 'ChatGPT-User', kind: 'assistant' })
  assert.deepEqual(classify('python-httpx/0.28.1', '/data/index.json'), { agent: 'python-httpx', kind: 'tool' })
  assert.deepEqual(classify('SomethingNew/1.0', '/llms.txt'), { agent: 'unknown', kind: 'tool' })
  assert.equal(classify(chrome, '/llms.txt'), null)
  assert.equal(classify(chrome, '/learn/species/morel'), null)
  assert.equal(classify('python-httpx/0.28.1', '/learn/species/morel'), null)
  assert.equal(classify('GPTBot/1.2', '/assets/index-abc.js'), null)
  assert.equal(classify('', '/mcp').agent, 'unknown')
})

test('middleware posts a log row for a bot, skips browsers and adds the canonical Link to markdown twins', async () => {
  process.env.AGENT_LOG_SECRET = 'secret'
  const posted = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => { posted.push({ url, init }); return new Response(null, { status: 204 }) }
  try {
    const { default: middleware } = await import('../middleware.js')
    const pending = []
    const context = { waitUntil: promise => pending.push(promise) }
    const bot = new Request('https://worldmushroomforaging.org/learn/species/morel.md', { headers: { 'user-agent': 'ClaudeBot/1.0' } })
    const response = middleware(bot, context)
    await Promise.all(pending)
    assert.equal(posted.length, 1)
    assert.equal(JSON.parse(posted[0].init.body).agent, 'ClaudeBot')
    assert.equal(posted[0].init.headers['X-Agent-Log-Key'], 'secret')
    assert.equal(response.headers.get('link'), '<https://worldmushroomforaging.org/learn/species/morel>; rel="canonical"')
    middleware(new Request('https://worldmushroomforaging.org/', { headers: { 'user-agent': 'Mozilla/5.0 Chrome/130 Safari/537.36' } }), context)
    assert.equal(posted.length, 1)
  } finally {
    globalThis.fetch = realFetch
    delete process.env.AGENT_LOG_SECRET
  }
})
