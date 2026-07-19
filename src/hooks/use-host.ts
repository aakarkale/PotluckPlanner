import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { verifyHost } from '@/lib/api'
import { clearHostSecret, getHostSecret, setHostSecret } from '@/lib/identity'

// Host mode: visiting ?host=<secret> once per device grants full edit/delete
// on every dish. The secret is verified in the database and persisted in
// localStorage; a pill in the header lets the host exit.
export function useHost() {
  const [isHost, setIsHost] = useState(() => getHostSecret() !== null)
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    const url = new URL(window.location.href)
    const candidate = url.searchParams.get('host')
    if (candidate !== null) {
      url.searchParams.delete('host')
      window.history.replaceState(null, '', url)
    }

    if (candidate) {
      verifyHost(candidate)
        .then((valid) => {
          if (valid) {
            setHostSecret(candidate)
            setIsHost(true)
            toast.success('Host mode on — you can edit every dish')
          } else {
            toast.error("That host link isn't valid.")
          }
        })
        .catch(() => toast.error('Could not verify the host link. Try again.'))
      return
    }

    // Re-check a previously saved secret in case it was rotated. Only an
    // explicit "false" demotes; network errors keep host mode as-is.
    const saved = getHostSecret()
    if (saved) {
      verifyHost(saved)
        .then((valid) => {
          if (!valid) {
            clearHostSecret()
            setIsHost(false)
          }
        })
        .catch(() => {})
    }
  }, [])

  const exitHost = () => {
    clearHostSecret()
    setIsHost(false)
    toast.success('Left host mode')
  }

  return { isHost, exitHost }
}
