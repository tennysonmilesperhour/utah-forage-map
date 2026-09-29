import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { hemisphereForBounds } from '../src/lib/seasonScope.js'
import { herbHref, herbNavigation, fungiNavigation } from '../src/lib/navigation.js'
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))

test('equatorial and unknown visitors never silently inherit northern seasonality', () => {
  assert.equal(hemisphereForBounds([-10, 40, 10, 60]), 'north')
  assert.equal(hemisphereForBounds([110, -40, 155, -10]), 'south')
  for (const value of [null, [], [-80, -20, -40, 10]]) assert.equal(hemisphereForBounds(value), null)
})
test('pantry catalogue uses atlas identifiers and excludes toxic references on both sides', async () => {
  const atlas = await json('../src/data/herb-guide.json')
  const front = await json('../src/data/companion-plants.json')
  const back = await json('../../backend/app/data/companion-plants.json')
  assert.deepEqual(front, back)
  assert.deepEqual(front.map(p => p.slug), atlas.map(p => p.slug))
  assert.equal(front.filter(p => p.status !== 'toxic').length, 93)
})
test('collection navigation has five stable destinations and public gathering route', () => {
  assert.equal(herbNavigation.length, 5)
  assert.equal(fungiNavigation.length, 5)
  assert.equal(herbHref('practice'), '/herbs/gathering-ways')
  assert.equal(herbNavigation.at(-1).key, 'workspace')
})
test('published specialist reviews require a named reviewer, scope and evidence', async () => {
  const reviews = await json('../src/data/editorialReviews.json')
  const coverage = await json('../src/data/editorialCoverage.json')
  assert.equal(new Set(coverage.map(p => p.key)).size, 221)
  for (const [key, review] of Object.entries(reviews)) {
    assert.ok(coverage.some(p => p.key === key))
    for (const field of ['reviewer', 'credentials', 'date', 'scope', 'evidence']) assert.ok(review[field]?.trim(), `${key}: missing ${field}`)
    assert.match(review.date, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(review.evidence, /^https:\/\//)
  }
})


test('custom analytics stays consent-gated and excludes arbitrary private fields', async () => {
  const { Script, createContext } = await import('node:vm')
  const source = (await readFile(new URL('../src/lib/googleTag.js', import.meta.url), 'utf8')).replaceAll('export ', '').replaceAll('import.meta.env', '({ VITE_GA_MEASUREMENT_ID: "G-TEST" })')
  let consent = 'denied'
  const context = createContext({ URL, window: { location: { pathname: '/herbs/atlas/nettle?secret=value#private', origin: 'https://test.example' }, localStorage: { getItem: () => consent } } })
  new Script(source).runInContext(context)
  new Script('trackFieldEvent("guide_to_map", "herbs")').runInContext(context)
  assert.equal(context.window.dataLayer, undefined)
  consent = 'granted'
  new Script('trackFieldEvent("guide_to_map", "herbs", {notes:"secret",latitude:1}); trackFieldEvent("private_note", "herbs"); trackFieldEvent("map_retry", "private-person")').runInContext(context)
  assert.equal(context.window.dataLayer.length, 1)
  const event = context.window.dataLayer[0]
  assert.equal(event[1], 'guide_to_map')
  assert.deepEqual(Object.keys(event[2]).sort(), ['collection','page_path','send_to'])
  assert.equal(event[2].page_path, '/herbs/atlas/nettle')
  consent = 'denied'
  new Script('trackFieldEvent("map_retry", "fungi")').runInContext(context)
  assert.equal(context.window.dataLayer.length, 1)
})
test('signed-in sessions read as a browser and system, not a raw user agent', async () => {
  const { deviceLabel } = await import('../src/lib/deviceLabel.js')
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0'), 'Edge on Windows')
  assert.equal(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), 'Safari on iOS')
  assert.equal(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'), 'Chrome on macOS')
  assert.equal(deviceLabel('Mozilla/5.0 (Android 15; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0'), 'Firefox on Android')
  assert.equal(deviceLabel(''), 'Unknown browser')
})
test('backdrop blurs survive minification in every browser', async () => {
  // The CSS minifier keeps only the prefixed copy when `backdrop-filter` comes first,
  // which silently removes the blur in Chrome and Firefox. The prefixed line must lead.
  const { readdir } = await import('node:fs/promises')
  const files = (await readdir(new URL('../src/', import.meta.url))).filter(name => name.endsWith('.css'))
  for (const file of files) {
    const css = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(css, /(?<![-\w])backdrop-filter\s*:[^;}]+;\s*-webkit-backdrop-filter/, file)
  }
})
