import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { trackSignupConversion } from '../lib/googleTag'
import { clearPrivateQueries, setSessionUser } from '../lib/privateQueries'

export function getApiError(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.detail ?? fallback
}

export function useCurrentUser() {
  const client = useQueryClient()
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async ({ signal }) => {
      try {
        const { data } = await axios.get('/api/auth/me', { signal })
        if (!signal.aborted && client.getQueryData(['current-user'])?.id !== data?.id) clearPrivateQueries(client)
        return data
      } catch (error) {
        if (error.response?.status === 401) {
          if (!signal.aborted) clearPrivateQueries(client)
          return null
        }
        throw error
      }
    },
    retry: false,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  })
}

function useAuthMutation(path, options = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await axios.post(path, payload)
      return data
    },
    onSuccess: (user, variables, context) => {
      setSessionUser(queryClient, user)
      options.onSuccess?.(user, variables, context)
    },
  })
}

export function useRegister() {
  return useAuthMutation('/api/auth/register', {
    onSuccess: () => trackSignupConversion(),
  })
}

export function useLogin() {
  return useAuthMutation('/api/auth/login')
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await axios.post('/api/auth/logout')
    },
    onSuccess: () => {
      setSessionUser(queryClient, null)
    },
  })
}

export function useVerifyEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async token => (await axios.post('/api/auth/verify-email', { token })).data,
    onSuccess: user => setSessionUser(queryClient, user),
  })
}

export function useResendVerification() {
  return useMutation({ mutationFn: async () => (await axios.post('/api/auth/verification/resend')).data })
}

export function useChangeUnverifiedEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async email => (await axios.patch('/api/account/email', { email })).data,
    onSuccess: user => setSessionUser(queryClient, user),
  })
}

export function useForgotPassword() {
  return useMutation({ mutationFn: async email => (await axios.post('/api/auth/password/forgot', { email })).data })
}

export function useResetPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ token, password }) => axios.post('/api/auth/password/reset', { token, password }),
    onSuccess: () => setSessionUser(queryClient, null),
  })
}
