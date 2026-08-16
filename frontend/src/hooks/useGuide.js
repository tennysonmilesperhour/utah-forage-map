import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const GUIDE_VOTER_STORAGE_KEY = 'mushroom-guide-voter'

function getGuideVoterToken() {
  if (typeof window === 'undefined' || typeof window.crypto?.randomUUID !== 'function') return null
  try {
    const stored = window.localStorage.getItem(GUIDE_VOTER_STORAGE_KEY)
    if (stored) return stored
    const token = window.crypto.randomUUID()
    window.localStorage.setItem(GUIDE_VOTER_STORAGE_KEY, token)
    return token
  } catch {
    return window.crypto.randomUUID()
  }
}

export function useGuideSummaries() {
  return useQuery({
    queryKey: ['guide-species-summaries'],
    queryFn: async () => {
      const { data } = await axios.get('/api/guide/species')
      return data
    },
    staleTime: 1000 * 60 * 15,
  })
}

export function useGuideRequests() {
  const [voterToken] = useState(getGuideVoterToken)
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['guide-requests', voterToken],
    queryFn: async () => {
      const { data } = await axios.get('/api/guide/requests', {
        headers: { 'X-Guide-Voter': voterToken },
      })
      return data
    },
    enabled: Boolean(voterToken),
    staleTime: 1000 * 60 * 5,
  })
  const vote = useMutation({
    mutationFn: async choiceSlug => {
      const { data } = await axios.post('/api/guide/requests', { choice_slug: choiceSlug }, {
        headers: { 'X-Guide-Voter': voterToken },
      })
      return data
    },
    onSuccess: data => queryClient.setQueryData(['guide-requests', voterToken], data),
  })

  return { ...query, vote }
}
