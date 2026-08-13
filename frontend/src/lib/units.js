// The interface works in metres and the API stores feet, so every elevation crosses this
// module. Readers outside the few countries that use imperial units see metres by default,
// and either way the preference is theirs to change.

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM'])
const STORAGE_KEY = 'forage:units:v1'
const FEET_PER_METRE = 3.28084

export function detectUnitSystem() {
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const locale of locales) {
    if (!locale) continue
    try {
      const region = new Intl.Locale(locale).region
      if (region) return IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric'
    } catch {
      const region = String(locale).split('-').pop()?.toUpperCase()
      if (region?.length === 2) return IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric'
    }
  }
  return 'metric'
}

export function readStoredUnitSystem() {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'metric' || stored === 'imperial' ? stored : detectUnitSystem()
}

export function storeUnitSystem(system) {
  window.localStorage.setItem(STORAGE_KEY, system)
}

export function elevationUnit(system) {
  return system === 'imperial' ? 'ft' : 'm'
}

// Filters and forms hold metres; these move between that and what the reader types.
export function metresToDisplay(metres, system) {
  if (metres == null || metres === '' || Number.isNaN(Number(metres))) return null
  return system === 'imperial' ? Number(metres) * FEET_PER_METRE : Number(metres)
}

export function displayToMetres(value, system) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return undefined
  return system === 'imperial' ? Number(value) / FEET_PER_METRE : Number(value)
}

// Observations arrive from the API in feet.
export function formatElevation(feet, system) {
  if (feet == null) return 'Unknown'
  const value = system === 'imperial' ? Number(feet) : Number(feet) / FEET_PER_METRE
  return `${Math.round(value).toLocaleString()} ${elevationUnit(system)}`
}

// The public map shifts each point 1 to 2.5 miles from the recorded location.
export function approximateOffsetLabel(system) {
  return system === 'imperial' ? '1 to 2.5 miles' : '1.5 to 4 km'
}
