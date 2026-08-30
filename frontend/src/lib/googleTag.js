// Google tag (gtag.js) integration for Google Ads conversion tracking, with
// optional Google Analytics 4. Everything here is inert until the matching
// VITE_* environment variables are provided, so the integration ships "ready
// but off" and is switched on by configuration alone -- no code change needed.
//
// Configure in the deployment environment (see .env.example):
//   VITE_GOOGLE_ADS_ID           e.g. AW-XXXXXXXXXX   (loads the tag)
//   VITE_GOOGLE_ADS_SIGNUP_LABEL e.g. abcDEF_gh12     (account signup conversion)
//   VITE_GOOGLE_ADS_SUBMIT_LABEL e.g. ijkLMN_op34     (sighting submission conversion)
//   VITE_GA_MEASUREMENT_ID       e.g. G-XXXXXXXXXX    (optional GA4, loaded alongside)
//   VITE_GOOGLE_CONSENT_DEFAULT  granted | denied     (optional Consent Mode v2 baseline)

const ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID?.trim() || ''
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || ''
const SIGNUP_LABEL = import.meta.env.VITE_GOOGLE_ADS_SIGNUP_LABEL?.trim() || ''
const SUBMIT_LABEL = import.meta.env.VITE_GOOGLE_ADS_SUBMIT_LABEL?.trim() || ''
const CONSENT_DEFAULT = (import.meta.env.VITE_GOOGLE_CONSENT_DEFAULT ?? 'granted').trim().toLowerCase()

const CONFIG_IDS = [ADS_ID, GA_ID].filter(Boolean)

export const isGoogleTagEnabled = CONFIG_IDS.length > 0

// Canonical gtag shim: push the live `arguments` object onto the dataLayer so
// Google's library reads each command tuple exactly as its own snippet emits it.
export function gtag() {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(arguments)
}

let initialized = false

// Loads gtag.js once and configures every provided tag ID. Safe to call on
// every page load; a no-op when no tag ID is configured or during SSR.
export function initGoogleTag() {
  if (initialized || !isGoogleTagEnabled) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  initialized = true

  // Consent Mode v2 defaults must be set before the config commands. When the
  // baseline is "denied" the tag waits for updateGoogleConsent() (e.g. from a
  // future consent banner) before using ad/analytics storage.
  if (CONSENT_DEFAULT === 'denied') {
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(CONFIG_IDS[0])}`
  document.head.appendChild(script)

  gtag('js', new Date())
  for (const id of CONFIG_IDS) gtag('config', id)
}

// Update consent after the visitor makes a choice. Pass the fields that
// changed, e.g. updateGoogleConsent({ ad_storage: 'granted' }).
export function updateGoogleConsent(consent) {
  if (!isGoogleTagEnabled) return
  gtag('consent', 'update', consent)
}

// Report a Google Ads conversion. `label` is the conversion action label from
// the Google Ads UI; without a configured Ads ID and label this is a no-op.
export function trackConversion(label, params = {}) {
  if (!ADS_ID || !label) return
  gtag('event', 'conversion', { send_to: `${ADS_ID}/${label}`, ...params })
}

// Named conversions wired to real product actions. Each stays inert until its
// conversion label is configured, so activation is per-conversion.
export function trackSignupConversion(params = {}) {
  trackConversion(SIGNUP_LABEL, params)
}

export function trackSubmissionConversion(params = {}) {
  trackConversion(SUBMIT_LABEL, params)
}
