import { useQuery } from '@tanstack/react-query'
import { fetchEventImage, imageQueryFor } from '@/lib/event-image'

/**
 * Background artwork for an event header, derived from its name.
 *
 * Keyed on the *derived* query rather than the raw name, so renaming
 * "Friendsgiving" to "Friendsgiving 2026" reuses the cached artwork instead of
 * refetching and flashing. Cached forever within a session, so the event
 * page's 1.5 s poll never re-requests it; `fetchEventImage` additionally
 * caches across reloads in localStorage.
 */
export function useEventImage(name: string | undefined) {
  const query = name ? imageQueryFor(name) : ''
  return useQuery({
    queryKey: ['event-image', query],
    queryFn: ({ signal }) => fetchEventImage(query, signal),
    enabled: Boolean(query),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
}
