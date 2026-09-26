import test from 'node:test'
import assert from 'node:assert/strict'
import { herbPose, deformHerb } from '../src/lib/herbMotion.js'
import { MUSHROOM_TIMING } from '../src/lib/mushroomMotion.js'

test('herb leaves stay attached without folding the texture mesh inside out', () => {
  const area = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  for (const phase of ['forming', 'wilting']) for (let frame = 0; frame <= 100; frame++) {
    const pose = herbPose(phase, MUSHROOM_TIMING[phase] * frame / 100)
    for (let row = 0; row < 16; row++) for (let col = 0; col < 10; col++) {
      const p00 = deformHerb(col / 10, row / 16, pose)
      const p10 = deformHerb((col + 1) / 10, row / 16, pose)
      const p01 = deformHerb(col / 10, (row + 1) / 16, pose)
      const p11 = deformHerb((col + 1) / 10, (row + 1) / 16, pose)
      assert.ok(area(p00, p10, p01) > 0, `${phase} ${frame} first triangle`)
      assert.ok(area(p11, p01, p10) > 0, `${phase} ${frame} second triangle`)
    }
  }
})

test('herb growth and wilt join at the same mature pose', () => {
  const ready = herbPose('forming', MUSHROOM_TIMING.forming)
  const resting = herbPose('offering', 0)
  const wilt = herbPose('wilting', 0)
  for (const key of Object.keys(ready)) {
    assert.ok(Math.abs(ready[key] - resting[key]) < 1e-9, key)
    assert.ok(Math.abs(wilt[key] - resting[key]) < 1e-9, key)
  }
  assert.equal(herbPose('forming', 0).alpha, 0)
  assert.equal(herbPose('wilting', MUSHROOM_TIMING.wilting).alpha, 0)
})

test('lower leaf pairs unfurl before the top pair, and roots stay anchored', () => {
  const halfway = { ...herbPose('forming', MUSHROOM_TIMING.forming * .5), bend: 0, curl: 0 }
  const widthAt = v => deformHerb(.8, v, halfway).x - deformHerb(.2, v, halfway).x
  assert.ok(widthAt(.7) > widthAt(.25) * 1.5)
  assert.equal(deformHerb(.5, .9, halfway).x, .5)
})
