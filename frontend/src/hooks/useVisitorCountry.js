import { useQuery } from '@tanstack/react-query'
import { loadVisitorCountryCamera } from '../lib/visitorCountry'

export function useVisitorCountry(enabled) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  return useQuery({
    queryKey: ['visitor-country-camera'],
    queryFn: ({ signal }) => loadVisitorCountryCamera({ token, signal }),
    enabled: enabled && !!token,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
