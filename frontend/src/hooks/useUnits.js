import { useCallback, useEffect, useState } from 'react'
import { readStoredUnitSystem, storeUnitSystem } from '../lib/units'

const listeners = new Set()

// Units are read in several sibling panels at once, so the preference is kept in a tiny
// shared store rather than threaded through props from the app shell.
export function useUnitSystem() {
  const [system, setSystem] = useState(readStoredUnitSystem)

  useEffect(() => {
    const listener = value => setSystem(value)
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, [])

  const update = useCallback(value => {
    storeUnitSystem(value)
    listeners.forEach(listener => listener(value))
  }, [])

  const toggle = useCallback(() => {
    update(readStoredUnitSystem() === 'metric' ? 'imperial' : 'metric')
  }, [update])

  return { system, setSystem: update, toggle }
}
