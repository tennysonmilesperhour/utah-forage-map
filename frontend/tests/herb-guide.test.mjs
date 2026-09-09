import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { herbGuides, herbGuideBySlug, herbRegions, filterHerbGuides, herbComparisonSelection, herbAtlasRoute, herbGuidePath, statusLabels, habitatLabels, useLabels, stageLabels } from '../src/data/herbGuide.js'

test('aliases, accent-insensitive search and scientific names resolve the intended species', () => {
  assert.equal(filterHerbGuides({ q: 'cedron' })[0]?.slug, 'lemon-verbena')
  assert.equal(filterHerbGuides({ q: 'Hibiscus sabdariffa' })[0]?.slug, 'roselle')
  assert.equal(filterHerbGuides({ q: 'Tetragonia tetragonioides' })[0]?.slug, 'warrigal-greens')
  assert.equal(filterHerbGuides({ q: 'urtica' })[0]?.slug, 'stinging-nettle')
})
test('facets intersect; saved-only with no saved plants has no false results', () => {
  assert.equal(filterHerbGuides({ q: 'nettle', region: 'europe', habitat: 'wet-ground' })[0]?.slug, 'stinging-nettle')
  assert.deepEqual(filterHerbGuides({ q: 'nettle', region: 'oceania' }), [])
  assert.deepEqual(filterHerbGuides({ saved: [] }), [])
  assert.deepEqual(filterHerbGuides({ saved: ['wild-garlic'], habitat: 'woodland' }).map(p => p.slug), ['wild-garlic'])
  assert.deepEqual(filterHerbGuides({ q: 'this plant is absent' }), [])
})
test('toxic references remain explicit and cannot imply gathering parts or food use', () => {
  const toxic = filterHerbGuides({ status: 'toxic' })
  assert.equal(toxic.length, 7)
  for (const p of toxic) {
    assert.deepEqual(p.parts, [], p.name)
    assert.deepEqual(p.uses, ['toxic'], p.name)
    assert.deepEqual(p.stages, ['all-stages'], p.name)
    assert.match(p.preparation, /not|never/i, p.name)
  }
})
test('every entry has unambiguous identifiers, valid internal references and source attribution', async () => {
  assert.equal(herbGuides.length, 44)
  assert.equal(new Set(herbGuides.map(p => p.slug)).size, herbGuides.length)
  for (const p of herbGuides) {
    assert.ok(statusLabels[p.status], p.name)
    for (const [values, allowed] of [[p.regions, Object.fromEntries(herbRegions.map(r => [r.slug, r.name]))], [p.habitats, habitatLabels], [p.uses, useLabels], [p.stages, stageLabels]]) for (const v of values) assert.ok(allowed[v], `${p.name}: ${v}`)
    assert.ok(p.marks.length >= 3 && p.caution && p.preparation && p.range && p.season && p.stewardship, p.name)
    assert.ok(p.sources.length && p.sourceChecked === '2026-09-09', p.name)
    assert.match(p.reviewStatus, /pending/, p.name)
    assert.ok(p.lookalikes.length, p.name)
    p.lookalikes.forEach(l => { if (l.slug) assert.ok(herbGuideBySlug[l.slug], `${p.name}: ${l.slug}`) })
    p.sources.forEach(s => assert.ok(s.title && new URL(s.url).protocol === 'https:', p.name))
    assert.ok(p.photos.length, p.name)
    for (const photo of p.photos) {
      assert.doesNotMatch(photo.license, /NC|ND/, p.name)
      assert.ok(photo.credit && photo.source && photo.licenseUrl && photo.originalUrl, p.name)
      await access(new URL(`../public${photo.url}`, import.meta.url))
    }
    assert.equal(herbAtlasRoute(herbGuidePath(p)).plant.slug, p.slug)
  }
  assert.equal(herbAtlasRoute('/herbs/atlas/does-not-exist').type, 'missing')
  assert.equal(herbAtlasRoute('/herbs/atlas/compare').type, 'compare')
})
test('all regions offer real coverage and local references', () => {
  for (const region of herbRegions) {
    assert.ok(filterHerbGuides({ region: region.slug }).length >= 2)
    assert.ok(region.links.length >= 2)
    assert.equal(herbAtlasRoute(`/herbs/regions/${region.slug}`).region.slug, region.slug)
  }
})
test('prerendered plant pages expose evidence and warnings without JavaScript', async () => {
  for (const plant of herbGuides) {
    const html = await readFile(new URL(`../dist/herbs/atlas/${plant.slug}/index.html`, import.meta.url), 'utf8')
    assert.ok(html.includes(plant.latin), plant.name)
    assert.ok(html.includes(`https://worldmushroomforaging.org${plant.photos[0].url}`), plant.name)
    assert.ok(html.includes('Specialist field review pending'), plant.name)
    assert.ok(html.includes('id="sources"') && html.includes('id="lookalikes"'), plant.name)
    assert.ok(html.includes(`https://worldmushroomforaging.org/herbs/atlas/${plant.slug}`), plant.name)
    if (plant.status === 'toxic') assert.ok(html.includes('Toxic. Keep out of food and tea.'), plant.name)
  }
  const sitemap = await readFile(new URL('../dist/sitemap-herbs.xml', import.meta.url), 'utf8')
  assert.equal((sitemap.match(/<loc>/g) || []).length, 53)
  assert.ok(!sitemap.includes('/herbs/atlas/compare'), 'Empty comparison is intentionally not indexed')
})

test('comparison preserves empty columns and rejects duplicates or unknown plants', () => {
  assert.deepEqual(herbComparisonSelection(',wild-garlic'), ['', 'wild-garlic'])
  assert.deepEqual(herbComparisonSelection('wild-garlic,'), ['wild-garlic', ''])
  assert.deepEqual(herbComparisonSelection('wild-garlic,wild-garlic'), ['wild-garlic', ''])
  assert.deepEqual(herbComparisonSelection('unknown,lily-of-the-valley'), ['', 'lily-of-the-valley'])
})
