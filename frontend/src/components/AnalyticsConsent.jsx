import { BarChart3, ShieldCheck } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import {
  getGoogleAnalyticsConsent,
  isGoogleAnalyticsEnabled,
  setGoogleAnalyticsConsent,
} from '../lib/googleTag'
import { isPostHogEnabled, setPostHogConsent } from '../lib/posthog'

const subscribeToHydration = () => () => {}

export default function AnalyticsConsent({ collection = 'fungi' }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false)
  const [sessionChoice, setSessionChoice] = useState(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!hydrated || (!isGoogleAnalyticsEnabled && !isPostHogEnabled)) return null

  const consent = sessionChoice ?? getGoogleAnalyticsConsent()
  const open = settingsOpen || consent === null
  const theme = collection === 'herbs' ? 'herbal-consent' : 'mycelial-theme'

  function choose(choice) {
    setGoogleAnalyticsConsent(choice)
    setPostHogConsent(choice)
    setSessionChoice(choice)
    setSettingsOpen(false)
  }

  if (!open) {
    return (
      <button
        className={`analytics-settings ${theme}`}
        type="button"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open analytics privacy choices"
        title="Analytics privacy choices"
      >
        <ShieldCheck size={17} aria-hidden="true" />
        <span>Privacy</span>
      </button>
    )
  }

  return (
    <section
      className={`analytics-consent ${theme}`}
      role="dialog"
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-copy"
    >
      <div className="analytics-consent-copy">
        <strong id="analytics-consent-title"><BarChart3 size={14} aria-hidden="true" /> Optional analytics</strong>
        <p id="analytics-consent-copy">Optional analytics measures use of guides, saves, and visit planning. Notes, coordinates, and account emails are not included in planning events. <a href="/privacy">Details</a></p>
      </div>
      <div className="analytics-consent-actions">
        <button className="button button-secondary" type="button" onClick={() => choose('denied')}>Not now</button>
        <button className="button button-primary" type="button" onClick={() => choose('granted')}>Allow analytics</button>
      </div>
    </section>
  )
}
