import { useEffect } from 'react'

export function useTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = title
    return () => {
      document.title = 'Potluck — plan the table together'
    }
  }, [title])
}
