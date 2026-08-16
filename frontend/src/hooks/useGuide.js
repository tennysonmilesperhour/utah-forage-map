import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

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
