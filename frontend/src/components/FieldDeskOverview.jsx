import { Bell, Bookmark, CalendarClock, MapPin, NotebookPen } from 'lucide-react'
import { localDateKey, plannedPlaces, revisitStatus } from '../lib/fieldPlanning'

export default function FieldDeskOverview({ user, saved, logbook, alerts, onTab, onExplore, onAddFind, onOpenPlace }) {
  const places = saved.data ?? []
  const records = logbook.data ?? []
  const watches = alerts.data ?? []
  const planned = plannedPlaces(places).filter(item => item.revisit_on)
  const due = planned.filter(item => item.revisit_on <= localDateKey())
  const active = watches.filter(item => item.enabled)
  const species = new Set(records.map(item => item.species_id).filter(Boolean)).size
  const visited = places.filter(item => item.visited_on).length
  return <section className="field-overview">
    <p className="field-eyebrow">Your next time outside</p><h3>Welcome back, {user.username}.</h3><p>Your places, plans, and observations stay together here.</p>
    <div className="field-desk-stats"><button onClick={() => onTab('saved')}><Bookmark size={18} /><strong>{places.length}</strong><span>Saved places</span></button><button onClick={() => onTab('logbook')}><NotebookPen size={18} /><strong>{species}</strong><span>Species recorded</span></button><button onClick={() => onTab('alerts')}><Bell size={18} /><strong>{active.length}</strong><span>Active watches</span></button></div>
    <div className="section-heading"><div><h3><CalendarClock size={19} /> Next visits</h3><p>{due.length ? `${due.length} ${due.length === 1 ? 'place is' : 'places are'} ready to revisit.` : 'Turn an interesting record into a plan.'}</p></div><button className="button button-secondary compact-button" onClick={() => onTab('saved')}>Manage plans</button></div>
    {planned.length ? planned.slice(0, 4).map(item => <article className="field-next-visit" key={item.id}><div><h4>{item.title}</h4><p>{revisitStatus(item.revisit_on)}</p></div><button className="button button-secondary compact-button" onClick={() => onOpenPlace(item)}><MapPin size={15} /> Open map</button></article>) : <div className="field-empty"><h4>{places.length ? 'Choose when to return' : 'Start with a place that interests you'}</h4><p>{places.length ? 'Add a revisit date to a saved place. You can download a calendar reminder for it.' : 'Explore recent observations, then save a place to make it part of your next outing.'}</p><button className="button button-primary" onClick={places.length ? () => onTab('saved') : onExplore}>{places.length ? 'Plan a saved place' : 'Explore observations'}</button></div>}
    {visited > 0 && <p className="field-small">You have visited {visited} saved {visited === 1 ? 'place' : 'places'}. Your last visit dates are kept with your plans.</p>}<div className="field-next-steps"><h3>Keep your field record growing</h3><button onClick={onAddFind}><NotebookPen size={19} /><span><strong>Record a find</strong><small>Keep dates, habitat, and your own notes for next season.</small></span></button><button onClick={() => onTab('alerts')}><Bell size={19} /><span><strong>Watch a place or species</strong><small>Check recent activity and choose the signals you care about.</small></span></button><a href="/learn/foraging"><span><strong>Prepare before heading out</strong><small>Read field skills, access guidance, and identification basics.</small></span></a></div>
  </section>
}
