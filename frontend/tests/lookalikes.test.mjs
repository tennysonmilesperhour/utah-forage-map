import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import matter from 'gray-matter'

// Lookalike severity means one thing everywhere: the worst outcome if the two
// species are mixed up, in either direction. Both pages of a pair therefore
// carry the same word, and it is never milder than the more dangerous species.
const SEVERITIES = ['harmless', 'caution', 'toxic', 'deadly']
const FLOOR = { choice: 'harmless', edible: 'harmless', inedible: 'harmless', caution: 'caution', poisonous: 'toxic', deadly: 'deadly' }
const rank = severity => SEVERITIES.indexOf(severity)

const directory = new URL('../content/species/', import.meta.url)
const guides = await Promise.all((await readdir(directory)).filter(file => file.endsWith('.md'))
  .map(async file => ({ file, ...matter(await readFile(new URL(file, directory), 'utf8')).data })))
const bySlug = Object.fromEntries(guides.map(guide => [guide.slug, guide]))

test('every lookalike uses the shared severity scale', () => {
  for (const guide of guides) for (const item of guide.lookalikes) {
    assert.ok(SEVERITIES.includes(item.severity), `${guide.file}: ${item.name} has severity ${item.severity}`)
  }
})

test('every edibility rating maps to a severity floor', () => {
  for (const guide of guides) assert.ok(guide.edibility in FLOOR, `${guide.file}: unknown edibility ${guide.edibility}`)
})

test('linked lookalikes are reciprocal', () => {
  const missing = []
  for (const guide of guides) for (const item of guide.lookalikes) {
    if (!item.slug) continue
    const other = bySlug[item.slug]
    assert.ok(other, `${guide.file}: ${item.slug} is not a guide`)
    if (!other.lookalikes.some(back => back.slug === guide.slug)) missing.push(`${other.slug} should list ${guide.slug}`)
  }
  assert.deepEqual(missing, [])
})

test('both pages of a pair print the same severity', () => {
  const mismatched = []
  for (const guide of guides) for (const item of guide.lookalikes) {
    const back = item.slug && bySlug[item.slug].lookalikes.find(entry => entry.slug === guide.slug)
    if (back && back.severity !== item.severity) mismatched.push(`${guide.slug} -> ${item.slug}: ${item.severity} vs ${back.severity}`)
  }
  assert.deepEqual(mismatched, [])
})

test('a severity is never milder than the more dangerous species of the pair', () => {
  const tooMild = []
  for (const guide of guides) for (const item of guide.lookalikes) {
    const floors = [FLOOR[guide.edibility], item.slug ? FLOOR[bySlug[item.slug].edibility] : 'harmless']
    const floor = floors.reduce((worst, value) => rank(value) > rank(worst) ? value : worst)
    if (rank(item.severity) < rank(floor)) tooMild.push(`${guide.slug} -> ${item.slug ?? item.name}: ${item.severity} is below ${floor}`)
  }
  assert.deepEqual(tooMild, [])
})

test('no guide tells readers to taste a mushroom to identify it', async () => {
  for (const guide of guides) {
    const source = await readFile(new URL(guide.file, directory), 'utf8')
    assert.doesNotMatch(source, /spit (it )?out|taste a tiny|tiny piece to your tongue|test a tiny piece/i, guide.file)
  }
})
