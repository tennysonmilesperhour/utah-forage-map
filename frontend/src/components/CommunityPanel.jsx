import { useEffect, useState } from 'react'
import {
  ArrowRight, BookOpen, CalendarDays, CheckCircle2, CircleUserRound,
  ExternalLink, MapPin, NotebookPen, ShieldAlert, ShieldCheck, Users, X,
} from 'lucide-react'

function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return 'Not recorded'
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, options)
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString()
}

function ExternalAction({ href, children }) {
  if (!href) return null
  return (
    <a className="community-external-link" href={href} target="_blank" rel="noreferrer">
      {children} <ExternalLink size={14} aria-hidden="true" />
    </a>
  )
}

export default function CommunityPanel({
  portal = {}, loading, initialView, user, onClose, onNavigate, onViewSighting,
  onAddFind, onCreateAccount,
}) {
  const [section, setSection] = useState(initialView === 'guide' ? 'guide' : 'activity')
  const activity = portal.activity ?? []
  const summary = portal.summary ?? {}
  const events = portal.events ?? []
  const clubs = portal.clubs ?? []
  const resources = portal.resources ?? []

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  function openRoute(event, view) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    setSection(view === 'guide' ? 'guide' : 'activity')
    onNavigate(view)
  }

  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="Close community field desk" />
      <aside className="community-drawer" role="dialog" aria-modal="true" aria-labelledby="community-title">
        <div className="drawer-heading community-heading">
          <div>
            <p>Community field desk</p>
            <h2 id="community-title">Finds, people, and field knowledge</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close community field desk">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="community-tabs" aria-label="Community views">
          <a className={section === 'activity' ? 'active' : ''} href="/community" onClick={event => openRoute(event, 'community')} aria-current={section === 'activity' ? 'page' : undefined}>
            <CheckCircle2 size={16} aria-hidden="true" /> Activity
          </a>
          <button className={section === 'connections' ? 'active' : ''} type="button" onClick={() => setSection('connections')}>
            <Users size={16} aria-hidden="true" /> Events & groups
          </button>
          <a className={section === 'guide' ? 'active' : ''} href="/field-guide" onClick={event => openRoute(event, 'guide')} aria-current={section === 'guide' ? 'page' : undefined}>
            <BookOpen size={16} aria-hidden="true" /> Field guide
          </a>
        </nav>

        <div className="community-scroll">
          {section === 'activity' && (
            <>
              <section className="community-intro">
                <div>
                  <h3>Recent reviewed observations</h3>
                  <p>Browse the live field map without an account. Create one only when you want to submit a find, save a place, or keep a logbook.</p>
                </div>
                <div className="community-actions">
                  <button className="button button-primary" type="button" onClick={onAddFind}>
                    <NotebookPen size={17} aria-hidden="true" /> Add a find
                  </button>
                  {!user && (
                    <button className="button button-secondary" type="button" onClick={onCreateAccount}>
                      <CircleUserRound size={17} aria-hidden="true" /> Create account
                    </button>
                  )}
                </div>
              </section>

              <dl className="community-metrics" aria-label="Community map summary">
                <div><dt>Reviewed observations</dt><dd>{formatNumber(summary.reviewed_observations)}</dd></div>
                <div><dt>Species represented</dt><dd>{formatNumber(summary.species_count)}</dd></div>
                <div><dt>Found in past 90 days</dt><dd>{formatNumber(summary.recent_observations)}</dd></div>
              </dl>

              <section className="community-section activity-section">
                <div className="community-section-heading">
                  <MapPin size={18} aria-hidden="true" />
                  <div><h3>Latest from the field</h3><p>Approximate public locations, newest observation first</p></div>
                </div>
                {loading && <p className="loading-line" role="status">Loading community activity...</p>}
                {!loading && activity.length === 0 && <p className="empty-line">No dated, reviewed observations have been published yet.</p>}
                <div className="activity-list">
                  {activity.map(item => (
                    <article key={item.id} className="activity-row">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={`${item.species?.common_name ?? 'Mushroom'} field observation`} loading="lazy" />
                      ) : (
                        <div className="find-icon" aria-hidden="true">{item.species?.common_name?.slice(0, 1) ?? '?'}</div>
                      )}
                      <div className="activity-copy">
                        <div className="find-title-row">
                          <div><h4>{item.species?.common_name ?? 'Unknown mushroom'}</h4><p className="latin-name">{item.species?.latin_name}</p></div>
                          <span className="status-reviewed"><ShieldCheck size={12} aria-hidden="true" /> Reviewed</span>
                        </div>
                        <p className="activity-meta">
                          <time dateTime={item.found_on}>{formatDate(item.found_on)}</time>
                          <span>{item.place_name ?? 'Approximate map location'}</span>
                          <span>{item.source}</span>
                        </p>
                      </div>
                      <button className="button button-secondary view-map-button" type="button" onClick={() => onViewSighting(item)}>
                        <MapPin size={16} aria-hidden="true" /> View on map
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <p className="community-provenance">
                Latest observed date: <strong>{formatDate(summary.latest_observed_on)}</strong>
                {summary.last_synced_at && <>. Source data last reconciled <strong>{formatDate(summary.last_synced_at)}</strong></>}.
              </p>
            </>
          )}

          {section === 'connections' && (
            <>
              <section className="community-intro compact">
                <div><h3>Meet people in the field</h3><p>Upcoming walks, surveys, and groups can turn a map point into safer, better local knowledge.</p></div>
                <button className="button button-primary" type="button" onClick={onAddFind}><NotebookPen size={17} aria-hidden="true" /> Share a find</button>
              </section>

              <section className="community-section">
                <div className="community-section-heading"><CalendarDays size={18} aria-hidden="true" /><div><h3>Upcoming events</h3><p>Published community field activities</p></div></div>
                <div className="community-list divided-list">
                  {events.map(event => (
                    <article key={event.id} className="connection-row">
                      <time dateTime={event.starts_on}>{formatDate(event.starts_on, { month: 'short', day: 'numeric' })}</time>
                      <div><h4>{event.title}</h4><p>{event.location_name}{event.region ? `, ${event.region}` : ''}</p>{event.description && <p>{event.description}</p>}<ExternalAction href={event.url}>Event details</ExternalAction></div>
                    </article>
                  ))}
                  {!loading && events.length === 0 && <p className="empty-line">No future events are listed right now.</p>}
                </div>
              </section>

              <section className="community-section">
                <div className="community-section-heading"><Users size={18} aria-hidden="true" /><div><h3>Foraging groups</h3><p>Independent groups and local communities</p></div></div>
                <div className="community-list divided-list">
                  {clubs.map(club => (
                    <article key={club.id} className="group-row">
                      <div><h4>{club.name}</h4><p>{club.region}{club.meeting_cadence ? ` / ${club.meeting_cadence}` : ''}</p>{club.description && <p>{club.description}</p>}</div>
                      <ExternalAction href={club.contact_url}>Visit group</ExternalAction>
                    </article>
                  ))}
                  {!loading && clubs.length === 0 && <p className="empty-line">No groups are listed yet.</p>}
                </div>
              </section>
            </>
          )}

          {section === 'guide' && (
            <>
              <section className="community-intro guide-intro">
                <div><h3>Use field data with care</h3><p>The map helps you understand where and when mushrooms have been observed. It does not grant access or confirm that a mushroom is safe to eat.</p></div>
                <button className="button button-primary" type="button" onClick={onClose}>Explore the map <ArrowRight size={17} aria-hidden="true" /></button>
              </section>

              <section className="guide-safety" aria-labelledby="safety-title">
                <ShieldAlert size={22} aria-hidden="true" />
                <div><h3 id="safety-title">Never identify edibility from a map</h3><p>Confirm every specimen with a qualified local expert. When poisoning is suspected in the United States, call Poison Control at <a href="tel:18002221222">1-800-222-1222</a>; elsewhere, contact local emergency services.</p></div>
              </section>

              <section className="community-section guide-answers">
                <div className="community-section-heading"><BookOpen size={18} aria-hidden="true" /><div><h3>How the map works</h3><p>Answers for responsible field use</p></div></div>
                <article><h4>Can I forage anywhere a marker appears?</h4><p>No. A marker is evidence of an observation, not permission to collect. Check the current land manager, local rules, closures, permits, and harvest limits before visiting.</p></article>
                <article><h4>Are exact mushroom locations public?</h4><p>Locations marked approximate are shifted 1 to 2.5 miles before publication. This protects sensitive habitat and contributors while keeping the seasonal signal useful.</p></article>
                <article><h4>What does reviewed mean?</h4><p>Reviewed observations passed the source or community review process. That status supports data quality, but it is not an edibility guarantee or a substitute for identification.</p></article>
                <article><h4>How current is the data?</h4><p>The map opens with observations from the past 90 days. Research-grade iNaturalist records are reconciled every two weeks, and community submissions appear after review.</p></article>
                <article><h4>How should I share a find?</h4><p>Record the observation date, species, habitat, substrate, and a coarse place name. Choose approximate privacy for sensitive habitat and avoid publishing access routes across private land.</p></article>
              </section>

              <section className="community-section">
                <div className="community-section-heading"><ExternalLink size={18} aria-hidden="true" /><div><h3>Trusted resources</h3><p>Source, safety, and land-use references</p></div></div>
                <div className="community-list divided-list resource-list">
                  {resources.map(resource => (
                    <article key={resource.id}>
                      <div><span className="resource-type">{resource.category}</span><h4>{resource.title}</h4><p>{resource.summary}</p></div>
                      <ExternalAction href={resource.url}>Open resource</ExternalAction>
                    </article>
                  ))}
                  {!loading && resources.length === 0 && <p className="empty-line">No field resources are published yet.</p>}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
