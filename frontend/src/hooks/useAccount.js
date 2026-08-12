import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

function useAccountQuery(key, path, enabled = true) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => (await axios.get(path)).data,
    enabled,
  })
}

export function useLogbook(enabled = true) {
  return useAccountQuery('logbook', '/api/account/logbook', enabled)
}

export function useSavedLocations(enabled = true) {
  return useAccountQuery('saved-locations', '/api/account/saved', enabled)
}

export function useSessions(enabled = true) {
  return useAccountQuery('account-sessions', '/api/account/sessions', enabled)
}

export function useModerationQueue(enabled = true) {
  return useAccountQuery('moderation-queue', '/api/moderation/sightings?status=pending', enabled)
}

function useInvalidatingMutation(mutationFn, keys) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] })),
  })
}

export function useUpdateLogbook() {
  return useInvalidatingMutation(
    async ({ id, ...payload }) => (await axios.patch(`/api/account/logbook/${id}`, payload)).data,
    ['logbook', 'sightings'],
  )
}

export function useDeleteLogbook() {
  return useInvalidatingMutation(
    async id => axios.delete(`/api/account/logbook/${id}`),
    ['logbook', 'sightings', 'current-user'],
  )
}

export function useSaveLocation() {
  return useInvalidatingMutation(
    async payload => (await axios.post('/api/account/saved', payload)).data,
    ['saved-locations'],
  )
}

export function useDeleteSavedLocation() {
  return useInvalidatingMutation(
    async id => axios.delete(`/api/account/saved/${id}`),
    ['saved-locations'],
  )
}

export function useRevokeSession() {
  return useInvalidatingMutation(
    async id => axios.delete(`/api/account/sessions/${id}`),
    ['account-sessions'],
  )
}

export function useRevokeOtherSessions() {
  return useInvalidatingMutation(
    async () => axios.post('/api/account/sessions/revoke-others'),
    ['account-sessions'],
  )
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async password => axios.delete('/api/account', { data: { password } }),
    onSuccess: () => queryClient.setQueryData(['current-user'], null),
  })
}

export function useReviewSighting() {
  return useInvalidatingMutation(
    async ({ id, status, notes }) => (await axios.patch(`/api/moderation/sightings/${id}`, { status, notes })).data,
    ['moderation-queue', 'sightings'],
  )
}
