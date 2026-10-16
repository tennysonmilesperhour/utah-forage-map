export function canLoadSightings({ areaSelected, mapSettled }) {
  return Boolean(areaSelected && mapSettled)
}
