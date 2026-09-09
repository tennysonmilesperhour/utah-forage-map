import test from 'node:test'
import assert from 'node:assert/strict'
import { nextSupporterPoem, SUPPORTER_POEMS } from '../src/data/supporter-poems.js'

test('supporter mushroom rotates through exactly 40 distinct poems', () => {
  assert.equal(SUPPORTER_POEMS.length, 40)
  assert.equal(new Set(SUPPORTER_POEMS.map(poem => poem.title)).size, 40)
  assert.ok(SUPPORTER_POEMS.every(poem => poem.lines.length === 3 && poem.lines.every(Boolean)))
})

test('poem rotation visits every poem once before repeating', () => {
  let index = 0
  const visited = new Set([index])
  for (let turn = 1; turn < SUPPORTER_POEMS.length; turn += 1) {
    index = nextSupporterPoem(index)
    assert.equal(visited.has(index), false)
    visited.add(index)
  }
  assert.equal(nextSupporterPoem(index), 0)
})
