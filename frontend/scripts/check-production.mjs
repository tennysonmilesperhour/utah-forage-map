import { pathToFileURL } from 'node:url'

export async function checkFreshness(origin = 'https://worldmushroomforaging.org', fetchImpl = fetch, now = Date.now()) {
  const response = await fetchImpl(`${origin}/api/data-status`, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Freshness endpoint HTTP ${response.status}: ${body.slice(0, 500)}`)
  }
  const status = await response.json()
  const covered = Date.parse(status.covered_through?.match(/Z$|[+-]\d\d:\d\d$/) ? status.covered_through : `${status.covered_through}Z`)
  console.log(JSON.stringify(status, null, 2))
  if (status.status !== 'current' || !Number.isFinite(covered) || now - covered > 26 * 3600000 || covered > now + 300000 || status.incremental_backlog) {
    throw new Error('Fungi updates are stale or have an unfinished incremental backlog. Inspect importer logs; do not mark a partial cycle complete.')
  }
  return status
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkFreshness()
}
