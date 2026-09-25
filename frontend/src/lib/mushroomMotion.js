export const MUSHROOM_TIMING = { forming: 6200, offering: 7000, wilting: 4600, resting: 28000, initial: 1100 }
export function nextMushroomPhase(phase) {
  return { dormant: 'forming', forming: 'offering', offering: 'wilting', wilting: 'dormant' }[phase]
}
const clamp = n => Math.max(0, Math.min(1, n))
// Zero velocity and acceleration at either end, without a spring/bounce.
export function easeBetween(value, start, end) {
  const t = clamp((value - start) / (end - start))
  return t * t * t * (t * (t * 6 - 15) + 10)
}
const restingPose = { rise: 1, crown: 1, spread: 1, curl: 0, bend: 0, twist: 0, alpha: 1, sink: 0 }
export function specimenPose(phase, elapsed) {
  if (phase === 'dormant') return { ...restingPose, rise: .08, crown: .22, spread: .13, curl: .9, alpha: 0, sink: .1 }
  if (phase === 'forming') {
    const t = clamp(elapsed / MUSHROOM_TIMING.forming)
    const stem = easeBetween(t, .03, .72)
    const cap = easeBetween(t, .28, .98)
    // The pin lifts before its cap opens. Each rim releases slightly differently.
    return {
      rise: .08 + .92 * stem,
      crown: .22 + .78 * easeBetween(t, .2, .98),
      spread: .13 + .87 * cap,
      curl: .9 * (1 - easeBetween(t, .42, 1)),
      bend: -.24 * Math.sin(Math.PI * stem) * (1 - .3 * cap),
      twist: .065 * Math.sin(Math.PI * cap),
      alpha: easeBetween(t, .02, .12),
      sink: .1 * (1 - easeBetween(t, 0, .4)),
    }
  }
  if (phase === 'wilting') {
    const t = clamp(elapsed / MUSHROOM_TIMING.wilting)
    const bow = easeBetween(t, 0, .55)
    const fold = easeBetween(t, .18, .86)
    const settle = easeBetween(t, .46, 1)
    return {
      rise: 1 - .92 * settle,
      crown: 1 - .78 * fold,
      spread: 1 - .87 * fold,
      curl: .9 * fold,
      bend: .62 * bow * (1 - .72 * settle),
      twist: -.05 * Math.sin(Math.PI * fold),
      alpha: 1 - easeBetween(t, .82, 1),
      sink: .13 * easeBetween(t, .62, 1),
    }
  }
  const seconds = elapsed / 1000
  const wind = phase === 'offering' || phase === 'ambient'
  const arrival = easeBetween(seconds, 0, 1.8)
  return { ...restingPose, bend: wind ? -.012 * Math.sin(seconds * .78) * arrival : 0 }
}

// Integral of the cap influence: separating stem elongation from cap opening
// preserves a rounded bud instead of squeezing the entire photograph flat.
function capLength(v) {
  const start = .43, end = .72, span = end - start
  if (v <= start) return start - v + span / 2
  if (v >= end) return 0
  const t = (v - start) / span
  return span * (.5 - t + t ** 6 - 3 * t ** 5 + 2.5 * t ** 4)
}

export function deformSpecimen(u, v, pose) {
  const rootY = .895
  const height = clamp((rootY - v) / .78)
  const cap = 1 - easeBetween(v, .43, .72)
  const axis = .49 + .13 * easeBetween(v, .62, rootY)
  const offset = u - axis
  const capWidth = pose.spread + pose.twist * Math.tanh(offset * 8)
  const width = (1 - cap) * (.5 + .5 * pose.rise) + cap * capWidth
  const length = (rootY - v) * pose.rise + capLength(v) * (pose.crown - pose.rise)
  const rolledRim = pose.curl * cap * offset * offset * .12 * Math.min(pose.crown, pose.rise)
  // A curved centerline carries the cap; rotate the continuous surface together
  // so the narrow neck cannot turn individual mesh rows inside out.
  const arc = pose.bend * height * height * .12
  const localX = axis - .62 + arc + offset * width
  const localY = -length + rolledRim
  const angle = pose.bend * .55
  return {
    x: .08 + .84 * (.62 + localX * Math.cos(angle) - localY * Math.sin(angle)),
    y: .04 + .92 * (rootY + localX * Math.sin(angle) + localY * Math.cos(angle) + pose.sink),
  }
}
