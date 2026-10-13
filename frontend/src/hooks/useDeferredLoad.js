import { useEffect } from 'react'

// Debounce filter loads and cancel scheduled work when dependencies change.
// A zero delay also prevents duplicate initial requests during StrictMode's
// setup/cleanup cycle. Event-driven saves continue to call their loader directly.
export function useDeferredLoad(load, delay = 0) {
  useEffect(() => {
    const timer = setTimeout(load, delay)
    return () => clearTimeout(timer)
  }, [load, delay])
}
