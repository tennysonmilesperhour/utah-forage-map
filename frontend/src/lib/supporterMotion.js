import { useSyncExternalStore } from 'react'

const KEY = 'forage-mushroom-motion-paused'
let pausedInMemory = false
function subscribe(callback) {
  window.addEventListener('storage', callback)
  window.addEventListener('supporter-motion', callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener('supporter-motion', callback) }
}
function snapshot() {
  try { const saved = localStorage.getItem(KEY); return saved === null ? pausedInMemory : saved === 'true' } catch { return pausedInMemory }
}
export function useSupporterMotion() {
  const paused = useSyncExternalStore(subscribe, snapshot, () => false)
  function toggle() {
    pausedInMemory = !paused
    try { localStorage.setItem(KEY, String(pausedInMemory)) } catch { /* The in-memory preference still works without storage. */ }
    window.dispatchEvent(new Event('supporter-motion'))
  }
  return { paused, toggle }
}
