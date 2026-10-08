import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { load } from 'cheerio'

const dist = new URL('../dist/', import.meta.url)
const read = path => readFile(new URL(path, dist), 'utf8')
const origin = 'https://worldmushroomforaging.org'
const NOTICE = 'Never eat a wild mushroom based on this data.'

test('llms.txt stays under 10 KB, topic files under 60 KB, and every linked file exists', async () => {
  const llms = await read('llms.txt')
  assert.ok(Buffer.byteLength(llms) < 10000)
  assert.match(llms, new RegExp(NOTICE.replace('.', '\\.')))
  for (const file of await readdir(new URL('llms/', dist))) assert.ok(Buffer.byteLength(await read(`llms/${file}`)) < 60000, file)
  for (const [, url] of llms.matchAll(/\]\((https:\/\/worldmushroomforaging\.org\/llms\/[^)]+)\)/g)) await read(new URL(url).pathname.slice(1))
})

test('every indexable page has a markdown twin linked from its HTML and carrying the safety notice', async () => {
  const reference = JSON.parse(await read('reference/index.json'))
  for (const page of reference.pages) {
    const pathname = new URL(page.url).pathname
    const twin = pathname === '/' ? 'index.md' : `${pathname.slice(1)}.md`
    const html = load(await read(`${pathname === '/' ? '' : pathname.slice(1)}${pathname === '/' ? 'index.html' : '/index.html'}`))
    assert.equal(html('link[rel="alternate"][type="text/markdown"]').attr('href'), `${origin}/${twin}`, pathname)
    const markdown = await read(twin)
    assert.match(markdown, new RegExp(NOTICE.replace('.', '\\.')), twin)
    assert.match(markdown, new RegExp(`Canonical page: ${page.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), twin)
  }
})

test('species twins carry lookalikes and the warning but no edibility rating', async () => {
  const twin = await read('learn/species/morel.md')
  assert.match(twin, /## Safety warning/)
  assert.match(twin, /## Lookalikes to rule out/)
  assert.doesNotMatch(twin, /Choice edible|edibility/i)
})

test('open data catalog lists CC BY datasets with JSON and CSV that exist, and nothing locational or personal', async () => {
  const catalog = JSON.parse(await read('data/index.json'))
  assert.match(catalog.license, /creativecommons\.org\/licenses\/by\/4\.0/)
  for (const dataset of catalog.datasets.filter(item => !item.live)) {
    const csv = await read(new URL(dataset.csv).pathname.slice(1))
    const json = JSON.parse(await read(new URL(dataset.json).pathname.slice(1)))
    assert.equal(json.rows.length, dataset.rows)
    assert.equal(csv.trim().split('\n').length > dataset.rows, true)
    const columns = csv.split('\n')[0].split(',')
    for (const column of columns) assert.doesNotMatch(column, /^(lat|lon|latitude|longitude|observer|user|email|edibility)$/i, `${dataset.id}.${column}`)
  }
  const seasonality = JSON.parse(await read('data/seasonality.json')).rows
  assert.ok(seasonality.every(row => row.records >= 30 && row.people_all_hemispheres >= 10))
})

test('the /data page has DataCatalog and Dataset JSON-LD in the server HTML', async () => {
  const html = load(await read('data/index.html'))
  const graph = JSON.parse(html('script[type="application/ld+json"]').text())['@graph']
  assert.ok(graph.some(item => item['@type'] === 'DataCatalog'))
  const datasets = graph.filter(item => item['@type'] === 'Dataset')
  assert.ok(datasets.length >= 5)
  for (const dataset of datasets) {
    assert.equal(dataset.license, 'https://creativecommons.org/licenses/by/4.0/')
    assert.ok(dataset.distribution.length >= 1)
  }
  assert.match(html('main').text(), /Never eat a wild mushroom based on this data/)
})

test('robots.txt, api-catalog and the MCP server card are published', async () => {
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8')
  assert.match(robots, /Content-Signal: search=yes, ai-input=yes, ai-train=yes/)
  assert.match(robots, /GPTBot/)
  assert.match(robots, /llms\.txt/)
  const apiCatalog = JSON.parse(await read('.well-known/api-catalog'))
  const anchors = apiCatalog.linkset.map(entry => entry.anchor)
  assert.ok(anchors.includes(`${origin}/mcp`) && anchors.includes(`${origin}/data/index.json`))
  const card = JSON.parse(await read('.well-known/mcp/server-card.json'))
  assert.equal(card.transport.endpoint, `${origin}/mcp`)
  assert.equal(card.authentication.required, false)
})

test('hosting routes /mcp to the function and serves discovery files with the right headers', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.ok(config.rewrites.some(rule => rule.source === '/mcp' && rule.destination === '/api/mcp'))
  assert.ok(config.rewrites.some(rule => rule.source === '/data' && rule.destination === '/data/index.html'))
  const catalogRule = config.headers.find(rule => rule.source === '/.well-known/api-catalog')
  assert.ok(catalogRule.headers.some(header => /linkset\+json/.test(header.value)))
})
