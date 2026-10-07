import test from 'node:test'
import assert from 'node:assert/strict'
import { localDateKey, observationResults, plannedPlaces, revisitCalendar, revisitStatus, observationPath } from '../src/lib/fieldPlanning.js'
const records = [
  { id: 'a', species: { common_name: 'Morel', latin_name: 'Morchella' }, place_name: 'Utah', habitat_type: 'Aspen', found_on: '2026-05-01' },
  { id: 'b', species: { common_name: 'Bolete' }, place_name: 'Colorado', found_on: '2026-09-01' },
  { id: 'c', species: { common_name: 'Morel' }, found_on: null },
]
test('observations search all words across species, place and habitat without mutating data', () => {
  assert.deepEqual(observationResults(records, { query: 'morchella UTAH aspen' }).map(x => x.id), ['a'])
  assert.deepEqual(observationResults(records).map(x => x.id), ['b', 'a', 'c'])
  assert.deepEqual(records.map(x => x.id), ['a', 'b', 'c'])
  assert.deepEqual(observationResults(records, { sort: 'species' }).map(x => x.id), ['b', 'a', 'c'])
})
test('saved filter intersects the loaded map results', () => {
  assert.deepEqual(observationResults(records, { savedOnly: true, savedIds: new Set(['a', 'outside']) }).map(x => x.id), ['a'])
  assert.deepEqual(observationResults(records, { query: 'missing' }), [])
})
test('plans place dated visits first and preserve the source array', () => {
  const items = [{ title: 'Undated' }, { title: 'Later', revisit_on: '2026-10-10' }, { title: 'Earlier', revisit_on: '2026-10-01' }]
  assert.deepEqual(plannedPlaces(items).map(x => x.title), ['Earlier', 'Later', 'Undated'])
  assert.equal(items[0].title, 'Undated')
  assert.equal(revisitStatus('2026-10-05', '2026-10-06'), 'Ready to revisit')
  assert.equal(revisitStatus('2026-10-06', '2026-10-06'), 'Planned for today')
  assert.equal(localDateKey(new Date(2026, 0, 2, 0, 30)), '2026-01-02')
})
test('calendar respects year rollover, escapes text, and omits private data', () => {
  const calendar = revisitCalendar({ id: 'place-1', title: 'Aspen, ridge; notes\nBEGIN:VEVENT', revisit_on: '2026-12-31', notes: 'PRIVATE_NOTE', latitude: 40.123456, longitude: -111.654321 }, new Date('2026-10-06T12:00:00Z'))
  assert.match(calendar, /DTSTART;VALUE=DATE:20261231/)
  assert.match(calendar, /DTEND;VALUE=DATE:20270101/)
  assert.match(calendar, /Aspen\\, ridge\\; notes\\nBEGIN:VEVENT/)
  assert.equal(calendar.split('\r\nBEGIN:VEVENT\r\n').length, 2)
  assert.doesNotMatch(calendar, /PRIVATE_NOTE|40.123456|-111.654321/)
  assert.match(calendar, /CLASS:PRIVATE/)
  assert.equal(observationPath('abc?x=1'), '/map?observation=abc%3Fx%3D1')
})
test('calendar handles leap dates and folds Unicode safely', () => {
  const calendar = revisitCalendar({ id: '1', title: '🌲'.repeat(100), revisit_on: '2028-02-29' })
  assert.match(calendar, /DTEND;VALUE=DATE:20280301/)
  assert.ok(calendar.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75))
  assert.ok(calendar.replace(/\r\n /g, '').includes('🌲'.repeat(100)))
  assert.throws(() => revisitCalendar({ revisit_on: '2026-02-30' }))
  assert.throws(() => revisitCalendar({ revisit_on: '' }))
})
