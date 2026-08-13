// Elevations are stored in feet. Readers outside the handful of countries that use
// imperial units see metres, so every elevation crosses this module on the way in or out.

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM'])
const STORAGE_KEY = 'forage:units:v1'
const FEET_PER_METRE = 3.280839895

export function detectUnitSystem() {
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const locale of locales) {
    if (!locale) continue
    try {
      const region = new Intl.Locale(locale).region
      if (region) return IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric'
    } catch {
      const parts = String(locale).split('-')
      const region = parts[parts.length - 1]?.toUpperCase()
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

export function elevationLabel(system) {
  return system === 'imperial' ? 'ft' : 'm'
}

export function feetToDisplay(feet, system) {
  if (feet == null || Number.isNaN(Number(feet))) return null
  return system === 'imperial' ? Number(feet) : Number(feet) / FEET_PER_METRE
}

export function displayToFeet(value, system) {
  if (value === '' || value == null || Number.isNaN(Number(value))) return undefined
  return system === 'imperial' ? Number(value) : Number(value) * FEET_PER_METRE
}

export function formatElevation(feet, system) {
  const value = feetToDisplay(feet, system)
  if (value == null) return null
  return `${Math.round(value).toLocaleString()} ${elevationLabel(system)}`
}

// The public map shifts each point 1 to 2.5 miles from the recorded location.
export function approximateOffsetLabel(system) {
  return system === 'imperial' ? '1 to 2.5 miles' : '1.5 to 4 km'
}
