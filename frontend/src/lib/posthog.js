import posthog from 'posthog-js'
import { getGoogleAnalyticsConsent } from './googleTag'

const token = import.meta.env.VITE_POSTHOG_KEY?.trim()
let initialized = false

export function initPostHog() {
  if (!token || initialized || getGoogleAnalyticsConsent() !== 'granted') return
  initialized = true
  posthog.init(token, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    disable_session_recording: true,
    before_send: (event) => {
      if (!event) return null
      event.properties = { ...event.properties, app: 'utah-forage-map' }
      return event
    },
  })
}

export function setPostHogConsent(choice) {
  if (choice === 'granted') {
    initPostHog()
    posthog.opt_in_capturing()
  } else if (initialized) {
    posthog.opt_out_capturing()
    posthog.reset()
  }
}
