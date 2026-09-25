import { MUSHROOM_TIMING } from './mushroomMotion.js'

export const BANNER_FADE_MS = 800
export const initialSupporterLife = { phase: 'dormant', cycle: 0, banner: 'hidden' }

export function supporterLife(state, action) {
  if (action === 'open') return { ...state, phase: 'offering', banner: 'visible' }
  if (action === 'dismiss') return {
    ...state, banner: 'hidden',
    phase: ['forming', 'offering'].includes(state.phase) ? 'wilting' : state.phase === 'fading' ? 'dormant' : state.phase,
  }
  if (action === 'start' && state.phase !== 'dormant') return state
  if (action === 'start' || (action === 'tick' && state.phase === 'dormant')) {
    return { ...state, phase: state.banner === 'visible' ? 'fading' : 'forming', banner: state.banner === 'visible' ? 'fading' : 'hidden' }
  }
  if (action !== 'tick') return state
  switch (state.phase) {
    case 'forming': return { ...state, phase: 'offering', banner: 'visible' }
    case 'offering': return { ...state, phase: 'wilting' }
    case 'wilting': return { ...state, phase: 'dormant', cycle: state.cycle + 1 }
    case 'fading': return { ...state, phase: 'forming', banner: 'hidden' }
    default: return state
  }
}

export function supporterPhaseDuration({ phase, cycle }) {
  if (phase === 'fading') return BANNER_FADE_MS
  if (phase === 'dormant') return cycle ? MUSHROOM_TIMING.resting : MUSHROOM_TIMING.initial
  return MUSHROOM_TIMING[phase]
}
