import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldFetchGuideSummaries } from '../src/hooks/useGuide.js'

test('static guide pages do not request the live catalogue summary', () => {
  for (const path of ['/about', '/privacy', '/terms', '/disclaimer', '/data', '/regions', '/learn/foraging']) {
    assert.equal(shouldFetchGuideSummaries(path), false, path)
  }
})

test('the library and known species pages request guide summaries', () => {
  assert.equal(shouldFetchGuideSummaries('/'), true)
  assert.equal(shouldFetchGuideSummaries('/learn/'), true)
  assert.equal(shouldFetchGuideSummaries('/learn/species/morel', true), true)
  assert.equal(shouldFetchGuideSummaries('/learn/species/not-in-catalogue', false), false)
})
