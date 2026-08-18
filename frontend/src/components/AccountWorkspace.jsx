import { useState } from 'react'
import {
  Bell, Bookmark, CalendarClock, Check, Clock3, Download, KeyRound, MapPinned,
  NotebookPen, Save, Settings, ShieldCheck, Trash2, X, XCircle,
} from 'lucide-react'
import { getApiError, useResendVerification } from '../hooks/useAuth'
import { useUnitSystem } from '../hooks/useUnits'
import { approximateOffsetLabel, displayToMetres, elevationUnit, metresToDisplay } from '../lib/units'
import {
  useDeleteAccount, useDeleteLogbook, useDeleteSavedLocation, useLogbook,
  useModerationQueue, useReviewSighting, useRevokeOtherSessions,
  useRevokeSession, useSavedLocations, useSessions, useUpdateLogbook,
  useUpdateSavedLocation,
} from '../hooks/useAccount'
import { useAlerts, useDeleteAlert, useUpdateAlert } from '../hooks/useCompanion'

const BASE_TABS = [
  ['logbook', <NotebookPen size={17} aria-hidden="true" />, 'Notebook'],
  ['saved', <Bookmark size={17} aria-hidden="true" />, 'Saved'],
  ['alerts', <Bell size={17} aria-hidden="true" />, 'Alerts'],
  ['sessions', <KeyRound size={17} aria-hidden="true" />, 'Sessions'],
  ['settings', <Settings size={17} aria-hidden="true" />, 'Settings'],
]

const FIELD_MARKS = [
  ['cap_checked', 'Cap'], ['underside_checked', 'Underside'], ['stem_checked', 'Stem'],
  ['base_checked', 'Base'], ['interior_checked', 'Interior'],
  ['substrate_checked', 'Substrate'], ['lookalikes_checked', 'Lookalikes'],
]

function dateLabel(value) {
  if (!value) return 'Date not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
}

function csvValue(value) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function exportNotebook(items) {
  const columns = ['species', 'latin_name', 'found_on', 'latitude', 'longitude', 'elevation_ft', 'place_name', 'habitat_type', 'substrate', 'weather_notes', 'location_privacy', 'review_status', 'notes']
  const lines = [columns.map(csvValue).join(',')]
  items.forEach(item => lines.push([
    item.species.common_name, item.species.latin_name, item.found_on, item.latitude,
    item.longitude, item.elevation_ft, item.place_name, item.habitat_type, item.substrate,
    item.weather_notes, item.location_privacy, item.review_status, item.notes,
  ].map(csvValue).join(',')))
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `fungi-field-notebook-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function LogbookRow({ item, species, onUpdate, onDelete, busy }) {
  const [editing, setEditing] = useState(false)
  const { system: unitSystem } = useUnitSystem()
  const [form, setForm] = useState({
    species_id: item.species_id, found_on: item.found_on ?? '',
    habitat_type: item.habitat_type ?? '', substrate: item.substrate ?? '',
    weather_notes: item.weather_notes ?? '', place_name: item.place_name ?? '',
    elevation_m: item.elevation_ft == null ? '' : item.elevation_ft / 3.28084,
    latitude: item.latitude, longitude: item.longitude,
    location_privacy: item.location_privacy, notes: item.notes ?? '',
  })

  async function save(event) {
    event.preventDefault()
    const { elevation_m, ...fields } = form
    await onUpdate({
      id: item.id, ...fields, found_on: form.found_on || null,
      habitat_type: form.habitat_type || null, substrate: form.substrate || null,
      weather_notes: form.weather_notes || null, place_name: form.place_name.trim() || null,
      elevation_ft: elevation_m === '' ? null : Number(elevation_m) * 3.28084,
      latitude: Number(form.latitude), longitude: Number(form.longitude), notes: form.notes || null,
    })
    setEditing(false)
  }

  return (
    <article className="account-row logbook-row">
      <div className="account-row-heading">
        <div><span className={`review-chip ${item.review_status}`}>{item.review_status}</span><h3>{item.species.common_name}</h3><p>{dateLabel(item.found_on)} · {item.location_privacy} location</p></div>
        <div className="row-actions">
          <button className="button button-secondary compact-button" type="button" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</button>
          <button className="icon-button danger-icon" type="button" onClick={() => onDelete(item.id)} aria-label="Delete observation" title="Delete observation"><Trash2 size={17} /></button>
        </div>
      </div>
      {item.review_notes && <p className="review-note">Reviewer note: {item.review_notes}</p>}
      {editing && (
        <form className="logbook-edit" onSubmit={save}>
          <label>Species<select value={form.species_id} onChange={event => setForm({ ...form, species_id: event.target.value })}>{species.map(value => <option key={value.id} value={value.id}>{value.common_name}</option>)}</select></label>
          <div className="paired-fields"><label>Date found<input type="date" value={form.found_on} onChange={event => setForm({ ...form, found_on: event.target.value })} /></label><label>Elevation ({elevationUnit(unitSystem)})<input type="number" value={form.elevation_m === '' ? '' : Math.round(metresToDisplay(form.elevation_m, unitSystem))} onChange={event => setForm({ ...form, elevation_m: event.target.value === '' ? '' : displayToMetres(event.target.value, unitSystem) })} /></label></div>
          <div className="paired-fields"><label>Latitude<input type="number" step="any" value={form.latitude} onChange={event => setForm({ ...form, latitude: event.target.value })} /></label><label>Longitude<input type="number" step="any" value={form.longitude} onChange={event => setForm({ ...form, longitude: event.target.value })} /></label></div>
          <label>Public location<select value={form.location_privacy} onChange={event => setForm({ ...form, location_privacy: event.target.value })}><option value="approximate">Approximate within {approximateOffsetLabel(unitSystem)}</option><option value="private">Private, notebook only</option><option value="exact">Exact point</option></select></label>
          <div className="paired-fields"><label>Habitat<input value={form.habitat_type} onChange={event => setForm({ ...form, habitat_type: event.target.value })} /></label><label>Substrate<input value={form.substrate} onChange={event => setForm({ ...form, substrate: event.target.value })} /></label></div>
          <label>Recent weather<input maxLength={240} value={form.weather_notes} onChange={event => setForm({ ...form, weather_notes: event.target.value })} /></label>
          <label>Nearest place<input maxLength={160} value={form.place_name} onChange={event => setForm({ ...form, place_name: event.target.value })} /></label>
          <label>Notes<textarea rows="3" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
          <button className="button button-primary" disabled={busy}><Save size={16} /> Save and resubmit</button>
        </form>
      )}
    </article>
  )
}

function SavedRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: item.title, notes: item.notes ?? '', revisit_on: item.revisit_on ?? '' })

  async function save(event) {
    event.preventDefault()
    await onUpdate({ id: item.id, title: form.title, notes: form.notes || null, revisit_on: form.revisit_on || null })
    setEditing(false)
  }

  return (
    <article className="account-row saved-row">
      <MapPinned size={19} aria-hidden="true" />
      <div className="saved-row-copy"><h3>{item.title}</h3><p>{item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}</p>{item.revisit_on && <p className="revisit-label"><CalendarClock size={14} /> Revisit {dateLabel(item.revisit_on)}</p>}{item.notes && <p>{item.notes}</p>}
        {editing && <form className="saved-edit" onSubmit={save}><label>Title<input value={form.title} maxLength={120} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>Revisit date<input type="date" value={form.revisit_on} onChange={event => setForm({ ...form, revisit_on: event.target.value })} /></label><label>Notes<textarea rows="2" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label><button className="button button-primary compact-button"><Save size={15} /> Save</button></form>}
      </div>
      <div className="row-actions"><button className="button button-secondary compact-button" type="button" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Plan revisit'}</button><button className="icon-button" type="button" onClick={() => onDelete(item.id)} aria-label="Remove saved place"><Trash2 size={17} /></button></div>
    </article>
  )
}

function ModerationRow({ item, onReview, busy }) {
  const [checks, setChecks] = useState(Object.fromEntries(FIELD_MARKS.map(([key]) => [key, false])))
  const checkedCount = Object.values(checks).filter(Boolean).length
  const [notes, setNotes] = useState('')
  const payload = { ...checks, confidence: checkedCount >= 5 ? 'confident' : 'likely', notes: notes || null }

  return (
    <article className="account-row moderation-row">
      <div><span className="review-chip pending">pending</span><h3>{item.species.common_name}</h3><p>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)} · {item.location_privacy}</p>{item.notes && <p className="review-note">{item.notes}</p>}</div>
      <div className="moderation-evidence"><div className="verification-fields">{FIELD_MARKS.map(([key, label]) => <label key={key}><input type="checkbox" checked={checks[key]} onChange={event => setChecks({ ...checks, [key]: event.target.checked })} /> {label}</label>)}</div><label>Reviewer note<textarea rows="2" value={notes} onChange={event => setNotes(event.target.value)} /></label></div>
      <div className="moderation-actions"><button className="button approve-button" type="button" disabled={checkedCount < 3 || busy} onClick={() => onReview({ id: item.id, status: 'approved', conclusion: 'supports', ...payload })}><Check size={16} /> Approve ID</button><button className="button reject-button" type="button" disabled={busy} onClick={() => onReview({ id: item.id, status: 'rejected', conclusion: 'disagrees', ...payload })}><XCircle size={16} /> Return record</button></div>
    </article>
  )
}

export default function AccountWorkspace({ user, species, initialTab = 'logbook', onClose, onDeleted, onToast }) {
  const [tab, setTab] = useState(initialTab)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const logbook = useLogbook(tab === 'logbook')
  const saved = useSavedLocations(tab === 'saved')
  const alerts = useAlerts(tab === 'alerts')
  const sessions = useSessions(tab === 'sessions')
  const moderation = useModerationQueue(tab === 'moderation' && ['admin', 'moderator'].includes(user.role))
  const updateLogbook = useUpdateLogbook()
  const deleteLogbook = useDeleteLogbook()
  const updateSaved = useUpdateSavedLocation()
  const deleteSaved = useDeleteSavedLocation()
  const updateAlert = useUpdateAlert()
  const deleteAlert = useDeleteAlert()
  const revokeSession = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const deleteAccount = useDeleteAccount()
  const review = useReviewSighting()
  const resend = useResendVerification()
  const tabs = ['admin', 'moderator'].includes(user.role)
    ? [...BASE_TABS.slice(0, 3), ['moderation', <ShieldCheck size={17} aria-hidden="true" />, 'Review'], ...BASE_TABS.slice(3)]
    : BASE_TABS

  async function removeObservation(id) {
    if (!window.confirm('Delete this observation from your notebook?')) return
    await deleteLogbook.mutateAsync(id)
    onToast('Observation deleted.')
  }

  async function removeAccount(event) {
    event.preventDefault()
    if (!window.confirm('Permanently delete this account and its private data?')) return
    setError('')
    try { await deleteAccount.mutateAsync(password); onDeleted() }
    catch (requestError) { setError(getApiError(requestError, 'The account could not be deleted.')) }
  }

  return (
    <div className="drawer-layer account-workspace-layer">
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="Close field desk" />
      <aside className="account-workspace" role="dialog" aria-label="Your field desk">
        <div className="drawer-heading account-workspace-heading"><div><p>Private account area</p><h2>Your field desk</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close field desk"><X size={20} /></button></div>
        <div className="account-tabs" role="tablist" aria-label="Field desk views">{tabs.map(([value, icon, label]) => <button key={value} className={tab === value ? 'active' : ''} type="button" role="tab" aria-selected={tab === value} title={label} onClick={() => setTab(value)}>{icon} {label}</button>)}</div>
        <div className="account-content">
          {tab === 'logbook' && <section><div className="section-heading"><div><h3>Field notebook</h3><p>Full coordinates remain private unless you publish them.</p></div><div className="heading-actions"><strong>{logbook.data?.length ?? 0}</strong><button className="button button-secondary compact-button" type="button" disabled={!logbook.data?.length} onClick={() => exportNotebook(logbook.data)}><Download size={15} /> Export CSV</button></div></div>{logbook.isLoading && <p className="empty-state">Loading notebook...</p>}{logbook.data?.map(item => <LogbookRow key={item.id} item={item} species={species} onUpdate={updateLogbook.mutateAsync} onDelete={removeObservation} busy={updateLogbook.isPending} />)}{!logbook.isLoading && !logbook.data?.length && <p className="empty-state">Your submitted finds will appear here.</p>}</section>}

          {tab === 'saved' && <section><div className="section-heading"><div><h3>Saved places</h3><p>Plan a return after the weather changes.</p></div><strong>{saved.data?.length ?? 0}</strong></div>{saved.data?.map(item => <SavedRow key={item.id} item={item} onUpdate={updateSaved.mutateAsync} onDelete={deleteSaved.mutate} />)}{!saved.isLoading && !saved.data?.length && <p className="empty-state">Bookmark a public observation to keep it close.</p>}</section>}

          {tab === 'alerts' && <section><div className="section-heading"><div><h3>Field watchlist</h3><p>Recent activity for the species and regions you follow.</p></div><strong>{alerts.data?.filter(item => item.enabled).length ?? 0}</strong></div>{alerts.data?.map(item => <article className="account-row alert-row" key={item.id}><Bell size={18} /><div><h3>{item.species_name || item.region_name}</h3><p>{item.recent_observations_7d} public {item.recent_observations_7d === 1 ? 'record' : 'records'} in the past 7 days{item.latest_observed_on ? ` · latest ${dateLabel(item.latest_observed_on)}` : ''}</p></div><label className="switch-control"><input type="checkbox" checked={item.enabled} onChange={event => updateAlert.mutate({ id: item.id, enabled: event.target.checked })} /><span aria-hidden="true" /></label><button className="icon-button" type="button" onClick={() => deleteAlert.mutate(item.id)} aria-label={`Remove ${item.species_name || item.region_name} alert`}><Trash2 size={17} /></button></article>)}{!alerts.isLoading && !alerts.data?.length && <p className="empty-state">Follow a species guide or regional field page to start your watchlist.</p>}</section>}

          {tab === 'moderation' && <section><div className="section-heading"><div><h3>Review queue</h3><p>Record which field marks the evidence actually shows.</p></div><strong>{moderation.data?.length ?? 0}</strong></div>{moderation.data?.map(item => <ModerationRow key={item.id} item={item} onReview={review.mutate} busy={review.isPending} />)}{!moderation.isLoading && !moderation.data?.length && <p className="empty-state">The review queue is clear.</p>}</section>}

          {tab === 'sessions' && <section><div className="section-heading"><div><h3>Active sessions</h3><p>Revoke access from devices you no longer use.</p></div><button className="button button-secondary compact-button" type="button" onClick={() => revokeOthers.mutate()}>Sign out others</button></div>{sessions.data?.map(item => <article className="account-row session-row" key={item.id}><Clock3 size={19} /><div><h3>{item.current ? 'This device' : 'Signed-in device'}</h3><p>{item.user_agent || 'Unknown browser'} · active {new Date(item.last_seen_at).toLocaleDateString()}</p></div>{!item.current && <button className="button button-secondary compact-button" type="button" onClick={() => revokeSession.mutate(item.id)}>Revoke</button>}</article>)}</section>}

          {tab === 'settings' && <section className="settings-section"><div className="settings-block"><h3>Email verification</h3><p>{user.email_verified ? 'Your account email is verified.' : `Verification is pending for ${user.email}.`}</p>{!user.email_verified && <button className="button button-secondary" type="button" onClick={async () => { await resend.mutateAsync(); onToast('Verification email requested.') }}>Resend verification</button>}</div><form className="settings-block danger-zone" onSubmit={removeAccount}><h3>Delete account</h3><p>Private saves, alerts, and unpublished observations are removed. Approved public contributions are anonymized.</p><label>Confirm password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button danger-button" disabled={deleteAccount.isPending}><Trash2 size={16} /> Delete account</button></form></section>}
        </div>
      </aside>
    </div>
  )
}
