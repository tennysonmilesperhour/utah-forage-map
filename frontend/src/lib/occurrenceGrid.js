// iNaturalist-style grid squares. Verified records are pre-counted into square cells at
// several sizes (see data-pipeline/aggregate_occurrence.py). The map picks the size that
// keeps each square roughly ten pixels wide, so squares subdivide smoothly as you zoom
// instead of one bubble splitting into ten.

export const GRID_LEVELS = [4, 2, 1, 0.5, 0.25, 0.125]
const TARGET_PIXELS = 11
const TILE_PIXELS = 512

export function cellPixels(res, zoom) {
  return (res / 360) * TILE_PIXELS * 2 ** zoom
}

export function levelForZoom(zoom, available = GRID_LEVELS) {
  const ideal = (TARGET_PIXELS * 360) / (TILE_PIXELS * 2 ** Math.max(0, zoom))
  let best = available[0]
  for (const res of available) {
    if (Math.abs(Math.log(res / ideal)) < Math.abs(Math.log(best / ideal))) best = res
  }
  return best
}

export function decodeCells(flat = []) {
  const cells = []
  for (let index = 0; index + 3 < flat.length; index += 4) {
    cells.push({ x: flat[index], y: flat[index + 1], count: flat[index + 2], observers: flat[index + 3] })
  }
  return cells
}

export function cellBounds({ x, y }, res) {
  const west = x * res - 180
  const south = y * res - 90
  return [west, south, Math.min(180, west + res), Math.min(90, south + res)]
}

export function cellAt(longitude, latitude, res) {
  return { x: Math.floor((longitude + 180) / res), y: Math.floor((latitude + 90) / res) }
}

// Intensity follows the number of different people who reported from a square, on a log
// scale capped at the 95th percentile so one busy city park does not dim everything else.
export function intensityScale(cells) {
  if (!cells.length) return () => 0
  const values = cells.map(cell => cell.observers).sort((a, b) => a - b)
  const cap = Math.max(2, values[Math.min(values.length - 1, Math.floor(values.length * 0.95))])
  const denominator = Math.log1p(cap)
  return observers => Math.max(0.08, Math.min(1, Math.log1p(observers) / denominator))
}

function intersects([west, south, east, north], bounds) {
  if (!bounds) return true
  const crossesDateLine = bounds.west > bounds.east
  const withinLatitude = north >= bounds.south && south <= bounds.north
  if (!withinLatitude) return false
  if (crossesDateLine) return east >= bounds.west || west <= bounds.east
  return east >= bounds.west && west <= bounds.east
}

// Squares just outside the view are drawn too, so a short pan does not reveal an empty edge.
export function paddedBounds(bounds, res, share = 0.35) {
  if (!bounds) return null
  const lonSpan = bounds.west <= bounds.east ? bounds.east - bounds.west : bounds.east + 360 - bounds.west
  const padLon = Math.max(res * 2, lonSpan * share)
  const padLat = Math.max(res * 2, (bounds.north - bounds.south) * share)
  return {
    west: Math.max(-180, bounds.west - padLon),
    east: Math.min(180, bounds.east + padLon),
    south: Math.max(-90, bounds.south - padLat),
    north: Math.min(90, bounds.north + padLat),
  }
}

// Hotspots are the busiest squares in view: the top tenth by different people, or the
// top dozen where fewer squares are in view, and never a one-person square. Ranking
// within the view keeps a quieter region's busiest ground visible.
const HOTSPOT_SHARE = 0.1
const MIN_HOTSPOTS = 12

export function hotspotThreshold(level, bounds = null) {
  if (!level) return Infinity
  const values = (level.decoded ?? decodeCells(level.cells))
    .filter(cell => intersects(cellBounds(cell, level.res), bounds))
    .map(cell => cell.observers)
    .sort((a, b) => b - a)
  if (!values.length) return Infinity
  const rank = Math.max(Math.ceil(values.length * HOTSPOT_SHARE), Math.min(values.length, MIN_HOTSPOTS)) - 1
  return Math.max(2, values[rank])
}

// Hotspots are shaded from the cut-off up to the busiest drawn, starting part-way up the
// ramp so the least busy hotspot still stands out.
export function hotspotScale(cells, minObservers) {
  const values = cells.map(cell => cell.observers).sort((a, b) => a - b)
  const cap = values[Math.min(values.length - 1, Math.floor(values.length * 0.95))] ?? minObservers
  const span = Math.log(cap / minObservers)
  return observers => span > 0 ? Math.max(0.3, Math.min(1, 0.3 + (0.7 * Math.log(observers / minObservers)) / span)) : 1
}

export function squaresGeoJSON(level, bounds = null, { minObservers = 0 } = {}) {
  if (!level) return { type: 'FeatureCollection', features: [] }
  const cells = level.decoded ?? decodeCells(level.cells)
  const visible = paddedBounds(bounds, level.res)
  const shown = []
  for (const cell of cells) {
    if (cell.observers < minObservers) continue
    const box = cellBounds(cell, level.res)
    if (intersects(box, visible)) shown.push({ cell, box })
  }
  const scale = minObservers > 0 ? hotspotScale(shown.map(item => item.cell), minObservers) : intensityScale(cells)
  const features = shown.map(({ cell, box: [west, south, east, north] }, id) => ({
    type: 'Feature',
    id,
    geometry: { type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] },
    properties: { count: cell.count, observers: cell.observers, intensity: Number(scale(cell.observers).toFixed(3)), res: level.res, cx: (west + east) / 2, cy: (south + north) / 2 },
  }))
  return { type: 'FeatureCollection', features }
}

export function prepareDataset(payload) {
  if (!payload?.levels) return null
  return {
    ...payload,
    levels: payload.levels.map(level => ({ ...level, decoded: decodeCells(level.cells) })),
  }
}

export function datasetLevel(dataset, zoom) {
  if (!dataset?.levels?.length) return null
  const res = levelForZoom(zoom, dataset.levels.map(level => level.res))
  return dataset.levels.find(level => level.res === res) ?? null
}

// Approximate edge length of a square in kilometres at its latitude, for tooltips.
export function squareSizeLabel(res, latitude = 0) {
  const kilometres = res * 111.32
  const eastWest = kilometres * Math.cos((latitude * Math.PI) / 180)
  const rounded = value => value >= 100 ? Math.round(value / 10) * 10 : Math.round(value)
  return `${rounded(eastWest)} × ${rounded(kilometres)} km`
}

export function geometryBounds(geometry) {
  let west = 180, south = 90, east = -180, north = -90
  const visit = coordinates => {
    if (typeof coordinates[0] === 'number') {
      west = Math.min(west, coordinates[0]); east = Math.max(east, coordinates[0])
      south = Math.min(south, coordinates[1]); north = Math.max(north, coordinates[1])
      return
    }
    coordinates.forEach(visit)
  }
  if (geometry?.coordinates) visit(geometry.coordinates)
  return west <= east ? [west, south, east, north] : null
}

export const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function peakMonths(months = [], share = 0.6) {
  const total = months.reduce((sum, value) => sum + value, 0)
  if (!total) return []
  const ranked = months.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value)
  const chosen = []
  let covered = 0
  for (const month of ranked) {
    if (covered / total >= share) break
    chosen.push(month.index)
    covered += month.value
  }
  return chosen.sort((a, b) => a - b)
}

export function monthRangeLabel(indexes = []) {
  if (!indexes.length) return 'Not enough dated records'
  const runs = []
  for (const index of indexes) {
    const last = runs.at(-1)
    if (last && index === last[1] + 1) last[1] = index
    else runs.push([index, index])
  }
  // Join a run that wraps from December into January.
  if (runs.length > 1 && runs[0][0] === 0 && runs.at(-1)[1] === 11) {
    const wrap = runs.pop()
    runs[0] = [wrap[0], runs[0][1]]
  }
  const short = index => MONTH_NAMES[index].slice(0, 3)
  return runs.map(([start, end]) => start === end ? short(start) : `${short(start)}–${short(end)}`).join(', ')
}
