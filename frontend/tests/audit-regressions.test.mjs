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
  assert.equal(front.filter(p => p.status !== 'toxic').length, 37)
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
  assert.equal(new Set(coverage.map(p => p.key)).size, 74)
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
