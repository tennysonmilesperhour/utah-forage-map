import test from 'node:test'
import assert from 'node:assert/strict'
import { deformSpecimen, MUSHROOM_TIMING, specimenPose } from '../src/lib/mushroomMotion.js'

test('emergence and absorption do not invert the textured mesh', () => {
  // A reversed triangle folds the photo over itself, leaving streaks and holes.
  // Exercise the actual 10 × 16 renderer mesh through each moving phase.
  const area = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  for (const phase of ['forming', 'wilting']) {
    for (let frame = 0; frame <= 100; frame++) {
      const pose = specimenPose(phase, MUSHROOM_TIMING[phase] * frame / 100)
      for (let row = 0; row < 16; row++) for (let col = 0; col < 10; col++) {
        const p00 = deformSpecimen(col / 10, row / 16, pose)
        const p10 = deformSpecimen((col + 1) / 10, row / 16, pose)
        const p01 = deformSpecimen(col / 10, (row + 1) / 16, pose)
        const p11 = deformSpecimen((col + 1) / 10, (row + 1) / 16, pose)
        assert.ok(area(p00, p10, p01) > 0, `${phase} frame ${frame}: first triangle`)
        assert.ok(area(p11, p01, p10) > 0, `${phase} frame ${frame}: second triangle`)
      }
    }
  }
})

test('phase boundaries join without a visible pose jump', () => {
  const grown = specimenPose('forming', MUSHROOM_TIMING.forming)
  const resting = specimenPose('offering', 0)
  const wilting = specimenPose('wilting', 0)
  for (const key of Object.keys(grown)) {
    assert.ok(Math.abs(grown[key] - resting[key]) < 1e-9, `forming/offering ${key}`)
    assert.ok(Math.abs(wilting[key] - resting[key]) < 1e-9, `offering/wilting ${key}`)
  }
  assert.equal(specimenPose('forming', 0).alpha, 0)
  assert.equal(specimenPose('wilting', MUSHROOM_TIMING.wilting).alpha, 0)
})
