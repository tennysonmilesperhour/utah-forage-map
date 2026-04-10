import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export function useSightings(filters = {}) {
  return useQuery({
    queryKey: ['sightings', filters],
    queryFn: async () => {
      const params = {}
      if (filters.month_min != null) params.month_min = filters.month_min
      if (filters.month_max != null) params.month_max = filters.month_max
      if (filters.elev_min != null) params.elev_min = filters.elev_min
      if (filters.elev_max != null) params.elev_max = filters.elev_max
      if (filters.habitat_type) params.habitat_type = filters.habitat_type
      if (filters.source) params.source = filters.source
      if (filters.verified_only) params.verified_only = true

      const { data } = await axios.get('/api/sightings', { params })
      return data
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useSpecies() {
  return useQuery({
    queryKey: ['species'],
    queryFn: async () => {
      const { data } = await axios.get('/api/species')
      return data
    },
    staleTime: 1000 * 60 * 60,
  })
}
