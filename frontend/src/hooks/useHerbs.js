import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

function useAccountQuery(key, path, enabled) {
  return useQuery({ queryKey: [key], queryFn: async () => (await axios.get(path)).data, enabled })
}

function useInvalidatingMutation(fn, keys) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] })) })
}

export function useHerbAlmanac(location) {
  return useQuery({
    queryKey: ['herb-almanac', location?.latitude, location?.longitude],
    queryFn: async () => (await axios.get('/api/herbs/almanac', { params: location ?? {} })).data,
    staleTime: 1000 * 60 * 30,
  })
}

export function useHerbWatchZones(enabled) {
  return useAccountQuery('herb-watch-zones', '/api/account/herb-watch-zones', enabled)
}

export function useHerbInventory(enabled) {
  return useAccountQuery('herb-inventory', '/api/account/herb-inventory', enabled)
}

export function useHerbWishlist(enabled) {
  return useAccountQuery('herb-wishlist', '/api/account/herb-wishlist', enabled)
}

export function useCreateHerbWatchZone() {
  return useInvalidatingMutation(async payload => (await axios.post('/api/account/herb-watch-zones', payload)).data, ['herb-watch-zones'])
}

export function useUpdateHerbWatchZone() {
  return useInvalidatingMutation(async ({ id, ...payload }) => (await axios.patch(`/api/account/herb-watch-zones/${id}`, payload)).data, ['herb-watch-zones'])
}

export function useDeleteHerbWatchZone() {
  return useInvalidatingMutation(async id => axios.delete(`/api/account/herb-watch-zones/${id}`), ['herb-watch-zones'])
}

export function useCreateHerbInventory() {
  return useInvalidatingMutation(async payload => (await axios.post('/api/account/herb-inventory', payload)).data, ['herb-inventory'])
}

export function useUpdateHerbInventory() {
  return useInvalidatingMutation(async ({ id, ...payload }) => (await axios.patch(`/api/account/herb-inventory/${id}`, payload)).data, ['herb-inventory'])
}

export function useDeleteHerbInventory() {
  return useInvalidatingMutation(async id => axios.delete(`/api/account/herb-inventory/${id}`), ['herb-inventory'])
}

export function useCreateHerbWishlist() {
  return useInvalidatingMutation(async payload => (await axios.post('/api/account/herb-wishlist', payload)).data, ['herb-wishlist'])
}

export function useDeleteHerbWishlist() {
  return useInvalidatingMutation(async id => axios.delete(`/api/account/herb-wishlist/${id}`), ['herb-wishlist'])
}
