import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { cellAt, decodeCells, geometryBounds, GRID_LEVELS, intensityScale, levelForZoom, monthRangeLabel, peakMonths, prepareDataset, squaresGeoJSON } from '../src/lib/occurrenceGrid.js'
import { matchMarks, nearbyEvidence, rankSuggestions, seasonSignal, tilesForLocation } from '../src/lib/identify.js'
import { fitWithin, photoSignals } from '../src/lib/photoId.js'
import { markGroups } from '../src/data/fieldMarks.js'
import { herbGuides } from '../src/data/herbGuide.js'

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const fungiSlugs = (await readdir(new URL('../content/species/', import.meta.url))).filter(file => file.endsWith('.md')).map(file => file.replace(/^\d+-/, '').replace(/\.md$/, ''))

test('squares shrink as the map zooms in, so one bubble never splits into ten', () => {
  const sizes = [0, 1, 2, 3, 4, 5, 6, 7, 9, 12].map(zoom => levelForZoom(zoom))
  for (let index = 1; index < sizes.length; index += 1) assert.ok(sizes[index] <= sizes[index - 1], `zoom step ${index}`)
  assert.equal(sizes[0], GRID_LEVELS[0])
  assert.equal(sizes.at(-1), GRID_LEVELS.at(-1))
  assert.equal(levelForZoom(3, [4, 2]), 2, 'falls back to the finest available level')
})

test('cells decode, index and draw as closed squares, clipped to the view', () => {
  const cells = decodeCells([10, 20, 5, 3, 11, 20, 1, 1])
  assert.deepEqual(cells[0], { x: 10, y: 20, count: 5, observers: 3 })
  assert.deepEqual(cellAt(-179.9, -89.9, 1), { x: 0, y: 0 })
  const level = { res: 0.5, cells: [0, 0, 1, 1, 719, 179, 9, 4] }
  const all = squaresGeoJSON(level)
  assert.equal(all.features.length, 2)
  const ring = all.features[0].geometry.coordinates[0]
  assert.deepEqual(ring[0], ring.at(-1))
  assert.deepEqual(ring[0], [-180, -90])
  // A view that crosses the date line keeps the square at the far east edge.
  const east = squaresGeoJSON(level, { west: 170, east: -170, south: -5, north: 85 })
  assert.equal(east.features.length, 1)
  assert.equal(east.features[0].properties.observers, 4)
  assert.equal(squaresGeoJSON(null).features.length, 0)
})

test('intensity follows people, is capped, and never hides a square entirely', () => {
  const scale = intensityScale([1, 1, 2, 3, 500].map(observers => ({ observers })))
  assert.ok(scale(1) > 0 && scale(1) < scale(3))
  assert.equal(scale(10_000), 1)
  assert.ok(scale(0) >= 0.08)
})

test('month summaries name the busy season, including one that wraps the year', () => {
  assert.deepEqual(peakMonths([0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 5, 0]), [8, 9], 'stops once 60% of records are covered')
  assert.deepEqual(peakMonths([0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 5, 0], 0.9), [8, 9, 10])
  assert.equal(monthRangeLabel([8, 9, 10]), 'Sep–Nov')
  assert.equal(monthRangeLabel([0, 1, 11]), 'Dec–Feb')
  assert.equal(monthRangeLabel([]), 'Not enough dated records')
  assert.deepEqual(geometryBounds({ type: 'MultiPolygon', coordinates: [[[[-10, 5], [20, 5], [20, 40], [-10, 5]]]] }), [-10, 5, 20, 40])
})

test('ID suggestions stay local, respect field marks, and rank people seen nearby', () => {
  const index = { tile: 30, species: ['a', 'b', 'c'], tiles: ['6_4'] }
  assert.deepEqual(tilesForLocation(index, 40.5, 0.5), ['6_4'])
  const tile = { cells: { '180_130': { s: [[0, 12], [1, 1]], e: [0, 2] } } }
  const evidence = nearbyEvidence(index, [tile], 40.5, 0.5)
  assert.equal(evidence.seen.get('a'), 12)
  assert.ok(evidence.expected.has('c'))
  const candidates = ['a', 'b', 'c', 'd'].map(slug => ({ slug, name: slug.toUpperCase() }))
  const traits = { a: { underside: ['gills'] }, b: { underside: ['gills'] }, c: { underside: ['pores'] }, d: { underside: ['gills'] } }
  const months = Array.from({ length: 12 }, (_, month) => month === 9 ? 40 : 0)
  const summaries = { a: { months: { north: months } }, b: { months: { north: months } }, c: { months: { north: months } } }
  const ranked = rankSuggestions({ candidates, traits, selected: { underside: 'gills' }, evidence, month: 9, hemisphere: 'north', summaries })
  assert.deepEqual(ranked.map(item => item.slug), ['a', 'b'], 'd is not recorded or expected nearby; c has pores')
  assert.equal(ranked[0].seenPeople, 12)
  assert.equal(seasonSignal(months, 9), true)
  assert.equal(seasonSignal(months, 3), false)
  assert.equal(seasonSignal([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0), null, 'too few records to judge season')
  assert.deepEqual(matchMarks({ colors: ['red', 'orange'] }, { colors: 'orange', underside: undefined }), { chosen: 1, matched: ['colors'], missed: [] })
  const anywhere = rankSuggestions({ candidates, traits, selected: { underside: 'pores' }, evidence: null, month: 0, hemisphere: 'north', summaries })
  assert.deepEqual(anywhere.map(item => item.slug), ['c'], 'without nearby data, field marks alone decide')
})

test('a photo comparison lifts its matches, keeps an out-of-area lookalike, and never shrinks the photo past the limit', () => {
  const index = { tile: 30, species: ['a', 'b', 'c'], tiles: ['6_4'] }
  const evidence = nearbyEvidence(index, [{ cells: { '180_130': { s: [[0, 12], [1, 3]], e: [] } } }], 40.5, 0.5)
  const candidates = ['a', 'b', 'c', 'd'].map(slug => ({ slug, name: slug.toUpperCase() }))
  const traits = { a: { underside: ['gills'] }, b: { underside: ['gills'] }, c: { underside: ['pores'] }, d: { underside: ['gills'] } }
  const summaries = {}
  const photo = photoSignals({ suggestions: [
    { slug: 'b', likeness: 'strong', features: 'Ridges fit.' },
    { slug: 'd', likeness: 'possible', features: 'Colour fits.' },
    { slug: 'b', likeness: 'weak', features: 'Duplicate.' },
    { slug: 'x', likeness: 'unknown', features: 'Ignored.' },
  ] })
  assert.deepEqual([...photo.keys()], ['b', 'd'])
  const ranked = rankSuggestions({ candidates, traits, selected: {}, evidence, month: 0, hemisphere: 'north', summaries, photo })
  assert.deepEqual(ranked.map(item => item.slug), ['b', 'd', 'a'], 'photo matches first; d is listed although not recorded nearby')
  assert.equal(ranked[0].photo.features, 'Ridges fit.')
  const without = rankSuggestions({ candidates, traits, selected: {}, evidence, month: 0, hemisphere: 'north', summaries })
  assert.deepEqual(without.map(item => item.slug), ['a', 'b'])
  assert.deepEqual(fitWithin(4032, 3024), { width: 1024, height: 768 })
  assert.deepEqual(fitWithin(600, 800), { width: 600, height: 800 })
})

test('every catalogue species has squares, a growing zone, a lookup slot and valid field marks', async () => {
  const marks = await json('../src/data/field-marks.json')
  const summary = await json('../src/data/occurrence-summary.json')
  const counts = await json('../src/data/catalogue-counts.json')
  const collections = { fungi: fungiSlugs, herbs: herbGuides.map(plant => plant.slug) }
  assert.equal(collections.fungi.length, counts.fungi)
  assert.equal(collections.herbs.length, counts.herbs)
  for (const [collection, slugs] of Object.entries(collections)) {
    const index = await json(`../public/data/id-index/${collection}/index.json`)
    assert.deepEqual([...index.species].sort(), [...slugs].sort(), collection)
    assert.deepEqual(Object.keys(marks[collection]).sort(), [...slugs].sort(), collection)
    const vocab = Object.fromEntries(markGroups[collection].map(group => [group.key, new Set(group.options.map(([value]) => value))]))
    for (const slug of slugs) {
      for (const [key, values] of Object.entries(marks[collection][slug])) {
        // Flower lists may name colours the picker omits (brown); every other value must be selectable.
        for (const value of values) if (!(key === 'flowers' && value === 'brown')) assert.ok(vocab[key].has(value), `${collection}/${slug}: ${key}=${value}`)
      }
      assert.ok(summary[collection][slug], `${collection}/${slug} summary`)
      const occurrence = prepareDataset(await json(`../public/data/occurrence/${collection}/${slug}.json`))
      assert.equal(occurrence.slug, slug)
      assert.deepEqual(occurrence.levels.map(level => level.res), GRID_LEVELS)
      assert.ok(occurrence.total > 0, `${collection}/${slug} has records`)
      const zone = await json(`../public/data/range/${collection}/${slug}.json`)
      assert.equal(zone.type, 'Feature')
      assert.equal(zone.geometry.type, 'MultiPolygon')
      const [west, south, east, north] = geometryBounds(zone.geometry)
      assert.ok(west >= -180 && east <= 180 && south >= -60 && north <= 90, `${collection}/${slug} zone bounds`)
      assert.ok(zone.properties.sources.length > 0)
    }
  }
})

test('obscured records never reach the finest squares', async () => {
  // Ramps are obscured on iNaturalist for conservation; their records count only at 0.25 degrees and up.
  const ramps = await json('../public/data/occurrence/herbs/ramps.json')
  const coarse = ramps.levels.find(level => level.res === 0.25).cells.length
  const finest = ramps.levels.find(level => level.res === 0.125).cells.length
  assert.ok(coarse > 0)
  assert.ok(finest < coarse / 4, 'most ramps records are obscured and excluded at the finest level')
})
