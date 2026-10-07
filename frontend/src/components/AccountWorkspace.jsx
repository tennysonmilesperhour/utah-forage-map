import { useEffect, useRef, useState } from 'react'
import {
  Bell, Bookmark, CalendarClock, LayoutDashboard, Check, Clock3, CloudSun, Download, KeyRound,
  LocateFixed, MapPin, MapPinned, MoonStar, NotebookPen, Save, Settings,
  ShieldCheck, Trash2, X, XCircle,
} from 'lucide-react'
import { getApiError, useChangeUnverifiedEmail, useResendVerification } from '../hooks/useAuth'
import { useUnitSystem } from '../hooks/useUnits'
import { approximateOffsetLabel, displayToMetres, elevationUnit, metresToDisplay } from '../lib/units'
import {
  useDeleteAccount, useDeleteLogbook, useDeleteSavedLocation, useLogbook,
  useModerationQueue, useReviewSighting, useRevokeOtherSessions,
  useRevokeSession, useSavedLocations, useSessions, useUpdateLogbook,
  useUpdateSavedLocation,
} from '../hooks/useAccount'
import { useAlerts, useCreateAlert, useDeleteAlert, useUpdateAlert } from '../hooks/useCompanion'
import FieldDeskOverview from './FieldDeskOverview'
import { downloadRevisit, plannedPlaces, revisitStatus } from '../lib/fieldPlanning'
import { trackFieldEvent } from '../lib/googleTag'
import { deviceLabel } from '../lib/deviceLabel'

const BASE_TABS = [
  ['overview', <LayoutDashboard size={17} aria-hidden="true" />, 'Overview'],
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
  const [error, setError] = useState('')
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
    setError('')
    try { await onUpdate({
      id: item.id, ...fields, found_on: form.found_on || null,
      habitat_type: form.habitat_type || null, substrate: form.substrate || null,
      weather_notes: form.weather_notes || null, place_name: form.place_name.trim() || null,
      elevation_ft: elevation_m === '' ? null : Number(elevation_m) * 3.28084,
      latitude: Number(form.latitude), longitude: Number(form.longitude), notes: form.notes || null,
    })
    setEditing(false)
    } catch (requestError) { setError(getApiError(requestError, 'Changes could not be saved.')) }
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
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary" disabled={busy}><Save size={16} /> Save and resubmit</button>
        </form>
      )}
    </article>
  )
}

function SavedRow({ item, onUpdate, onDelete, onOpenPlace, busy }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: item.title, notes: item.notes ?? '', revisit_on: item.revisit_on ?? '' })

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      await onUpdate({ id: item.id, title: form.title.trim(), notes: form.notes || null, revisit_on: new FormData(event.currentTarget).get('revisit_on') || null })
      if (form.revisit_on) trackFieldEvent('revisit_planned', 'fungi')
      setEditing(false)
    } catch (requestError) { setError(getApiError(requestError, 'Your plan could not be saved. Please try again.')) }
  }

  return (
    <article className="account-row saved-row">
      <MapPinned size={19} aria-hidden="true" />
      <div className="saved-row-copy"><h3>{item.title}</h3><p className="revisit-label"><CalendarClock size={14} /> {revisitStatus(item.revisit_on)}</p><p>{item.sighting_id ? 'Saved public observation · point may be approximate' : 'Your saved place'}</p>{item.notes && <p>{item.notes}</p>}
        <div className="saved-plan-actions"><button className="button button-secondary compact-button" onClick={() => onOpenPlace(item)}><MapPin size={15} /> Open on map</button>{item.revisit_on && <><button className="button button-secondary compact-button" onClick={() => { downloadRevisit(item); trackFieldEvent('revisit_calendar_export', 'fungi') }}><CalendarClock size={15} /> Add to calendar</button><button className="button button-secondary compact-button" disabled={busy} onClick={async () => { try { await onUpdate({ id: item.id, revisit_on: null }) } catch (requestError) { setError(getApiError(requestError, 'Could not clear the visit date.')) } }}><Check size={15} /> Clear visit date</button></>}</div>
        {item.revisit_on && <p className="field-small">Calendar download includes the title and date, without your notes or coordinates.</p>}
        {editing && <form className="saved-edit" onSubmit={save}><label>Title<input required value={form.title} maxLength={120} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>Revisit date<input type="date" name="revisit_on" value={form.revisit_on} onInput={event => setForm({ ...form, revisit_on: event.currentTarget.value })} onChange={event => setForm({ ...form, revisit_on: event.target.value })} /></label><label>Private notes<textarea maxLength={1000} placeholder="Access to check, habitat to study, what to bring…" rows="3" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label><button className="button button-primary compact-button" disabled={busy || !form.title.trim()}><Save size={15} /> {busy ? 'Saving…' : 'Save plan'}</button></form>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="row-actions"><button className="button button-secondary compact-button" type="button" onClick={() => { setForm({ title: item.title, notes: item.notes ?? '', revisit_on: item.revisit_on ?? '' }); setEditing(!editing) }}>{editing ? 'Cancel' : 'Plan revisit'}</button><button className="icon-button" type="button" disabled={busy} onClick={() => onDelete(item.id)} aria-label={`Remove ${item.title} from saved places`}><Trash2 size={17} /></button></div>
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

const FUNGI_INTENTIONS = [
  'Kitchen and table', 'Study and identification', 'Photography',
  'Connection to place', 'Seasonal ritual',
]

const MOON_PHASES = [
  ['', 'No sky timing'], ['new moon', 'New moon'], ['waxing crescent', 'Waxing crescent'],
  ['first quarter', 'First quarter'], ['waxing gibbous', 'Waxing gibbous'],
  ['full moon', 'Full moon'], ['waning gibbous', 'Waning gibbous'],
  ['last quarter', 'Last quarter'], ['waning crescent', 'Waning crescent'],
]

function FungiWatchForm({ species, onCreate, busy }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', species_taxon_id: species[0]?.inaturalist_taxon_id ?? '',
    intention: FUNGI_INTENTIONS[0], why: '', latitude: '', longitude: '',
    radius_km: 25, watch_weather: true, moon_phase: '',
  })

  function locate() {
    setError('')
    if (!navigator.geolocation) { setError('Location is unavailable. Enter coordinates to choose your area.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(position => {
      setForm(current => ({
        ...current,
        latitude: position.coords.latitude.toFixed(5),
        longitude: position.coords.longitude.toFixed(5),
      }))
      setLocating(false)
    }, () => { setLocating(false); setError('Location could not be read. Enter coordinates or enable location access in your browser.') }, { enableHighAccuracy: false, timeout: 10000 })
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    try { await onCreate({
      kind: 'zone', name: form.name, species_taxon_id: Number(form.species_taxon_id || species[0]?.inaturalist_taxon_id),
      intention: form.intention, why: form.why || null,
      latitude: Number(form.latitude), longitude: Number(form.longitude),
      radius_km: Number(form.radius_km), watch_weather: form.watch_weather,
      moon_phase: form.moon_phase || null,
    })
    setForm(current => ({ ...current, name: '', why: '' }))
    } catch (requestError) { setError(getApiError(requestError, 'The watch zone could not be saved. Please try again.')) }
  }

  return (
    <form className="fungi-watch-form" onSubmit={submit}>
      <div className="fungi-watch-heading"><div><p>New place watch</p><h3>Watch a patch, not just a species</h3></div><span>Reviewed activity is always required</span></div>
      <div className="fungi-watch-grid">
        <label>Zone name<input required maxLength="120" placeholder="North-facing canyon" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label>Species<select required value={form.species_taxon_id || species[0]?.inaturalist_taxon_id || ''} onChange={event => setForm({ ...form, species_taxon_id: event.target.value })}>{species.map(item => <option key={item.id} value={item.inaturalist_taxon_id}>{item.common_name}</option>)}</select></label>
        <label>Intention<select value={form.intention} onChange={event => setForm({ ...form, intention: event.target.value })}>{FUNGI_INTENTIONS.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Optional lunar tradition<select value={form.moon_phase} onChange={event => setForm({ ...form, moon_phase: event.target.value })}>{MOON_PHASES.map(([value, label]) => <option value={value} key={label}>{label}</option>)}</select></label>
      </div>
      <label>Why this matters to you<textarea maxLength="500" rows="2" placeholder="A note to your future self" value={form.why} onChange={event => setForm({ ...form, why: event.target.value })} /></label>
      <div className="fungi-watch-location"><button className="button button-secondary compact-button" type="button" onClick={locate} disabled={locating}><LocateFixed size={15} /> {locating ? 'Locating...' : 'Use my location'}</button><label>Latitude<input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={event => setForm({ ...form, latitude: event.target.value })} /></label><label>Longitude<input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={event => setForm({ ...form, longitude: event.target.value })} /></label><label>Radius <span>{form.radius_km} km</span><input type="range" min="1" max="250" value={form.radius_km} onChange={event => setForm({ ...form, radius_km: event.target.value })} /></label></div>
      <label className="fungi-weather-check"><input type="checkbox" checked={form.watch_weather} onChange={event => setForm({ ...form, watch_weather: event.target.checked })} /><CloudSun size={17} /><span><strong>Include a dry-weather check</strong><small>Moon timing is optional traditional context and is not treated as biological evidence.</small></span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={busy || !species.length}><Bell size={16} /> {busy ? 'Saving...' : 'Create watch zone'}</button>
    </form>
  )
}

function AlertRow({ item, onUpdate, onDelete }) {
  const title = item.name || item.species_name || item.region_name
  const detail = item.kind === 'zone'
    ? `${item.species_name} · ${item.radius_km} km radius`
    : `${item.recent_observations_7d} public ${item.recent_observations_7d === 1 ? 'record' : 'records'} in the past 7 days${item.latest_observed_on ? ` · latest ${dateLabel(item.latest_observed_on)}` : ''}`
  return <article className={`account-row alert-row ${item.kind === 'zone' ? 'zone-alert-row' : ''}`} key={item.id}><Bell size={18} /><div><div className="alert-title-line"><span>{item.kind === 'zone' ? 'Watch zone' : item.kind}</span><h3>{title}</h3></div><p>{detail}</p>{item.intention && <p className="alert-intention">{item.intention}{item.why ? ` · ${item.why}` : ''}</p>}{item.readiness && <div className="fungi-readiness"><span className={item.readiness.recent_activity ? 'ready' : ''}><MapPin size={12} /> Recent finds</span><span className={item.readiness.season_ready ? 'ready' : ''}><CalendarClock size={12} /> Season</span>{item.watch_weather && <span className={item.readiness.weather_ready ? 'ready' : ''}><CloudSun size={12} /> Weather</span>}{item.moon_phase && <span className={item.readiness.moon_ready ? 'ready' : ''}><MoonStar size={12} /> {item.moon_phase}</span>}</div>}</div><label className="switch-control"><input type="checkbox" aria-label={`Enable ${title} alert`} checked={item.enabled} onChange={event => onUpdate({ id: item.id, enabled: event.target.checked })} /><span aria-hidden="true" /></label><button className="icon-button" type="button" onClick={() => onDelete(item.id)} aria-label={`Remove ${title} alert`}><Trash2 size={17} /></button></article>
}

export default function AccountWorkspace({ user, species, initialTab = 'overview', onClose, onDeleted, onToast, onExplore, onAddFind, onOpenPlace }) {
  const [tab, setTab] = useState(BASE_TABS.some(([id]) => id === initialTab) || (initialTab === 'moderation' && ['admin', 'moderator'].includes(user.role)) ? initialTab : 'overview')
  const deskRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement
    const desk = deskRef.current
    desk?.focus()
    trackFieldEvent('field_desk_open', 'fungi')
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const controls = [...desk.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter(item => item.getClientRects().length)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === desk)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    desk?.addEventListener('keydown', keydown)
    return () => { desk?.removeEventListener('keydown', keydown); previous?.focus() }
  }, [])
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState(user.email)
  const [emailError, setEmailError] = useState('')
  const [error, setError] = useState('')
  const logbook = useLogbook(tab === 'logbook' || tab === 'overview')
  const saved = useSavedLocations(tab === 'saved' || tab === 'overview')
  const alerts = useAlerts(tab === 'alerts' || tab === 'overview')
  const sessions = useSessions(tab === 'sessions')
  const moderation = useModerationQueue(tab === 'moderation' && ['admin', 'moderator'].includes(user.role))
  const updateLogbook = useUpdateLogbook()
  const deleteLogbook = useDeleteLogbook()
  const updateSaved = useUpdateSavedLocation()
  const deleteSaved = useDeleteSavedLocation()
  const updateAlert = useUpdateAlert()
  const deleteAlert = useDeleteAlert()
  const createAlert = useCreateAlert()
  const revokeSession = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const deleteAccount = useDeleteAccount()
  const review = useReviewSighting()
  const resend = useResendVerification()
  const changeEmail = useChangeUnverifiedEmail()
  const tabs = ['admin', 'moderator'].includes(user.role)
    ? [...BASE_TABS.slice(0, 4), ['moderation', <ShieldCheck size={17} aria-hidden="true" />, 'Review'], ...BASE_TABS.slice(4)]
    : BASE_TABS

  async function removeObservation(id) {
    if (!window.confirm('Delete this observation from your notebook?')) return
    try { await deleteLogbook.mutateAsync(id); onToast('Observation deleted.') } catch (requestError) { onToast(getApiError(requestError, 'The observation could not be deleted.')) }
  }

  async function removeAccount(event) {
    event.preventDefault()
    if (!window.confirm('Permanently delete this account and its private data?')) return
    setError('')
    try { await deleteAccount.mutateAsync(password); onDeleted() }
    catch (requestError) { setError(getApiError(requestError, 'The account could not be deleted.')) }
  }

  async function correctEmail(event) {
    event.preventDefault()
    setEmailError('')
    try {
      const updated = await changeEmail.mutateAsync(email.trim())
      setEmail(updated.email)
      onToast(`Verification email sent to ${updated.email}.`)
    } catch (requestError) {
      setEmailError(getApiError(requestError, 'The email address could not be updated.'))
    }
  }

  async function createFungiWatch(payload) {
    await createAlert.mutateAsync(payload)
    onToast('Fungi watch zone saved.')
  }

  return (
    <div className="drawer-layer account-workspace-layer">
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="Close field desk" />
      <aside ref={deskRef} tabIndex={-1} className="account-workspace" role="dialog" aria-modal="true" aria-label="Your field desk">
        <div className="drawer-heading account-workspace-heading"><div><p>Private account area</p><h2>Your field desk</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close field desk"><X size={20} /></button></div>
        <div className={`supporter-profile-strip${user.is_supporter ? ' supporter-gilded' : ''}`}><strong>{user.username}{user.is_supporter ? ' · Supporter' : ''}</strong><a href="/supporters">{user.is_supporter ? 'Manage membership' : 'Support the project'}</a></div>
        <div className="account-tabs" role="tablist" aria-label="Field desk views">{tabs.map(([value, icon, label]) => <button key={value} className={tab === value ? 'active' : ''} id={`field-tab-${value}`} aria-controls="field-desk-content" tabIndex={tab === value ? 0 : -1} onKeyDown={event => { const index = tabs.findIndex(([id]) => id === value); const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null; if (next != null) { event.preventDefault(); setTab(tabs[next][0]); document.getElementById(`field-tab-${tabs[next][0]}`)?.focus() } }} type="button" role="tab" aria-selected={tab === value} title={label} onClick={() => setTab(value)}>{icon} {label}</button>)}</div>
        <div className="account-content" id="field-desk-content" role="tabpanel" aria-labelledby={`field-tab-${tab}`} tabIndex={0}>{tab !== 'overview' && <p className="account-cross-links"><a href="/herbs?view=profile">Your profile & astrology</a> · <a href="/herbs?view=collections">Private gathering collections & harvests</a></p>}
          {(() => { const queries = tab === 'overview' ? [saved, logbook, alerts] : [{ saved, logbook, alerts, sessions, moderation }[tab]].filter(Boolean); return queries.some(query => query.isError) ? <div className="form-error" role="alert">Some field records could not load. <button className="button button-secondary compact-button" onClick={() => queries.forEach(query => query.refetch())}>Retry</button></div> : queries.some(query => query.isLoading) ? <p role="status">Loading your field records…</p> : null })()}
          {tab === 'overview' && !saved.isPending && !logbook.isPending && !alerts.isPending && !saved.isError && !logbook.isError && !alerts.isError && <FieldDeskOverview user={user} saved={saved} logbook={logbook} alerts={alerts} onTab={setTab} onExplore={onExplore} onAddFind={onAddFind} onOpenPlace={onOpenPlace} />}
          {tab === 'logbook' && <section><div className="section-heading"><div><h3>Field notebook</h3><p>Full coordinates remain private unless you publish them.</p></div><div className="heading-actions"><strong>{logbook.data?.length ?? 0}</strong><button className="button button-secondary compact-button" type="button" disabled={!logbook.data?.length} onClick={() => exportNotebook(logbook.data)}><Download size={15} /> Export CSV</button></div></div>{logbook.isLoading && <p className="empty-state">Loading notebook...</p>}{logbook.data?.map(item => <LogbookRow key={item.id} item={item} species={species} onUpdate={updateLogbook.mutateAsync} onDelete={removeObservation} busy={updateLogbook.isPending} />)}{!logbook.isLoading && !logbook.isError && !logbook.data?.length && <div className="field-empty"><p>Your submitted finds will appear here.</p><button className="button button-primary" onClick={onAddFind}>Record your first find</button></div>}</section>}

          {tab === 'saved' && <section><div className="section-heading"><div><h3>Saved places</h3><p>Your private shortlist, ordered by revisit date. Calendar reminders are downloaded to your device.</p></div><strong>{saved.data?.length ?? 0}</strong></div>{plannedPlaces(saved.data ?? []).map(item => <SavedRow key={item.id} item={item} onUpdate={updateSaved.mutateAsync} onDelete={async id => { try { await deleteSaved.mutateAsync(id); onToast('Saved place removed.') } catch (requestError) { onToast(getApiError(requestError, 'Could not remove this place.')) } }} onOpenPlace={onOpenPlace} busy={updateSaved.isPending || deleteSaved.isPending} />)}{!saved.isLoading && !saved.isError && !saved.data?.length && <div className="field-empty"><p>Save an observation, add a return date, and keep your planning notes together.</p><button className="button button-primary" onClick={onExplore}>Find a place to save</button></div>}</section>}

          {tab === 'alerts' && <section><div className="section-heading"><div><h3>Field watchlist</h3><p>Follow broad collections or create a place-based watch with a reason.</p></div><strong>{alerts.data?.filter(item => item.enabled).length ?? 0}</strong></div><FungiWatchForm species={species} onCreate={createFungiWatch} busy={createAlert.isPending} />{alerts.data?.map(item => <AlertRow key={item.id} item={item} onUpdate={payload => updateAlert.mutate(payload, { onError: error => onToast(getApiError(error, 'Could not update this alert.')) })} onDelete={id => deleteAlert.mutate(id, { onError: error => onToast(getApiError(error, 'Could not remove this alert.')) })} />)}{!alerts.isLoading && !alerts.data?.length && <p className="empty-state">Create a watch zone here, or follow a species guide or regional field page.</p>}</section>}

          {tab === 'moderation' && <section><div className="section-heading"><div><h3>Review queue</h3><p>Record which field marks the evidence actually shows.</p></div><strong>{moderation.data?.length ?? 0}</strong></div>{moderation.data?.map(item => <ModerationRow key={item.id} item={item} onReview={review.mutate} busy={review.isPending} />)}{!moderation.isLoading && !moderation.data?.length && <p className="empty-state">The review queue is clear.</p>}</section>}

          {tab === 'sessions' && <section><div className="section-heading"><div><h3>Active sessions</h3><p>Revoke access from devices you no longer use.</p></div><button className="button button-secondary compact-button" type="button" onClick={() => revokeOthers.mutate()}>Sign out others</button></div>{sessions.data?.map(item => <article className="account-row session-row" key={item.id}><Clock3 size={19} /><div><h3>{item.current ? 'This device' : 'Signed-in device'}</h3><p title={item.user_agent || undefined}>{deviceLabel(item.user_agent || '')} · active {new Date(item.last_seen_at).toLocaleDateString()}</p></div>{!item.current && <button className="button button-secondary compact-button" type="button" onClick={() => revokeSession.mutate(item.id)}>Revoke</button>}</article>)}</section>}

          {tab === 'settings' && <section className="settings-section"><div className="settings-block"><h3>Email verification</h3><p>{user.email_verified ? 'Your account email is verified.' : `Verification is pending for ${user.email}.`}</p>{!user.email_verified && <><form onSubmit={correctEmail}><label>Correct email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>{emailError && <p className="form-error" role="alert">{emailError}</p>}<button className="button button-secondary" disabled={changeEmail.isPending || email.trim().toLowerCase() === user.email.toLowerCase()}>Update and send verification</button></form><button className="button button-secondary" type="button" disabled={resend.isPending} onClick={async () => { try { await resend.mutateAsync(); onToast('Verification email requested.') } catch (requestError) { onToast(getApiError(requestError, 'Could not request verification email.')) } }}>Resend verification</button></>}</div><form className="settings-block danger-zone" onSubmit={removeAccount}><h3>Delete account</h3><p>Private saves, alerts, and unpublished observations are removed. Approved public contributions are anonymized. Any supporter renewal is stopped before your account is deleted.</p><label>Confirm password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button danger-button" disabled={deleteAccount.isPending}><Trash2 size={16} /> Delete account</button></form></section>}
        </div>
      </aside>
    </div>
  )
}
