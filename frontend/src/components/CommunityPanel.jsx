import { BookOpen, CalendarDays, CheckCircle2, MapPin, Users, X } from 'lucide-react'

function formatEventDate(value) {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function CommunityPanel({ portal = {}, loading, onClose }) {
  const finds = portal.finds ?? []
  const events = portal.events ?? []
  const clubs = portal.clubs ?? []
  const resources = portal.resources ?? []

  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="Close community panel" />
      <aside className="community-drawer" aria-label="Community field desk">
        <div className="drawer-heading">
          <div>
            <p>Community field desk</p>
            <h2>What foragers are seeing</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close community panel">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="community-scroll">
          <section className="community-section">
            <div className="community-section-heading">
              <CheckCircle2 size={18} aria-hidden="true" />
              <h3>Recent finds</h3>
            </div>
            {loading && <p className="loading-line">Loading community activity...</p>}
            {!loading && finds.length === 0 && <p className="empty-line">No reviewed finds have been published yet.</p>}
            <div className="community-list">
              {finds.map(item => (
                <article key={item.id} className="community-find">
                  <div className="find-icon" aria-hidden="true">{item.species_name?.slice(0, 1) ?? '?'}</div>
                  <div>
                    <div className="find-title-row">
                      <h4>{item.species_name ?? item.title}</h4>
                      <span className={item.reviewed ? 'status-reviewed' : 'status-pending'}>
                        {item.reviewed ? 'Reviewed' : 'Pending'}
                      </span>
                    </div>
                    <p>{item.title}</p>
                    <span><MapPin size={13} aria-hidden="true" /> {item.region}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="community-section">
            <div className="community-section-heading">
              <CalendarDays size={18} aria-hidden="true" />
              <h3>Upcoming events</h3>
            </div>
            <div className="community-list">
              {events.map(event => (
                <article key={event.id} className="event-row">
                  <time dateTime={event.starts_on}>{formatEventDate(event.starts_on)}</time>
                  <div><h4>{event.title}</h4><p>{event.location_name}</p></div>
                </article>
              ))}
              {!loading && events.length === 0 && <p className="empty-line">No events are scheduled yet.</p>}
            </div>
          </section>

          <section className="community-section">
            <div className="community-section-heading">
              <Users size={18} aria-hidden="true" />
              <h3>Local groups</h3>
            </div>
            <div className="community-list divided-list">
              {clubs.map(club => (
                <article key={club.id}>
                  <h4>{club.name}</h4>
                  <p>{club.region} / {club.meeting_cadence}</p>
                </article>
              ))}
              {!loading && clubs.length === 0 && <p className="empty-line">No groups are listed yet.</p>}
            </div>
          </section>

          <section className="community-section">
            <div className="community-section-heading">
              <BookOpen size={18} aria-hidden="true" />
              <h3>Field guides</h3>
            </div>
            <div className="community-list divided-list">
              {resources.map(resource => (
                <article key={resource.id}>
                  <span className="resource-type">{resource.category}</span>
                  <h4>{resource.title}</h4>
                  <p>{resource.summary}</p>
                </article>
              ))}
              {!loading && resources.length === 0 && <p className="empty-line">No guides are published yet.</p>}
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
