import { toast } from 'sonner'

export function eventUrl(slug: string): string {
  return `${window.location.origin}/p/${slug}`
}

export async function copyEventLink(slug: string) {
  try {
    await navigator.clipboard.writeText(eventUrl(slug))
    toast.success('Link copied — send it to your guests')
  } catch {
    toast.error('Could not copy the link.')
  }
}

/** YYYY-MM-DD → "Sat, Aug 15, 2026" (parsed as local time, not UTC). */
export function formatEventDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
