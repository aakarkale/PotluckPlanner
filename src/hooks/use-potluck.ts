import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from '@/lib/api'
import { ApiError } from '@/lib/api'
import type { EventData } from '@/lib/types'

// Live updates via short polling — deliberately simpler than websockets and
// plenty for a ~20-friend potluck (same decision as v1).
const EVENT_POLL_MS = 1500
const DASHBOARD_POLL_MS = 5000

export function useEvent(slug: string) {
  return useQuery<EventData>({
    queryKey: ['event', slug],
    queryFn: () => api.getEvent(slug),
    refetchInterval: EVENT_POLL_MS,
    retry: (failureCount, error) =>
      // A missing event will not appear by retrying.
      !(error instanceof ApiError && error.code === 'event_not_found') && failureCount < 1,
  })
}

export function useMyEvents(enabled: boolean) {
  return useQuery({
    queryKey: ['my-events'],
    queryFn: api.myEvents,
    refetchInterval: DASHBOARD_POLL_MS,
    enabled,
  })
}

function useInvalidate(...keys: string[][]) {
  const queryClient = useQueryClient()
  return () => {
    for (const key of keys) queryClient.invalidateQueries({ queryKey: key })
  }
}

const onError = (error: Error) => toast.error(error.message)

// ---------------------------------------------------------------------------
// Events (host admin)
// ---------------------------------------------------------------------------

export function useCreateEvent(onSuccess: (slug: string) => void) {
  const invalidate = useInvalidate(['my-events'])
  return useMutation({
    mutationFn: api.createEvent,
    onSuccess: (event) => {
      invalidate()
      toast.success(`${event.name} is ready — share the link`)
      onSuccess(event.slug)
    },
    onError,
  })
}

export function useUpdateEvent(slug: string) {
  const invalidate = useInvalidate(['my-events'], ['event', slug])
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.EventInput }) =>
      api.updateEvent(id, input),
    onSuccess: () => {
      invalidate()
      toast.success('Potluck updated')
    },
    onError,
  })
}

export function useSetGuestCount(slug: string) {
  const invalidate = useInvalidate(['my-events'], ['event', slug])
  return useMutation({
    mutationFn: ({ id, guestCount }: { id: string; guestCount: number }) =>
      api.setGuestCount(id, guestCount),
    onSuccess: () => {
      invalidate()
      toast.success('Guest count updated')
    },
    onError,
  })
}

export function useDeleteEvent(onSuccess: () => void) {
  const invalidate = useInvalidate(['my-events'])
  return useMutation({
    mutationFn: api.deleteEvent,
    onSuccess: () => {
      invalidate()
      toast.success('Potluck deleted')
      onSuccess()
    },
    onError,
  })
}

export function useRotateSlug(onSuccess: (slug: string) => void) {
  const invalidate = useInvalidate(['my-events'])
  return useMutation({
    mutationFn: api.rotateSlug,
    onSuccess: (event) => {
      invalidate()
      toast.success('New link minted — the old one no longer works')
      onSuccess(event.slug)
    },
    onError,
  })
}

// ---------------------------------------------------------------------------
// Dishes
// ---------------------------------------------------------------------------

export function useCreateDish(slug: string) {
  const invalidate = useInvalidate(['event', slug])
  return useMutation({
    mutationFn: (input: api.DishInput) => api.createDish(slug, input),
    onSuccess: (dish) => {
      invalidate()
      toast.success(`Added ${dish.name}`)
    },
    onError,
  })
}

export function useUpdateDish(slug: string) {
  const invalidate = useInvalidate(['event', slug])
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.DishInput }) =>
      api.updateDish(id, input),
    onSuccess: () => {
      invalidate()
      toast.success('Dish updated')
    },
    onError,
  })
}

export function useClaimDish(slug: string) {
  const invalidate = useInvalidate(['event', slug])
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.claimDish(id, name),
    onSuccess: (dish) => {
      invalidate()
      toast.success(`${dish.broughtBy} is bringing ${dish.name}`)
    },
    onError,
  })
}

export function useDeleteDish(slug: string) {
  const invalidate = useInvalidate(['event', slug])
  return useMutation({
    mutationFn: api.deleteDish,
    onSuccess: () => {
      invalidate()
      toast.success('Dish removed')
    },
    onError,
  })
}
