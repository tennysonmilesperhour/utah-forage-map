import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useCurrentUser } from './useAuth'
import { privateQueryOptions, setSessionUser } from '../lib/privateQueries'

export function usePrivateQuery(key, path, enabled = true) {
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  return useQuery(privateQueryOptions(key, user, async ({ signal }) => {
    try {
      return (await axios.get(path, { signal })).data
    } catch (error) {
      if (error.response?.status === 401 && !signal.aborted) setSessionUser(client, null)
      throw error
    }
  }, enabled))
}
