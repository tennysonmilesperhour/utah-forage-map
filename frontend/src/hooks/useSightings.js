import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

function dateDaysAgo(days) {
  const value = new Date()
  value.setHours(12, 0, 0, 0)
  value.setDate(value.getDate() - days)
  return value.toISOString().slice(0, 10)
}

export function useSightings(filters = {}, viewport = null) {
  return useQuery({
    queryKey: ['sightings', filters, viewport],
    queryFn: async () => {
      const params = {}
      if (filters.species_id) params.species_id = filters.species_id
      if (filters.month_min != null) params.month_min = filters.month_min
      if (filters.month_max != null) params.month_max = filters.month_max
      if (filters.elev_min_m != null) params.elev_min = Math.round(filters.elev_min_m * 3.28084)
      if (filters.elev_max_m != null) params.elev_max = Math.round(filters.elev_max_m * 3.28084)
      if (filters.habitat_type) params.habitat_type = filters.habitat_type
      if (filters.source) params.source = filters.source
      if (filters.place) params.place = filters.place
      if (filters.verified_only) params.verified_only = true
      if (filters.recent_days) params.found_after = dateDaysAgo(filters.recent_days)
      if (viewport) Object.assign(params, viewport)
      params.limit = 4000

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

export function useCreateSighting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await axios.post('/api/sightings', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sightings'] })
      queryClient.invalidateQueries({ queryKey: ['species'] })
      queryClient.invalidateQueries({ queryKey: ['logbook'] })
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
    },
  })
}

export function useCommunityPortal() {
  return useQuery({
    queryKey: ['community-portal'],
    queryFn: async () => {
      const [finds, events, clubs, resources] = await Promise.all([
        axios.get('/api/community/finds'),
        axios.get('/api/community/events'),
        axios.get('/api/community/clubs'),
        axios.get('/api/resources'),
      ])

      return {
        finds: finds.data,
        events: events.data,
        clubs: clubs.data,
        resources: resources.data,
      }
    },
    staleTime: 1000 * 60 * 10,
  })
}
