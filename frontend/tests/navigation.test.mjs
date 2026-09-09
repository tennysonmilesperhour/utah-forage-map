import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { FUNGI_HOME, FUNGI_MAP, LEGACY_MAP_PARAMS, legacyFungiRedirect } from '../src/lib/navigation.js'

test('legacy map bookmarks retain filters, encoded tokens and fragments', () => {
  for (const key of LEGACY_MAP_PARAMS) {
    const query = `?${key}=value%3Aone%2Btwo&region=rocky-mountains&utm_source=bulletin`
    assert.equal(legacyFungiRedirect('/', query, '#record'), `/map${query}#record`)
    assert.equal(legacyFungiRedirect('/map', query), null)
  }
  assert.equal(legacyFungiRedirect('/'), null)
  assert.equal(legacyFungiRedirect('/', '?utm_source=search'), null)
  assert.equal(legacyFungiRedirect('/herbs', '?region=europe'), null)
  assert.equal(legacyFungiRedirect('/account', '?tab=alerts'), null)
})

test('the former archive redirects home without redirecting species or skills', () => {
  assert.equal(legacyFungiRedirect('/learn', '?utm_source=old-link', '#browse-species'), '/?utm_source=old-link#browse-species')
  assert.equal(legacyFungiRedirect('/learn/'), '/')
  assert.equal(legacyFungiRedirect('/learn/species/oyster-mushroom'), null)
  assert.equal(legacyFungiRedirect('/learn/foraging'), null)
})

test('deployment redirects and rewrites preserve the same entry points', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.ok(config.redirects.some(rule => rule.source === '/learn' && rule.destination === FUNGI_HOME && rule.permanent))
  for (const key of LEGACY_MAP_PARAMS) assert.ok(config.redirects.some(rule => rule.source === FUNGI_HOME && rule.destination === FUNGI_MAP && rule.has?.some(condition => condition.type === 'query' && condition.key === key)), key)
  assert.ok(config.rewrites.some(rule => rule.source === FUNGI_MAP && rule.destination === '/map/index.html'))
  assert.ok(config.rewrites.some(rule => rule.source === '/account' && rule.destination === '/map/index.html'))
  assert.ok(!config.redirects.some(rule => rule.source === '/' && !rule.has))
})
