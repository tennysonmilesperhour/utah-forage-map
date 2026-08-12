import { Map, UserPlus, X } from 'lucide-react'

export default function GuestPrompt({ onDismiss, onCreateAccount }) {
  return (
    <section className="guest-prompt" aria-label="Guest access">
      <div className="guest-prompt-icon"><Map size={20} aria-hidden="true" /></div>
      <div className="guest-prompt-copy">
        <strong>The public map is open</strong>
        <p>Browse every public location and field note without an account.</p>
        <button type="button" onClick={onCreateAccount}>
          <UserPlus size={16} aria-hidden="true" /> Create an account to save and contribute
        </button>
      </div>
      <button className="icon-button guest-dismiss" type="button" onClick={onDismiss} aria-label="Dismiss guest message">
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  )
}
