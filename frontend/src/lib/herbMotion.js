import { easeBetween, MUSHROOM_TIMING } from './mushroomMotion.js'

const clamp = n => Math.max(0, Math.min(1, n))
const grown = { rise: 1, leaf: 1, bend: 0, curl: 0, alpha: 1, sink: 0 }

export function herbPose(phase, elapsed) {
  if (phase === 'dormant') return { ...grown, rise: .06, leaf: 0, alpha: 0, sink: .08 }
  if (phase === 'forming') {
    const t = clamp(elapsed / MUSHROOM_TIMING.forming)
    const stem = easeBetween(t, .02, .78)
    return {
      rise: .06 + .94 * stem, leaf: t,
      bend: -.1 * Math.sin(Math.PI * stem),
      curl: 1 - easeBetween(t, .3, 1),
      alpha: easeBetween(t, .01, .15), sink: .08 * (1 - easeBetween(t, 0, .3)),
    }
  }
  if (phase === 'wilting') {
    const t = clamp(elapsed / MUSHROOM_TIMING.wilting)
    const settle = easeBetween(t, .4, 1)
    return {
      rise: 1 - .94 * settle, leaf: 1 - easeBetween(t, .08, .78),
      bend: .28 * easeBetween(t, 0, .6) * (1 - .6 * settle),
      curl: easeBetween(t, .08, .7),
      alpha: 1 - easeBetween(t, .82, 1), sink: .1 * settle,
    }
  }
  const seconds = elapsed / 1000
  return { ...grown, bend: ['offering', 'ambient'].includes(phase) ? .018 * Math.sin(seconds * .85) * easeBetween(seconds, 0, 1.8) : 0 }
}

export function deformHerb(u, v, pose) {
  const height = clamp((.9 - v) / .8)
  const offset = u - .5
  // Lower leaves open first. The opposite side follows fractionally later,
  // avoiding a mirrored fan while keeping every pair joined to the stem.
  const delay = .035 * Math.tanh(offset * 8)
  const opening = easeBetween(pose.leaf, .1 + .3 * height + delay, .5 + .46 * height + delay)
  const x = offset * (.1 + .9 * opening) + pose.bend * height * height * .08
  const y = (v - .9) * pose.rise + pose.curl * offset * offset * .12 * pose.rise
  const angle = pose.bend * .55
  return {
    x: .5 + .88 * (x * Math.cos(angle) - y * Math.sin(angle)),
    y: .04 + .92 * (.9 + x * Math.sin(angle) + y * Math.cos(angle) + pose.sink),
  }
}
