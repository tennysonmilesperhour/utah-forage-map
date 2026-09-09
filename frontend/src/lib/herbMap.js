import catalog from '../data/herb-map-taxa.json'
export const mapPlants = [...catalog].sort((a, b) => a.name.localeCompare(b.name))
export const mapPlantBySlug = Object.fromEntries(catalog.map(plant => [plant.slug, plant]))
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const WORLD_BOUNDS = [-180, -70, 180, 80]
export function readMapSearch(search = '') {
  const params = new URLSearchParams(search)
  const raw = params.get('bbox')
  const box = raw?.split(',').map(Number)
  const valid = box?.length === 4 && raw.split(',').every(v => v.trim()) && box.every(Number.isFinite) && Math.abs(box[0]) <= 180 && Math.abs(box[2]) <= 180 && box[1] >= -85 && box[3] <= 85 && box[1] < box[3] && box[0] !== box[2]
  return {
    plant: mapPlantBySlug[params.get('plant')] ? params.get('plant') : 'all',
    period: ['30', '365', 'all'].includes(params.get('period')) ? params.get('period') : '365',
    month: /^(?:[1-9]|1[0-2])$/.test(params.get('month')) ? params.get('month') : '',
    bbox: valid ? box.map(v => Number(v.toFixed(4))) : null,
  }
}
export function mapSearchParams(search) {
  const params = new URLSearchParams({ plant: search.plant, period: search.period })
  if (search.month) params.set('month', search.month)
  if (search.bbox) params.set('bbox', search.bbox.join(','))
  return params
}
export function boundsArray(bounds) { return [bounds.west, bounds.south, bounds.east, bounds.north] }
export function licenseHref(code) { return code === 'cc0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' : `https://creativecommons.org/licenses/${code.replace('cc-', '')}/4.0/` }
export function dateLabel(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Observation date unavailable'
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
