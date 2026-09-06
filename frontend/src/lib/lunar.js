import { EclipticGeoMoon, MoonPhase, SearchMoonQuarter } from 'astronomy-engine'

const PHASES = [
  'New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
  'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent',
]
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']

export function lunarContext(date = new Date()) {
  const angle = MoonPhase(date)
  const phase = PHASES[Math.floor((angle + 22.5) / 45) % 8]
  const illumination = (1 - Math.cos(angle * Math.PI / 180)) / 2
  const longitude = EclipticGeoMoon(date).lon
  const nextQuarter = SearchMoonQuarter(new Date(date.getTime() + 60000))
  return {
    angle,
    phase,
    illumination,
    sign: SIGNS[Math.floor(longitude / 30) % 12],
    nextQuarter: nextQuarter?.time?.date ?? null,
  }
}
