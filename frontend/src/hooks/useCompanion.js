import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: async () => (await axios.get('/api/regions')).data,
    staleTime: 1000 * 60 * 15,
  })
}

export function useRegion(slug) {
  return useQuery({
    queryKey: ['region', slug],
    queryFn: async () => (await axios.get(`/api/regions/${slug}`)).data,
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 10,
  })
}

export function useSeasonality({ taxonId, regionSlug, hemisphere = 'north' }) {
  return useQuery({
    queryKey: ['seasonality', taxonId, regionSlug, hemisphere],
    queryFn: async () => (await axios.get('/api/seasonality', {
      params: {
        taxon_id: taxonId || undefined,
        region_slug: regionSlug || undefined,
        hemisphere: regionSlug ? undefined : hemisphere,
      },
    })).data,
    staleTime: 1000 * 60 * 60 * 12,
  })
}

export function useObservationRecord(id) {
  return useQuery({
    queryKey: ['observation-record', id],
    queryFn: async () => (await axios.get(`/api/sightings/${id}/record`)).data,
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  })
}

export function useVerifyObservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (
      await axios.post(`/api/sightings/${id}/verifications`, payload)
    ).data,
    onSuccess: data => {
      queryClient.setQueryData(['observation-record', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['sightings'] })
    },
  })
}

export function useAlerts(enabled = true) {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => (await axios.get('/api/account/alerts')).data,
    enabled,
  })
}

function useAlertMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useCreateAlert() {
  return useAlertMutation(async payload => (await axios.post('/api/account/alerts', payload)).data)
}

export function useUpdateAlert() {
  return useAlertMutation(async ({ id, enabled }) => (
    await axios.patch(`/api/account/alerts/${id}`, { enabled })
  ).data)
}

export function useDeleteAlert() {
  return useAlertMutation(async id => axios.delete(`/api/account/alerts/${id}`))
}
