import { countryBounds } from '../data/countryBounds.js'

function validBounds(bounds) {
  return Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isFinite)
    && bounds[0] >= -180 && bounds[2] <= 180 && bounds[0] < bounds[2]
    && bounds[1] >= -90 && bounds[3] <= 90 && bounds[1] < bounds[3]
}

export function cameraForCountry(country) {
  const entry = countryBounds[country]
  if (!entry) return null
  const [name, bbox] = entry
  return { country, name, bbox: [bbox[0], Math.max(-85, bbox[1]), bbox[2], Math.min(85, bbox[3])] }
}

export function cameraFromCountryFeature(country, feature) {
  const properties = feature?.properties
  if (properties?.feature_type !== 'country' || properties.context?.country?.country_code?.toUpperCase() !== country) return null
  const bbox = properties.bbox
  if (!validBounds(bbox) || bbox[2] - bbox[0] > 180) return null
  return { country, name: properties.name, bbox: [bbox[0], Math.max(-85, bbox[1]), bbox[2], Math.min(85, bbox[3])] }
}

export async function loadVisitorCountryCamera({ token, signal, fetcher = fetch, timeoutMs = 2500 }) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) return null
  signal?.addEventListener('abort', abort, { once: true })
  let timeout
  // The timeout also settles non-cooperative transports; a late result cannot move the map.
  const expired = new Promise(resolve => {
    timeout = setTimeout(() => { controller.abort(); resolve(null) }, timeoutMs)
  })
  const lookup = async () => {
    const response = await fetcher('/visitor-country', { signal: controller.signal, cache: 'no-store', credentials: 'same-origin' })
    if (!response.ok) return null
    const { country } = await response.json()
    if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country) || country === 'ZZ') return null
    const known = cameraForCountry(country)
    if (known) return known
    if (!token) return null
    const query = new URLSearchParams({ q: country, country, types: 'country', limit: '1', autocomplete: 'false', access_token: token })
    const search = await fetcher(`https://api.mapbox.com/search/geocode/v6/forward?${query}`, { signal: controller.signal })
    if (!search.ok) return null
    const result = await search.json()
    return cameraFromCountryFeature(country, result.features?.[0])
  }
  try {
    return await Promise.race([lookup(), expired])
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

export function initialMapCamera({ target, countryCamera, compact = false }) {
  const selected = target || countryCamera
  if (validBounds(selected?.bbox)) {
    return {
      bounds: [[selected.bbox[0], selected.bbox[1]], [selected.bbox[2], selected.bbox[3]]],
      fitBoundsOptions: { padding: compact ? 30 : 70, maxZoom: target ? 10 : 6, duration: 0 },
    }
  }
  if (target?.center) return { center: target.center, zoom: 8 }
  return { center: [0, 20], zoom: compact ? 0.45 : 1.35 }
}
