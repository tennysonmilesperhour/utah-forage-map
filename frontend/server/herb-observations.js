import catalog from '../src/data/herb-map-taxa.json' with { type: 'json' }

const taxa = new Map(catalog.map(plant => [plant.taxonId, plant]))
const licenses = new Set(['cc0', 'cc-by', 'cc-by-sa'])
export const RESULT_LIMIT = 200
export const CACHE_SECONDS = 600

export function parseSearch(params) {
  const plant = params.get('plant') || 'all'
  const period = params.get('period') || '365'
  const month = params.get('month') || ''
  if (plant !== 'all' && !catalog.some(item => item.slug === plant)) throw new Error('Choose a plant from the atlas.')
  if (!['30', '365', 'all'].includes(period)) throw new Error('Choose a supported date range.')
  if (month && !/^(?:[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a month from 1 to 12.')
  const raw = params.get('bbox')
  const bounds = raw?.split(',').map(Number)
  if (!bounds || bounds.length !== 4 || raw.split(',').some(value => !value.trim()) || !bounds.every(Number.isFinite)) throw new Error('A valid map area is required.')
  const [west, south, east, north] = bounds
  if (west < -180 || west > 180 || east < -180 || east > 180 || south < -85 || north > 85 || south >= north || west === east) throw new Error('The map area is outside supported bounds.')
  // Rounded outward to reduce duplicate near-identical viewport requests.
  return { plant, period, month, bounds: [Math.floor(west * 10) / 10, Math.floor(south * 10) / 10, Math.ceil(east * 10) / 10, Math.ceil(north * 10) / 10] }
}

export function observationUrls(search, now = new Date()) {
  const selected = search.plant === 'all' ? catalog : catalog.filter(item => item.slug === search.plant)
  const params = new URLSearchParams({
    taxon_id: selected.map(item => item.taxonId).join(','),
    quality_grade: 'research', captive: 'false', geo: 'true',
    license: [...licenses].join(','), per_page: String(RESULT_LIMIT),
    order_by: 'observed_on', order: 'desc',
  })
  if (search.period !== 'all') {
    const start = new Date(now)
    start.setUTCDate(start.getUTCDate() - Number(search.period))
    params.set('d1', start.toISOString().slice(0, 10))
  }
  if (search.month) params.set('month', search.month)
  const [west, south, east, north] = search.bounds
  // An explicit split avoids treating a date-line viewport as the rest of the world.
  const areas = west > east ? [[west, south, 180, north], [-180, south, east, north]] : [search.bounds]
  return areas.filter(([w, , e]) => w < e).map(([w, s, e, n]) => {
    const query = new URLSearchParams(params)
    Object.entries({ swlng: w, swlat: s, nelng: e, nelat: n }).forEach(([key, value]) => query.set(key, value))
    return `https://api.inaturalist.org/v1/observations?${query}`
  })
}

export function normalizeObservation(record) {
  if (!Number.isSafeInteger(record?.id) || record.id <= 0 || record.quality_grade !== 'research' || record.captive === true || !licenses.has(record.license_code)) return null
  if (record.geoprivacy === 'private' || record.taxon_geoprivacy === 'private') return null
  const coordinates = record.geojson?.coordinates
  if (record.geojson?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) return null
  const [longitude, latitude] = coordinates
  if (longitude < -180 || longitude > 180 || latitude < -85 || latitude > 85) return null
  const ids = [record.taxon?.id, ...(record.taxon?.ancestor_ids || []).toReversed()]
  const plant = ids.map(id => taxa.get(id)).find(Boolean)
  if (!plant) return null
  const photo = record.photos?.find(item => licenses.has(item.license_code) && /^https:\/\/(?:inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org)\//.test(item.url || ''))
  const obscured = record.obscured === true || record.geoprivacy === 'obscured' || record.taxon_geoprivacy === 'obscured'
  // Only the public point is copied. Never fall back to private latitude, location or geojson.
  return {
    id: record.id, latitude, longitude, plant: plant.slug, status: plant.status,
    observedOn: typeof record.observed_on === 'string' ? record.observed_on : null,
    observer: record.user?.login || 'iNaturalist observer',
    sourceUrl: `https://www.inaturalist.org/observations/${record.id}`,
    license: record.license_code, obscured,
    accuracy: !obscured && Number.isFinite(record.positional_accuracy) ? record.positional_accuracy : null,
    locality: obscured ? 'Location obscured for privacy' : String(record.place_guess || 'Public observation location').slice(0, 180),
    photo: photo ? { url: photo.url, credit: photo.attribution || record.user?.login || 'iNaturalist contributor', license: photo.license_code } : null,
  }
}

export async function loadObservations(search, fetcher = fetch, now = new Date()) {
  const records = new Map()
  let total = 0
  let returned = 0
  for (const url of observationUrls(search, now)) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'WorldMushroomForaging/1.0 (+https://worldmushroomforaging.org/about; herb observation map)', Accept: 'application/json' } })
    if (!response.ok) throw new Error(response.status === 429 ? 'The observation source is busy. Please try again in a minute.' : 'Observations are temporarily unavailable. Please try again.')
    const data = await response.json()
    if (!Array.isArray(data.results) || !Number.isFinite(data.total_results)) throw new Error('The observation source returned an unexpected response.')
    total += data.total_results
    returned += data.results.length
    for (const record of data.results) {
      const observation = normalizeObservation(record)
      if (observation) records.set(observation.id, observation)
    }
  }
  const observations = [...records.values()].sort((a, b) => (b.observedOn || '').localeCompare(a.observedOn || '') || b.id - a.id).slice(0, RESULT_LIMIT)
  return { observations, total, returned, limit: RESULT_LIMIT, fetchedAt: now.toISOString(), search, source: 'iNaturalist', partial: observations.length < total }
}

// Warm instances coalesce identical requests and pace upstream calls. CDN caching
// provides the cross-instance cache; this bounded memory cache is only a fallback.
const cache = new Map()
const pending = new Map()
let requestQueue = Promise.resolve()
let nextRequestAt = 0
function pacedFetch(url, options) {
  const request = requestQueue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, nextRequestAt - Date.now())))
    nextRequestAt = Date.now() + 1100
    // Start the network timeout after waiting for the queue.
    return fetch(url, { ...options, signal: AbortSignal.timeout(8000) })
  })
  requestQueue = request.then(() => undefined, () => undefined)
  return request
}
export async function cachedObservations(search) {
  const key = JSON.stringify(search)
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) return entry.data
  if (pending.has(key)) return pending.get(key)
  if (pending.size >= 4) throw new Error('The observation map is busy. Please try again in a minute.')
  const request = loadObservations(search, pacedFetch).then(data => {
    if (cache.size >= 128) cache.delete(cache.keys().next().value)
    cache.set(key, { data, expires: Date.now() + CACHE_SECONDS * 1000 })
    return data
  }).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
