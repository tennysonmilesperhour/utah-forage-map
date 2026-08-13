// Habitat vocabulary for the whole map, not one climate zone.
export const HABITAT_TYPES = [
  'forest',
  'rainforest',
  'boreal forest',
  'woodland',
  'meadow',
  'grassland',
  'savanna',
  'riparian',
  'wetland',
  'alpine',
  'tundra',
  'desert',
  'scrubland',
  'coastal',
  'urban',
]

export function habitatLabel(habitat) {
  return habitat.charAt(0).toUpperCase() + habitat.slice(1)
}
