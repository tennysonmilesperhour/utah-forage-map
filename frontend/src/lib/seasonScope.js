export function hemisphereForBounds(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null
  if (bbox[1] >= 0) return 'north'
  if (bbox[3] <= 0) return 'south'
  return null // Countries crossing the equator need an explicit choice.
}
