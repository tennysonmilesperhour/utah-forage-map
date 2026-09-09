import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/visitor-country.js'
import { countryBounds } from '../src/data/countryBounds.js'
import { cameraForCountry, cameraFromCountryFeature, initialMapCamera, loadVisitorCountryCamera } from '../src/lib/visitorCountry.js'

const jsonResponse = body => ({ ok: true, json: async () => body })

test('country endpoint returns only a coarse country and never a shared-cache response', () => {
  for (const [header, country] of [['US', 'US'], ['NZ', 'NZ'], ['ZZ', null], [undefined, null], ['US,GB', null]]) {
    const headers = {}
    let body
    handler({ headers: { 'x-vercel-ip-country': header, 'x-real-ip': '192.0.2.1', 'x-vercel-ip-city': 'private city' } }, {
      setHeader(name, value) { headers[name] = value },
      status(code) { assert.equal(code, 200); return this },
      json(value) { body = value },
    })
    assert.deepEqual(body, { country })
    assert.equal(headers['Cache-Control'], 'private, no-store')
    assert.equal(headers['Vercel-CDN-Cache-Control'], 'no-store')
  }
})

test('all bundled countries have finite, ordered, map-safe bounds', () => {
  for (const country of Object.keys(countryBounds)) {
    const { bbox } = cameraForCountry(country)
    assert.ok(bbox.every(Number.isFinite), country)
    assert.ok(bbox[0] >= -180 && bbox[2] <= 180 && bbox[0] < bbox[2], country)
    assert.ok(bbox[1] >= -85 && bbox[3] <= 85 && bbox[1] < bbox[3], country)
  }
  assert.ok(cameraForCountry('US').bbox[2] - cameraForCountry('US').bbox[0] < 65)
  assert.ok(cameraForCountry('FJ').bbox[2] - cameraForCountry('FJ').bbox[0] < 10)
})

test('known countries open with one same-origin request and no device coordinates', async () => {
  const requests = []
  const camera = await loadVisitorCountryCamera({ fetcher: async (url, options) => {
    requests.push(url)
    assert.equal(options.cache, 'no-store')
    assert.equal(options.credentials, 'omit')
    return jsonResponse({ country: 'GB' })
  } })
  assert.deepEqual(requests, ['/visitor-country'])
  assert.equal(camera.country, 'GB')
  assert.ok(camera.bbox[0] < 0 && camera.bbox[2] > 0)
})

test('small countries outside the bundled dataset use a country-only Mapbox lookup', async () => {
  const feature = { properties: { feature_type: 'country', name: 'Maldives', bbox: [72.5, -0.8, 73.8, 7.1], context: { country: { country_code: 'MV' } } } }
  const camera = await loadVisitorCountryCamera({ token: 'test-token', fetcher: async url => {
    if (url === '/visitor-country') return jsonResponse({ country: 'MV' })
    const search = new URL(url)
    assert.equal(search.searchParams.get('types'), 'country')
    assert.equal(search.searchParams.get('country'), 'MV')
    assert.equal(search.searchParams.has('proximity'), false)
    return jsonResponse({ features: [feature] })
  } })
  assert.equal(camera.country, 'MV')
  assert.deepEqual(camera.bbox, [72.5, -0.8, 73.8, 7.1])
  assert.equal(cameraFromCountryFeature('US', feature), null)
  assert.equal(cameraFromCountryFeature('MV', { properties: { ...feature.properties, bbox: [NaN, 0, 1, 1] } }), null)
})

test('missing, malformed and failed geolocation fall back without blocking the map', async () => {
  for (const country of [null, 'ZZ', 'US<script>', 123]) {
    assert.equal(await loadVisitorCountryCamera({ fetcher: async () => jsonResponse({ country }) }), null)
  }
  assert.equal(await loadVisitorCountryCamera({ fetcher: async () => ({ ok: false }) }), null)
  assert.equal(await loadVisitorCountryCamera({ fetcher: async () => { throw new Error('offline') } }), null)
  assert.equal(await loadVisitorCountryCamera({ timeoutMs: 10, fetcher: () => new Promise(() => {}) }), null)
  const controller = new AbortController()
  controller.abort()
  assert.equal(await loadVisitorCountryCamera({ signal: controller.signal, fetcher: () => assert.fail('already aborted') }), null)
})

test('an explicit region or selected place always wins over the visitor country', () => {
  const countryCamera = cameraForCountry('US')
  const target = { bbox: [130, 30, 145, 45] }
  assert.deepEqual(initialMapCamera({ target, countryCamera }).bounds, [[130, 30], [145, 45]])
  assert.deepEqual(initialMapCamera({ target: { center: [139, 35] }, countryCamera }), { center: [139, 35], zoom: 8 })
  assert.equal(initialMapCamera({ countryCamera }).fitBoundsOptions.duration, 0)
  assert.equal(initialMapCamera({ countryCamera, compact: true }).fitBoundsOptions.maxZoom, 6)
  assert.ok(initialMapCamera({ countryCamera, compact: true }).fitBoundsOptions.padding < initialMapCamera({ countryCamera }).fitBoundsOptions.padding)
  assert.deepEqual(initialMapCamera({}), { center: [0, 20], zoom: 1.35 })
})
