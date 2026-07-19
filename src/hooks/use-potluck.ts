import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from '@/lib/api'

// Live updates via short polling — deliberately simpler than websockets and
// plenty for a ~20-friend potluck (same decision as the original app).
const POLL_MS = 1500

export function useDishes() {
  return useQuery({
    queryKey: ['dishes'],
    queryFn: api.listDishes,
    refetchInterval: POLL_MS,
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    refetchInterval: POLL_MS,
  })
}

function useInvalidate(key: 'dishes' | 'settings') {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [key] })
}

const onError = (error: Error) => toast.error(error.message)

export function useCreateDish() {
  const invalidate = useInvalidate('dishes')
  return useMutation({
    mutationFn: api.createDish,
    onSuccess: (dish) => {
      invalidate()
      toast.success(`Added ${dish.name}`)
    },
    onError,
  })
}

export function useUpdateDish() {
  const invalidate = useInvalidate('dishes')
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

export function useClaimDish() {
  const invalidate = useInvalidate('dishes')
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.claimDish(id, name),
    onSuccess: (dish) => {
      invalidate()
      toast.success(`${dish.broughtBy} is bringing ${dish.name}`)
    },
    onError,
  })
}

export function useDeleteDish() {
  const invalidate = useInvalidate('dishes')
  return useMutation({
    mutationFn: api.deleteDish,
    onSuccess: () => {
      invalidate()
      toast.success('Dish removed')
    },
    onError,
  })
}

export function useSetGuestCount() {
  const invalidate = useInvalidate('settings')
  return useMutation({
    mutationFn: api.setGuestCount,
    onSuccess: () => {
      invalidate()
      toast.success('Guest count updated')
    },
    onError,
  })
}
