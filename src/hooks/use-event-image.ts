import { useQuery } from '@tanstack/react-query'
import { fetchEventImage } from '@/lib/event-image'

/**
 * Background artwork for an event header, derived from its name.
 *
 * Cached forever within a session and keyed by name, so the event page's 1.5 s
 * poll never re-requests it; `fetchEventImage` additionally caches across
 * reloads in localStorage.
 */
export function useEventImage(name: string | undefined) {
  return useQuery({
    queryKey: ['event-image', name],
    queryFn: ({ signal }) => fetchEventImage(name ?? '', signal),
    enabled: Boolean(name),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
}
