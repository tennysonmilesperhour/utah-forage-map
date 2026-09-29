import { useQuery } from '@tanstack/react-query'
import { prepareDataset } from '../lib/occurrenceGrid'

async function readJson(path, signal) {
  const response = await fetch(path, { signal })
  if (!response.ok) throw new Error(`Could not load ${path}`)
  return response.json()
}

// All-time, research-grade iNaturalist squares for one species, or for the whole
// collection when no species is chosen. Built by data-pipeline/aggregate_occurrence.py.
// The field maps fetch them only once hotspots are switched on.
export function useOccurrence(collection, slug, enabled = true) {
  return useQuery({
    queryKey: ['occurrence', collection, slug || '_all'],
    enabled,
    queryFn: async ({ signal }) => prepareDataset(await readJson(`/data/occurrence/${collection}/${slug || '_all'}.json`, signal)),
    staleTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useGrowingZone(collection, slug) {
  return useQuery({
    queryKey: ['growing-zone', collection, slug],
    enabled: !!slug,
    queryFn: ({ signal }) => readJson(`/data/range/${collection}/${slug}.json`, signal),
    staleTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
