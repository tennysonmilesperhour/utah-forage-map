import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { trackSignupConversion } from '../lib/googleTag'

export function getApiError(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.detail ?? fallback
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      try {
        const { data } = await axios.get('/api/auth/me')
        return data
      } catch (error) {
        if (error.response?.status === 401) return null
        throw error
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
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
      queryClient.setQueryData(['current-user'], user)
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
      queryClient.setQueryData(['current-user'], null)
    },
  })
}

export function useVerifyEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async token => (await axios.post('/api/auth/verify-email', { token })).data,
    onSuccess: user => queryClient.setQueryData(['current-user'], user),
  })
}

export function useResendVerification() {
  return useMutation({ mutationFn: async () => (await axios.post('/api/auth/verification/resend')).data })
}

export function useChangeUnverifiedEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async email => (await axios.patch('/api/account/email', { email })).data,
    onSuccess: user => queryClient.setQueryData(['current-user'], user),
  })
}

export function useForgotPassword() {
  return useMutation({ mutationFn: async email => (await axios.post('/api/auth/password/forgot', { email })).data })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ token, password }) => axios.post('/api/auth/password/reset', { token, password }),
  })
}
