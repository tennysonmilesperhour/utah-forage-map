import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { load } from 'cheerio'
const dist = new URL('../dist/', import.meta.url)
const origin = 'https://worldmushroomforaging.org'
const reference = JSON.parse(await readFile(new URL('reference/index.json', dist), 'utf8'))
const pages = new Map(await Promise.all(reference.pages.map(async page => [new URL(page.url).pathname, load(await readFile(new URL(`${new URL(page.url).pathname.slice(1)}${page.url.endsWith('/') ? '' : '/'}index.html`, dist), 'utf8'))])))

test('the home page serves the fungi library and the map has its own canonical page', () => {
  const home = pages.get('/')
  const map = pages.get('/map')
  assert.ok(home && map)
  assert.match(home('title').text(), /Fungi Library/)
  assert.ok(home('.learn-hero').length)
  assert.equal(home('.guide-species-card').length, 30)
  assert.equal(home('.collection-nav a[aria-current="page"]').text().trim(), 'Library')
  assert.ok(home('a[href="/map"]').length)
  assert.ok(map('.map-stage').length)
  assert.equal(map('.collection-nav a[aria-current="page"]').text().trim(), 'Field map')
  assert.equal(map('link[rel="canonical"]').attr('href'), origin + '/map')
  assert.ok(!pages.has('/learn'))
  assert.equal(reference.pages.find(page => page.url === origin + '/').text, origin + '/reference/library.md')
  assert.equal(reference.pages.find(page => page.url === origin + '/map').text, origin + '/reference/map.md')
})

test('every canonical page has readable HTML, unique metadata, one canonical, and valid structured data', () => {
  const titles = new Set()
  for (const [path, $] of pages) {
    assert.ok($('#root').text().trim().length > 150, `${path}: empty initial content`)
    assert.ok($('h1').length >= 1, `${path}: missing h1`)
    const title = $('title').text()
    assert.ok(title.length > 15 && !titles.has(title), `${path}: duplicate or empty title`)
    titles.add(title)
    assert.ok($('meta[name="description"]').attr('content')?.length > 40, path)
    assert.equal($('link[rel="canonical"]').length, 1, path)
    assert.equal($('link[rel="canonical"]').attr('href'), origin + path, path)
    assert.ok(!$('meta[name="robots"]').attr('content').includes('noindex'), path)
    assert.ok($('meta[property="og:image"]').attr('content')?.startsWith('https://'), `${path}: missing share image`)
    assert.equal($('script[type="application/ld+json"]').length, 1, path)
    const graph = JSON.parse($('script[type="application/ld+json"]').text())['@graph']
    assert.ok(graph.some(item => item['@id'] === `${origin}/#organization`), `${path}: undefined publisher`)
    for (const article of graph.filter(item => item['@type'] === 'Article')) {
      assert.ok(article.citation?.length, `${path}: no article citations`)
      for (const citation of article.citation) assert.ok($(`a[href="${citation}"]`).length, `${path}: citation is not visible: ${citation}`)
    }
  }
})

test('internal content links and section anchors resolve', async () => {
  const errors = new Set()
  for (const [path, $] of pages) {
    for (const link of $('a[href]').toArray()) {
      const href = $(link).attr('href')
      const url = new URL(href, origin + path)
      if (url.origin !== origin || url.pathname.startsWith('/api/')) continue
      const target = pages.get(url.pathname)
      if (target) {
        if (url.hash && !target(`[id="${decodeURIComponent(url.hash.slice(1))}"]`).length) errors.add(`${path}: missing anchor ${href}`)
      } else if (!['/account', '/herbs/atlas/compare'].includes(url.pathname)) {
        try { await access(new URL(url.pathname.slice(1), dist)) } catch { errors.add(`${path}: missing ${href}`) }
      }
    }
  }
  assert.deepEqual([...errors], [])
})

test('sitemaps list exactly the canonical pages and exclude private and comparison pages', async () => {
  const index = load(await readFile(new URL('sitemap.xml', dist), 'utf8'), { xmlMode: true })
  const urls = []
  for (const loc of index('loc').toArray()) {
    const xml = load(await readFile(new URL(new URL(index(loc).text()).pathname.slice(1), dist), 'utf8'), { xmlMode: true })
    urls.push(...xml('url > loc').toArray().map(element => xml(element).text()))
  }
  assert.equal(new Set(urls).size, urls.length)
  assert.deepEqual(urls.sort(), reference.pages.map(page => page.url).sort())
  assert.ok(!urls.some(url => /account|compare/.test(url)))
})

test('discovery files are text and unknown routes have an explicit 404 document', async () => {
  assert.match(await readFile(new URL('llms.txt', dist), 'utf8'), /^# Mushroom/)
  const notFound = load(await readFile(new URL('404.html', dist), 'utf8'))
  assert.match(notFound('meta[name="robots"]').attr('content'), /noindex/)
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.ok(!config.rewrites.some(rule => rule.source === '/:path*'))
  assert.ok(config.headers.some(rule => rule.source === '/account' && rule.headers.some(header => /noindex/.test(header.value))))
})

test('page styles and route modules load without a JavaScript discovery waterfall', () => {
  for (const [path, $] of pages) {
    assert.ok($('link[rel="modulepreload"]').length > 0, path)
    assert.ok($('link[rel="stylesheet"]').length > 1, path)
  }
})

test('public query snapshots contain only approved public keys and preserve retrieval timestamps', () => {
  for (const [path, $] of pages) {
    const snapshot = $('#public-query-snapshot').text()
    if (!snapshot) continue // Upstream availability does not determine build success.
    for (const entry of JSON.parse(snapshot)) {
      assert.ok(['guide-species-summaries', 'regions', 'region'].includes(entry.key[0]), path)
      assert.ok(entry.updatedAt > 0, path)
      assert.ok(!JSON.stringify(entry).includes('password'), path)
    }
  }
})
