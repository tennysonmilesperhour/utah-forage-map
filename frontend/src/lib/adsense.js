// Google AdSense integration. Like the Google tag, this stays inert until the
// publisher client ID is configured, so it ships "ready but off".
//
// Configure in the deployment environment (see .env.example):
//   VITE_ADSENSE_CLIENT  e.g. ca-pub-0000000000000000  (loads the AdSense loader)
//
// Once the loader is present and the site is approved in AdSense, Auto ads are
// turned on from the AdSense dashboard, and manual ad units render through the
// <AdSlot> component with a slot ID from the dashboard.

export const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT?.trim() || ''

export const isAdSenseEnabled = ADSENSE_CLIENT.startsWith('ca-pub-')

let initialized = false

// Loads the AdSense loader script once. Safe to call on every page load; a
// no-op when no client ID is configured or during SSR.
export function initAdSense() {
  if (initialized || !isAdSenseEnabled) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  initialized = true

  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`
  document.head.appendChild(script)
}

// Requests a fill for one manual ad unit. Called by <AdSlot> after its <ins>
// element mounts.
export function pushAdSlot() {
  if (!isAdSenseEnabled || typeof window === 'undefined') return
  try {
    ;(window.adsbygoogle = window.adsbygoogle || []).push({})
  } catch {
    // AdSense throws if the loader has not arrived yet; the unit fills on the
    // next successful push, so a failed attempt is safe to ignore.
  }
}
