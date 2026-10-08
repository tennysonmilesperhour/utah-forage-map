import { FIELD_EVENTS, getAnalyticsConsent, safeAnalyticsPath, sanitizeProductEvent } from './analyticsPolicy'
const token = import.meta.env.VITE_POSTHOG_KEY?.trim()
export const isPostHogEnabled = Boolean(token)
let client = null
let loading = null

export async function initPostHog() {
  if (!token || getAnalyticsConsent() !== 'granted') return null
  if (client) return client
  if (!loading) loading = import('posthog-js').then(({ default: posthog }) => {
    if (getAnalyticsConsent() !== 'granted') return null
    posthog.init(token, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      defaults: '2026-05-30', person_profiles: 'never',
      autocapture: false, capture_pageview: false, capture_pageleave: false,
      capture_dead_clicks: false, capture_heatmaps: false,
      capture_exceptions: true,
      disable_session_recording: true, disable_surveys: true,
      advanced_disable_feature_flags: true,
      before_send: sanitizeProductEvent,
    })
    client = posthog
    return client
  }).catch(() => null).finally(() => { loading = null })
  return loading
}

export async function captureProductEvent(name, collection) {
  if (!FIELD_EVENTS.has(name) || !['fungi', 'herbs'].includes(collection) || getAnalyticsConsent() !== 'granted') return
  const page_path = safeAnalyticsPath(window.location.pathname)
  const sdk = await initPostHog()
  if (getAnalyticsConsent() === 'granted') sdk?.capture(name, { collection, page_path })
}

export async function setPostHogConsent(choice) {
  if (choice === 'granted') {
    const sdk = await initPostHog()
    if (getAnalyticsConsent() === 'granted') sdk?.opt_in_capturing()
  } else if (client) {
    client.opt_out_capturing()
    client.reset()
  }
}
