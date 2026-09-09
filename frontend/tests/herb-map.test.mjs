import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { parseSearch, observationUrls, normalizeObservation, loadObservations } from '../server/herb-observations.js'
import handler from '../api/herb-observations.js'
import { fungiNavigation, herbNavigation, herbHref } from '../src/lib/navigation.js'

const catalog = JSON.parse(await readFile(new URL('../src/data/herb-map-taxa.json', import.meta.url)))
const atlas = JSON.parse(await readFile(new URL('../src/data/herb-guide.json', import.meta.url)))
const search = extra => parseSearch(new URLSearchParams({ plant: 'all', period: '365', bbox: '-125,24,-66,50', ...extra }))
const nettleId = catalog.find(p => p.slug === 'stinging-nettle').taxonId
const record = extra => ({ id: 123, taxon: { id: nettleId, ancestor_ids: [47126, nettleId] }, quality_grade: 'research', captive: false, license_code: 'cc-by', observed_on: '2026-09-08', geojson: { type: 'Point', coordinates: [-111, 40] }, user: { login: 'field-observer' }, ...extra })

test('every atlas plant maps to one verified taxon and retains its caution category', () => {
  assert.equal(catalog.length, atlas.length)
  assert.equal(new Set(catalog.map(p => p.taxonId)).size, atlas.length)
  for (const plant of atlas) {
    const mapped = catalog.find(p => p.slug === plant.slug)
    assert.ok(mapped?.taxonId > 0, plant.slug)
    assert.equal(mapped.status, plant.status)
    assert.equal(mapped.latin, plant.latin)
  }
})

test('both menus start at the collection landing page with the map second', () => {
  assert.equal(fungiNavigation[0].href, '/learn')
  assert.equal(herbHref(herbNavigation[0].key), '/herbs')
  assert.equal(fungiNavigation[1].key, 'map')
  assert.equal(herbNavigation[1].key, 'map')
  assert.equal(herbHref('map'), '/herbs/map')
  assert.equal(herbHref('plants'), '/herbs/atlas')
  assert.equal(herbHref('watches'), '/herbs?view=watches')
})

test('rejects malformed areas, arbitrary taxa, unsupported dates and nonfinite coordinates', () => {
  for (const bbox of ['', '0,0,0,1', '0,2,1,1', '181,0,20,30', '0,-90,20,30', '0,0,,30', 'NaN,0,20,30', '0,0,Infinity,30']) assert.throws(() => search({ bbox }), bbox)
  assert.throws(() => search({ plant: 'any-external-taxon' }))
  assert.throws(() => search({ period: '9999' }))
  assert.throws(() => search({ month: '13' }))
})

test('provider requests are bounded, wild, research-grade, openly licensed and date-filtered', () => {
  const [url] = observationUrls(search({ plant: 'stinging-nettle', month: '9' }), new Date('2026-09-09T12:00:00Z'))
  const p = new URL(url).searchParams
  assert.equal(p.get('taxon_id'), String(nettleId))
  assert.equal(p.get('per_page'), '200')
  assert.equal(p.get('d1'), '2025-09-09')
  assert.equal(p.get('month'), '9')
  assert.equal(p.get('quality_grade'), 'research')
  assert.equal(p.get('captive'), 'false')
  assert.equal(p.get('license'), 'cc0,cc-by,cc-by-sa')
  assert.equal(new URL(observationUrls(search({ period: 'all' }))[0]).searchParams.has('d1'), false)
})

test('date-line searches split into two bounded areas instead of querying the opposite hemisphere', () => {
  const urls = observationUrls(search({ bbox: '170,-20,-170,20' }))
  assert.equal(urls.length, 2)
  assert.deepEqual(urls.map(u => { const p = new URL(u).searchParams; return [p.get('swlng'), p.get('nelng')] }), [['170', '180'], ['-180', '-170']])
})

test('only public coordinates are exposed; obscured locations lose precise place and accuracy', () => {
  const output = normalizeObservation(record({ obscured: true, place_guess: 'Sensitive private address', positional_accuracy: 1, private_geojson: { coordinates: [2, 3] }, private_latitude: 3, private_longitude: 2 }))
  assert.equal(output.longitude, -111)
  assert.equal(output.latitude, 40)
  assert.equal(output.accuracy, null)
  assert.equal(output.locality, 'Location obscured for privacy')
  assert.doesNotMatch(JSON.stringify(output), /private_address|private_geojson|Sensitive|private_latitude|private_longitude/)
  for (const item of [record({ geoprivacy: 'private' }), record({ taxon_geoprivacy: 'private' }), record({ geojson: null, private_geojson: { type: 'Point', coordinates: [2, 3] } }), record({ license_code: 'cc-by-nc' }), record({ captive: true }), record({ quality_grade: 'needs_id' })]) assert.equal(normalizeObservation(item), null)
})

test('toxic lookalikes remain toxic; descendants link to the corresponding atlas plant', () => {
  const toxic = catalog.find(p => p.slug === 'poison-hemlock')
  assert.equal(normalizeObservation(record({ taxon: { id: toxic.taxonId } })).status, 'toxic')
  const descendant = normalizeObservation(record({ taxon: { id: 99999999, ancestor_ids: [47126, nettleId] } }))
  assert.equal(descendant.plant, 'stinging-nettle')
})

test('photo reuse requires an open license and an approved source host', () => {
  assert.equal(normalizeObservation(record({ photos: [{ url: 'https://example.com/image.jpg', license_code: 'cc-by' }] })).photo, null)
  assert.equal(normalizeObservation(record({ photos: [{ url: 'https://static.inaturalist.org/photos/1/square.jpg', license_code: 'cc-by-nc' }] })).photo, null)
  assert.equal(normalizeObservation(record({ photos: [{ url: 'https://static.inaturalist.org/photos/1/square.jpg', license_code: 'cc-by', attribution: 'A. Observer' }] })).photo.credit, 'A. Observer')
})

test('partial coverage is explicit and successful empty results differ from source failures', async () => {
  const calls = []
  const fetcher = async url => { calls.push(url); return { ok: true, json: async () => ({ total_results: 1000, results: Array.from({ length: 200 }, (_, i) => record({ id: i + 1 })) }) } }
  const result = await loadObservations(search({ bbox: '170,-20,-170,20' }), fetcher)
  assert.equal(calls.length, 2)
  assert.equal(result.total, 2000)
  assert.equal(result.observations.length, 200)
  assert.equal(result.partial, true)
  const empty = await loadObservations(search(), async () => ({ ok: true, json: async () => ({ total_results: 0, results: [] }) }))
  assert.equal(empty.total, 0)
  assert.deepEqual(empty.observations, [])
  await assert.rejects(loadObservations(search(), async () => ({ ok: false, status: 429 })), /try again in a minute/)
  await assert.rejects(loadObservations(search(), async () => ({ ok: true, json: async () => ({ results: 'bad data' }) })), /unexpected response/)
})

test('public service rejects writes and invalid input without a provider request or cacheable error', async () => {
  for (const [request, status] of [[{ method: 'POST', url: '/herb-observations' }, 405], [{ method: 'GET', url: '/herb-observations?bbox=bad' }, 400]]) {
    const response = { headers: {}, setHeader(key, value) { this.headers[key] = value }, status(value) { this.code = value; return this }, json(value) { this.body = value } }
    await handler(request, response)
    assert.equal(response.code, status)
    assert.equal(response.headers['Cache-Control'], 'no-store')
    assert.equal(response.headers['X-Robots-Tag'], 'noindex')
    assert.ok(response.body.error)
  }
})
