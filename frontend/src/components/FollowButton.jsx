import { Bell, BellRing } from 'lucide-react'
import { useAlerts, useCreateAlert } from '../hooks/useCompanion'

export default function FollowButton({ user, kind, taxonId, regionSlug, label, onToast }) {
  const targetKey = kind === 'species' ? `species:${taxonId}` : `region:${regionSlug}`
  const alerts = useAlerts(Boolean(user))
  const createAlert = useCreateAlert()
  const following = alerts.data?.some(item => item.target_key === targetKey && item.enabled)
  const handoff = encodeURIComponent(targetKey)

  if (!user) {
    return (
      <a className="button button-secondary follow-button" href={`/?follow=${handoff}`}>
        <Bell size={16} aria-hidden="true" /> Follow {label}
      </a>
    )
  }

  if (!user.email_verified) {
    return (
      <a className="button button-secondary follow-button" href={`/?follow=${handoff}`}>
        <Bell size={16} aria-hidden="true" /> Verify email to follow
      </a>
    )
  }

  async function follow() {
    if (following || createAlert.isPending) return
    try {
      await createAlert.mutateAsync(kind === 'species'
        ? { kind, species_taxon_id: taxonId }
        : { kind, region_slug: regionSlug })
      onToast?.(`Following ${label}. Weekly field bulletins are on.`)
    } catch {
      onToast?.('That field bulletin could not be created.')
    }
  }

  return (
    <button className={`button follow-button ${following ? 'is-following' : 'button-secondary'}`} type="button" onClick={follow} disabled={following || createAlert.isPending}>
      {following ? <BellRing size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
      {following ? `Following ${label}` : createAlert.isError ? 'Try following again' : `Follow ${label}`}
    </button>
  )
}
