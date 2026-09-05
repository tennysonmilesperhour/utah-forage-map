// Google tag integration for GA4 and optional Google Ads conversions.
// GA4 uses basic consent mode: no Google script loads until the visitor opts in.

const ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID?.trim() || ''
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || ''
const SIGNUP_LABEL = import.meta.env.VITE_GOOGLE_ADS_SIGNUP_LABEL?.trim() || ''
const SUBMIT_LABEL = import.meta.env.VITE_GOOGLE_ADS_SUBMIT_LABEL?.trim() || ''
const CONSENT_STORAGE_KEY = 'wmf:analytics-consent:v1'

const validAdsId = /^AW-[A-Z0-9]+$/i.test(ADS_ID)
const validGaId = /^G-[A-Z0-9]+$/i.test(GA_ID)
const CONFIG_IDS = [validAdsId ? ADS_ID : '', validGaId ? GA_ID : ''].filter(Boolean)

export const isGoogleTagEnabled = CONFIG_IDS.length > 0
export const isGoogleAnalyticsEnabled = validGaId

let tagLoaded = false
let consentDefaultsSet = false
let lastPagePath = null

function safePagePath(path = window.location.pathname) {
  const pathname = String(path).split(/[?#]/, 1)[0]
  return pathname.startsWith('/') ? pathname : '/'
}

function safePageLocation(path) {
  return new URL(safePagePath(path), window.location.origin).href
}

export function gtag() {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(arguments)
}

function setConsentDefaults() {
  if (consentDefaultsSet || typeof window === 'undefined') return
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })
  consentDefaultsSet = true
}

function loadGoogleTag() {
  if (tagLoaded || !isGoogleTagEnabled) return false
  if (typeof window === 'undefined' || typeof document === 'undefined') return false

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(CONFIG_IDS[0])}`
  script.dataset.googleTag = CONFIG_IDS[0]
  document.head.appendChild(script)

  gtag('js', new Date())
  for (const id of CONFIG_IDS) {
    gtag('config', id, validGaId && id === GA_ID
      ? { send_page_view: false, page_location: safePageLocation() }
      : {})
  }
  tagLoaded = true
  return true
}

function removeAnalyticsCookies() {
  if (typeof document === 'undefined') return
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0].trim()
    if (!name.startsWith('_ga')) return
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
  })
}

export function getGoogleAnalyticsConsent() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(CONSENT_STORAGE_KEY)
}

export function initGoogleTag() {
  if (!isGoogleTagEnabled || typeof window === 'undefined') return
  setConsentDefaults()

  if (!validGaId || getGoogleAnalyticsConsent() === 'granted') {
    gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: validGaId ? 'granted' : 'denied',
    })
    loadGoogleTag()
  }
}

export function setGoogleAnalyticsConsent(choice) {
  if (!validGaId || typeof window === 'undefined') return
  window.localStorage.setItem(CONSENT_STORAGE_KEY, choice)
  setConsentDefaults()

  if (choice === 'granted') {
    gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    })
    loadGoogleTag()
    trackPageView()
    return
  }

  gtag('consent', 'update', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })
  lastPagePath = null
  removeAnalyticsCookies()
}

export function trackPageView(path) {
  if (!validGaId || typeof window === 'undefined') return
  if (getGoogleAnalyticsConsent() !== 'granted') return

  const pagePath = safePagePath(path)
  setConsentDefaults()
  loadGoogleTag()
  if (!tagLoaded || pagePath === lastPagePath) return

  lastPagePath = pagePath
  gtag('config', GA_ID, {
    send_page_view: false,
    page_location: safePageLocation(pagePath),
  })
  gtag('event', 'page_view', {
    page_location: safePageLocation(pagePath),
    page_path: pagePath,
    page_title: document.title,
  })
}

export function updateGoogleConsent(consent) {
  if (!isGoogleTagEnabled) return
  gtag('consent', 'update', consent)
}

export function trackConversion(label, params = {}) {
  if (!validAdsId || !label || !tagLoaded) return
  gtag('event', 'conversion', { send_to: `${ADS_ID}/${label}`, ...params })
}

export function trackSignupConversion(params = {}) {
  trackConversion(SIGNUP_LABEL, params)
}

export function trackSubmissionConversion(params = {}) {
  trackConversion(SUBMIT_LABEL, params)
}
