export const FIELD_EVENTS = new Set(['guide_to_map', 'map_retry', 'map_empty_recovery', 'id_helper_focus', 'place_saved', 'observation_list_open', 'revisit_planned', 'revisit_calendar_export', 'field_desk_open', 'visit_completed', 'visit_notebook_started', 'account_created', 'account_signed_in', 'email_verified', 'find_recorded', 'place_save_failed'])
export const CONSENT_KEY = 'wmf:analytics-consent:v1'
export function getAnalyticsConsent() {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(CONSENT_KEY) } catch { return null }
}
export function safeAnalyticsPath(value) {
  const path = String(value || '/').split(/[?#]/, 1)[0]
  return path.startsWith('/') && !path.startsWith('//') ? path : '/'
}
// Preserve only anonymous SDK identity and fixed product dimensions, never default URL/referrer/form properties.
export function sanitizeProductEvent(event) {
  if (!event || !FIELD_EVENTS.has(event.event)) return null
  const source = event.properties || {}
  const properties = { app: 'utah-forage-map', page_path: safeAnalyticsPath(source.page_path), $geoip_disable: true }
  for (const key of ['token', 'distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version']) {
    if (typeof source[key] === 'string') properties[key] = source[key]
  }
  if (['fungi', 'herbs'].includes(source.collection)) properties.collection = source.collection
  return { ...event, properties }
}
