import summary from './occurrence-summary.json' with { type: 'json' }

// Totals, observers and month counts per species from the iNaturalist open-data snapshot.
// Squares and growing zones load separately from /data/ at runtime.
export const occurrenceSummary = summary
export const OCCURRENCE_SNAPSHOT = summary.snapshot
export const occurrenceSnapshotLabel = `snapshot ${new Date(`${summary.snapshot}T12:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`

export function speciesOccurrence(collection, slug) {
  return summary[collection]?.[slug] ?? null
}

export function hemisphereFor(latitude) {
  return Number.isFinite(latitude) && latitude < 0 ? 'south' : 'north'
}
