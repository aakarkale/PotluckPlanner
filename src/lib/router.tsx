// Minimal history-API router — the app has five routes, so ~70 lines replace
// react-router (which would add ~20 kB gzip). Same philosophy as rpc.ts.
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

export type Route =
  | { page: 'landing' }
  | { page: 'signin' }
  | { page: 'signup' }
  | { page: 'dashboard' }
  | { page: 'event'; slug: string }
  | { page: 'not-found' }

export function parseRoute(pathname: string): Route {
  if (pathname === '/') return { page: 'landing' }
  if (pathname === '/signin') return { page: 'signin' }
  if (pathname === '/signup') return { page: 'signup' }
  if (pathname === '/dashboard') return { page: 'dashboard' }
  const event = pathname.match(/^\/p\/([a-z0-9]{1,64})\/?$/)
  if (event) return { page: 'event', slug: event[1] }
  return { page: 'not-found' }
}

const NAVIGATE_EVENT = 'potluck:navigate'

export function navigate(to: string, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAVIGATE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAVIGATE_EVENT, onChange)
  }
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => '/',
  )
  return parseRoute(pathname)
}

/** Anchor that soft-navigates; modified clicks (new tab etc.) work natively. */
export function Link({
  to,
  className,
  children,
  ...props
}: React.ComponentProps<'a'> & { to: string }) {
  return (
    <a
      href={to}
      className={cn(className)}
      onClick={(event) => {
        if (event.defaultPrevented) return
        if (event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(to)
      }}
      {...props}
    >
      {children}
    </a>
  )
}
