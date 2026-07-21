import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from '@/lib/api'
import {
  clearSessionToken,
  getSessionToken,
  setDisplayName,
  setSessionToken,
} from '@/lib/identity'
import type { Session, User } from '@/lib/types'

// The signed-in host account. `user` is null while signed out; `isPending`
// covers the initial session probe so route guards can wait for it.
export function useAuth() {
  const query = useQuery<User | null>({
    queryKey: ['me'],
    queryFn: () => {
      const token = getSessionToken()
      if (!token) return null
      return api.me(token).then((user) => {
        if (user === null) clearSessionToken() // expired or revoked
        return user
      })
    },
    staleTime: 60_000,
  })
  return { user: query.data ?? null, isPending: query.isPending }
}

function useSessionStart() {
  const queryClient = useQueryClient()
  return (session: Session) => {
    setSessionToken(session.token)
    setDisplayName(session.user.name)
    queryClient.setQueryData(['me'], session.user)
  }
}

export function useSignUp(onSuccess: () => void) {
  const start = useSessionStart()
  return useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      api.signUp(email, password, name),
    onSuccess: (session) => {
      start(session)
      toast.success(`Welcome, ${session.user.name}`)
      onSuccess()
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSignIn(onSuccess: () => void) {
  const start = useSessionStart()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.signIn(email, password),
    onSuccess: (session) => {
      start(session)
      toast.success(`Welcome back, ${session.user.name}`)
      onSuccess()
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSignOut(onSuccess: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const token = getSessionToken()
      if (token) await api.signOut(token)
    },
    onSuccess: () => {
      clearSessionToken()
      queryClient.setQueryData(['me'], null)
      queryClient.removeQueries({ queryKey: ['my-events'] })
      toast.success('Signed out')
      onSuccess()
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useChangePassword(onSuccess: () => void) {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      api.changePassword(current, next),
    onSuccess: () => {
      toast.success('Password changed — other devices were signed out')
      onSuccess()
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
