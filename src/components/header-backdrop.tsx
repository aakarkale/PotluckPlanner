import { useEffect, useState } from 'react'
import { useEventImage } from '@/hooks/use-event-image'
import { cn } from '@/lib/utils'

/**
 * Ambient artwork behind the event header, picked from the potluck's name.
 *
 * Deliberately blurred and sat under a card-coloured scrim: it should read as
 * a wash of colour that suits the occasion, never as a photo competing with
 * the name, date, and location. Renders nothing until an image resolves, so
 * a blocked or empty lookup leaves the original header untouched.
 */
export function HeaderBackdrop({ name }: { name: string }) {
  const { data: url } = useEventImage(name)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [url])

  if (!url) return null

  return (
    <div
      aria-hidden
      data-testid="header-backdrop"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
    >
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        className={cn(
          // scale-110 hides the soft edges the blur leaves behind.
          'size-full scale-110 object-cover blur-2xl transition-opacity duration-700',
          loaded ? 'opacity-55 dark:opacity-40' : 'opacity-0',
        )}
      />
      {/* Opaque where the name, date, and location sit; thins out to the
          right so the colour still reads as a wash across the card. */}
      <div className="from-card via-card/85 to-card/25 absolute inset-0 bg-gradient-to-r" />
    </div>
  )
}
