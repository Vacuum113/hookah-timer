import { useEffect, useState } from 'react'

/** На узком экране свободная раскладка зала заменяется потоком кружков. */
export function useIsNarrow(maxWidth = 720): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${maxWidth}px)`).matches,
  )
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const onChange = () => setNarrow(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [maxWidth])
  return narrow
}
