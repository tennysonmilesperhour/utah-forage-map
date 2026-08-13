import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export function useSightings(filters = {}) {
  return useQuery({
    queryKey: ['sightings', filters],
    queryFn: async () => {
      const params = {}
      if (filters.species_id) params.species_id = filters.species_id
      if (filters.month_min != null) params.month_min = filters.month_min
      if (filters.month_max != null) params.month_max = filters.month_max
      if (filters.elev_min != null) params.elev_min = filters.elev_min
      if (filters.elev_max != null) params.elev_max = filters.elev_max
      if (filters.habitat_type) params.habitat_type = filters.habitat_type
      if (filters.source) params.source = filters.source
      if (filters.place) params.place = filters.place
      if (filters.verified_only) params.verified_only = true
      for (const key of ['min_lat', 'max_lat', 'min_lng', 'max_lng']) {
        if (filters[key] != null) params[key] = filters[key]
      }

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
