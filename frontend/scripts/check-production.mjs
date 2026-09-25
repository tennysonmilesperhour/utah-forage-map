const origin = 'https://worldmushroomforaging.org'
const response = await fetch(`${origin}/api/data-status`, { signal: AbortSignal.timeout(20000) })
if (!response.ok) throw new Error(`Freshness endpoint HTTP ${response.status}`)
const status = await response.json()
const covered = Date.parse(status.covered_through?.match(/Z$|[+-]\d\d:\d\d$/) ? status.covered_through : `${status.covered_through}Z`)
console.log(JSON.stringify(status, null, 2))
if (status.status !== 'current' || !Number.isFinite(covered) || Date.now() - covered > 26 * 3600000 || covered > Date.now() + 300000 || status.incremental_backlog) throw new Error('Fungi updates are stale or have an unfinished incremental backlog. Inspect importer logs; do not mark a partial cycle complete.')
