import test from 'node:test'
import assert from 'node:assert/strict'
import { BANNER_FADE_MS, initialSupporterLife, supporterLife, supporterPhaseDuration } from '../src/lib/supporterLifecycle.js'

test('invitation survives wilt and rest, fading only before the next emergence', () => {
  let life = supporterLife(initialSupporterLife, 'tick')
  assert.equal(life.phase, 'forming')
  assert.equal(life.banner, 'hidden')
  for (const phase of ['offering', 'wilting', 'dormant']) {
    life = supporterLife(life, 'tick')
    assert.equal(life.phase, phase)
    assert.equal(life.banner, 'visible')
  }
  assert.equal(supporterPhaseDuration(life), 28000)
  life = supporterLife(life, 'tick')
  assert.equal(life.phase, 'fading')
  assert.equal(life.banner, 'fading')
  assert.equal(supporterPhaseDuration(life), BANNER_FADE_MS)
  life = supporterLife(life, 'tick')
  assert.equal(life.phase, 'forming')
  assert.equal(life.banner, 'hidden')
})

test('explicit dismissal hides the invitation without regrowing a resting mushroom', () => {
  for (const phase of ['offering', 'wilting', 'dormant', 'fading']) {
    const life = supporterLife({ phase, cycle: 1, banner: 'visible' }, 'dismiss')
    assert.equal(life.banner, 'hidden')
    assert.equal(life.phase, ['dormant', 'fading'].includes(phase) ? 'dormant' : 'wilting')
  }
})

test('manual replay fades a lingering invitation and reduced-motion opening is immediate', () => {
  const resting = { phase: 'dormant', cycle: 1, banner: 'visible' }
  assert.equal(supporterLife(resting, 'start').phase, 'fading')
  assert.deepEqual(supporterLife(initialSupporterLife, 'open'), { phase: 'offering', cycle: 0, banner: 'visible' })
})
