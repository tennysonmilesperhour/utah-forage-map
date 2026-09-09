export const MUSHROOM_TIMING = { forming: 4600, offering: 6000, wilting: 3800, resting: 22000, initial: 900 }
export function nextMushroomPhase(phase) {
  return { dormant: 'forming', forming: 'offering', offering: 'wilting', wilting: 'dormant' }[phase]
}
const clamp = n => Math.max(0, Math.min(1, n))
// Quintic interpolation keeps velocity and acceleration continuous at the ends.
export function easeBetween(value, start, end) {
  const t = clamp((value - start) / (end - start))
  return t * t * t * (t * (t * 6 - 15) + 10)
}
export function specimenPose(phase, elapsed) {
  if (phase === 'dormant') return { rise: 0, spread: .12, curl: 1, bend: 0, alpha: 0, sink: .06 }
  if (phase === 'forming') {
    const t = clamp(elapsed / MUSHROOM_TIMING.forming)
    const stem = easeBetween(t, 0, .76)
    const cap = easeBetween(t, .23, 1)
    return { rise: .035 + .965 * stem, spread: .18 + .82 * cap, curl: .65 * (1 - cap), bend: -.12 * Math.sin(Math.PI * t), alpha: easeBetween(t, 0, .14), sink: .07 * (1 - stem) }
  }
  if (phase === 'wilting') {
    const t = clamp(elapsed / MUSHROOM_TIMING.wilting)
    const bow = easeBetween(t, 0, .58)
    const fold = easeBetween(t, .25, .95)
    const settle = easeBetween(t, .42, 1)
    return { rise: 1 - .98 * settle, spread: 1 - .72 * fold, curl: .65 * fold, bend: .86 * bow * (1 - .5 * settle), alpha: 1 - easeBetween(t, .76, 1), sink: .09 * easeBetween(t, .62, 1) }
  }
  const seconds = elapsed / 1000
  const wind = phase === 'offering' || phase === 'ambient'
  const arrival = easeBetween(seconds, 0, 1.3)
  return { rise: 1, spread: 1 + (wind ? .009 * Math.sin(seconds * 1.12) * arrival : 0), curl: 0, bend: wind ? (-.012 + .011 * Math.sin(seconds * .92)) * arrival : 0, alpha: 1, sink: 0 }
}

export function deformSpecimen(u, v, pose) {
  const rootY = .895
  const height = clamp((rootY - v) / .78)
  const cap = 1 - easeBetween(v, .4, .73)
  const axis = .49 + .13 * easeBetween(v, .62, rootY)
  const offset = u - axis
  const width = (1 - cap) * (.48 + .52 * pose.rise) + cap * pose.spread
  // Bend the stem along an arc and rotate each cross-section with its tangent.
  // This gives the cap weight without folding the texture grid through itself.
  const angle = pose.bend * height * Math.min(1, pose.rise / .35)
  const length = (rootY - v) * pose.rise
  const arcX = Math.abs(angle) > .0001 ? length * (1 - Math.cos(angle)) / angle : 0
  const arcY = Math.abs(angle) > .0001 ? length * Math.sin(angle) / angle : length
  const curl = pose.curl * cap * offset * offset * .25 * pose.rise
  const x = axis + arcX + offset * width * Math.cos(angle)
  const y = rootY - arcY + offset * width * Math.sin(angle) + curl + pose.sink
  return { x: .08 + .84 * x, y: .04 + .92 * y }
}
