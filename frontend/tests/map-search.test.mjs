import test from 'node:test'
import assert from 'node:assert/strict'
import { canLoadSightings } from '../src/lib/mapSearch.js'

test('the opening map does not request sightings before an area is selected', () => {
  assert.equal(canLoadSightings({ areaSelected: false, mapSettled: true }), false)
  assert.equal(canLoadSightings({ areaSelected: false, mapSettled: false }), false)
})

test('a selected map area waits until its camera settles', () => {
  assert.equal(canLoadSightings({ areaSelected: true, mapSettled: false }), false)
  assert.equal(canLoadSightings({ areaSelected: true, mapSettled: true }), true)
})

test('a deliberate region link can load its bounded list view on mobile once selected', () => {
  assert.equal(canLoadSightings({ areaSelected: true, mapSettled: true }), true)
  assert.equal(canLoadSightings({ areaSelected: true, mapSettled: false }), false)
})
