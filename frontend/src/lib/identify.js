// Suggest-an-ID, modelled on iNaturalist's suggestions: candidates ranked by the field marks
// someone saw, by who has recorded them nearby ("Seen nearby") and by the growing zone
// ("Expected nearby"), with a seasonal check. It narrows the search; it never identifies.

export const NEARBY_RADIUS_CELLS = 1

export function cellFor(latitude, longitude) {
  return {
    x: Math.min(359, Math.max(0, Math.floor(longitude + 180))),
    y: Math.min(179, Math.max(0, Math.floor(latitude + 90))),
  }
}

// Tiles that hold the cells within the search radius, limited to tiles the index lists.
export function tilesForLocation(index, latitude, longitude, radius = NEARBY_RADIUS_CELLS) {
  const { x, y } = cellFor(latitude, longitude)
  const available = new Set(index.tiles)
  const names = new Set()
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const cx = (x + dx + 360) % 360
      const cy = y + dy
      if (cy < 0 || cy > 179) continue
      const name = `${Math.floor(cx / index.tile)}_${Math.floor(cy / index.tile)}`
      if (available.has(name)) names.add(name)
    }
  }
  return [...names]
}

export function nearbyEvidence(index, tiles, latitude, longitude, radius = NEARBY_RADIUS_CELLS) {
  const { x, y } = cellFor(latitude, longitude)
  const cells = Object.assign({}, ...tiles.map(tile => tile.cells))
  const seen = new Map()
  const expected = new Set()
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const entry = cells[`${(x + dx + 360) % 360}_${y + dy}`]
      if (!entry) continue
      for (const [speciesIndex, observers] of entry.s ?? []) {
        const slug = index.species[speciesIndex]
        seen.set(slug, (seen.get(slug) ?? 0) + observers)
      }
      for (const speciesIndex of entry.e ?? []) expected.add(index.species[speciesIndex])
    }
  }
  return { seen, expected }
}

// Share of dated records in the chosen month and its neighbours, for one hemisphere.
export function seasonSignal(months, month) {
  const total = months?.reduce((sum, value) => sum + value, 0) ?? 0
  if (total < 20) return null
  const window = [-1, 0, 1].reduce((sum, offset) => sum + months[(month + offset + 12) % 12], 0)
  return window / total >= 0.12
}

export function matchMarks(traits = {}, selected = {}) {
  const chosen = Object.entries(selected).filter(([, value]) => value)
  const matched = chosen.filter(([key, value]) => traits[key]?.includes(value)).map(([key]) => key)
  const missed = chosen.filter(([key, value]) => !traits[key]?.includes(value)).map(([key]) => key)
  return { chosen: chosen.length, matched, missed }
}

export function rankSuggestions({ candidates, traits, selected = {}, evidence, month, hemisphere, summaries, limit = 12 }) {
  const seenMax = Math.max(1, ...(evidence ? [...evidence.seen.values()] : [1]))
  const anyNearby = evidence && (evidence.seen.size > 0 || evidence.expected.size > 0)
  const scored = candidates.map(candidate => {
    const marks = matchMarks(traits[candidate.slug], selected)
    const seenPeople = evidence?.seen.get(candidate.slug) ?? 0
    const expected = evidence?.expected.has(candidate.slug) ?? false
    const inSeason = seasonSignal(summaries[candidate.slug]?.months?.[hemisphere], month)
    const markScore = marks.chosen ? marks.matched.length / marks.chosen : 0.5
    const score = 3 * markScore - 3 * marks.missed.length
      + 2 * (seenPeople ? Math.log1p(seenPeople) / Math.log1p(seenMax) : 0)
      + (expected ? 1.5 : 0)
      + (inSeason === null ? 0.5 : inSeason ? 1 : 0)
    return { ...candidate, marks, seenPeople, expected, inSeason, score }
  })
  // Near a mapped place, suggestions stay local, as on iNaturalist. Elsewhere field marks decide.
  const local = anyNearby ? scored.filter(item => item.seenPeople > 0 || item.expected) : scored
  return local
    .filter(item => item.marks.missed.length === 0 || item.marks.matched.length >= 2)
    .sort((a, b) => b.score - a.score || b.seenPeople - a.seenPeople || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export async function loadNearbyEvidence(collection, latitude, longitude, { fetcher = fetch, signal } = {}) {
  const read = async path => {
    const response = await fetcher(path, { signal })
    if (!response.ok) throw new Error(`Could not load ${path}`)
    return response.json()
  }
  const index = await read(`/data/id-index/${collection}/index.json`)
  const names = tilesForLocation(index, latitude, longitude)
  const tiles = await Promise.all(names.map(name => read(`/data/id-index/${collection}/${name}.json`)))
  return nearbyEvidence(index, tiles, latitude, longitude)
}
