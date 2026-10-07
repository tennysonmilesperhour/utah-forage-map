import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Check, MapPin, Search, Sprout } from 'lucide-react'
import DataFreshness from './DataFreshness'
import { trackFieldEvent } from '../lib/googleTag'
import { dateLabel, observationCoverage, observationResults } from '../lib/fieldPlanning'

export default function ObservationList({ scope, onBroaden, sightings, loading, error, onRetry, onSelect, onSave, savedIds, saving, user, onAccount, onClear }) {
  const trackedOpen = useRef(false)
  useEffect(() => {
    if (!trackedOpen.current) { trackFieldEvent('observation_list_open', 'fungi'); trackedOpen.current = true }
  }, [])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [savedOnly, setSavedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const results = useMemo(() => observationResults(sightings, { query, sort, savedOnly, savedIds }), [sightings, query, sort, savedOnly, savedIds])
  const coverage = observationCoverage(sightings)
  const pages = Math.max(1, Math.ceil(results.length / 24))
  const currentPage = Math.min(page, pages)
  return <section className="observation-list" aria-label="Browse observations">
    <div className="field-list-heading"><div><p className="field-eyebrow">From the field</p><h2>Find your next place to study</h2><p>Recent observations in the map area. Save a place, choose a return date, and build your own field record.</p></div><button className="button button-secondary" onClick={onAccount}><Bookmark size={16} /> {user ? 'My saved places' : 'Start a field desk'}</button></div>
    <div className="field-list-controls"><label className="field-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search loaded observations</span><input type="search" placeholder="Species, place, or habitat" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} /></label><label>Sort<select value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}><option value="recent">Newest observed</option><option value="species">Species A–Z</option></select></label>{user && <label className="field-saved-only"><input type="checkbox" checked={savedOnly} onChange={event => { setSavedOnly(event.target.checked); setPage(1) }} /> Saved in this area</label>}</div>
    <p className="field-results-note" role="status">{error ? 'Observations unavailable' : loading ? 'Loading observations…' : `${results.length.toLocaleString()} matching observations`}{sightings.length >= 4000 && ' · Showing up to 4,000 records. Narrow the map or filters for more detail.'}</p>
    {!loading && !error && <aside className="field-coverage" aria-label="Coverage of these results"><strong>{scope} · {coverage.limited ? 'Limited recorded evidence' : 'Recorded evidence'}</strong><p>{coverage.latest ? `Latest observation: ${dateLabel(coverage.latest)}. ${coverage.recent.toLocaleString()} of these records were observed in the past 14 days.` : 'No dated observations in these results.'} This describes the loaded records, not a survey of what is growing here.</p>{(coverage.limited || !coverage.recent) && <div className="saved-plan-actions"><button className="button button-secondary compact-button" onClick={onBroaden}>Include older observations</button><a href="/regions">Read regional field guides</a><a href="/learn/foraging">Prepare for your own survey</a></div>}<DataFreshness compact /></aside>}
    <p className="field-safety-note">A record is a starting point, not a harvest guarantee. Locations may be approximate; confirm identification and land access independently.</p>
    {error ? <div className="field-empty"><h3>Records could not load</h3><p>Your filters are still here.</p><button className="button button-primary" onClick={onRetry}>Try again</button></div> : !loading && !results.length ? <div className="field-empty"><Sprout size={26} /><h3>{savedOnly ? 'No saved places in these results' : 'No matching observations'}</h3><p>Try another place or a broader date window. No records does not mean no fungi.</p><button className="button button-secondary" onClick={() => { setQuery(''); setSavedOnly(false); onClear(); setPage(1) }}>Reset search and filters</button><a href="/regions">Explore regional field guides</a></div> : <div className="field-results-grid">{results.slice((currentPage - 1) * 24, currentPage * 24).map(item => <article className="field-result" key={item.id}>
      <button className="field-result-open" onClick={() => onSelect(item)} aria-label={`View ${item.species?.common_name ?? 'mushroom'} observation in ${item.place_name || 'unrecorded place'}`}>
        <div className="field-result-photo">{item.photo_url ? <img src={item.photo_url} alt="" loading="lazy" width="320" height="180" /> : <Sprout size={36} aria-hidden="true" />}<span>{item.verified ? 'Reviewed source' : 'Community record'}</span></div>
        <div className="field-result-copy"><p>{dateLabel(item.found_on)}</p><h3>{item.species?.common_name ?? 'Mushroom observation'}</h3><p>{item.species?.latin_name}</p><p className="field-result-place"><MapPin size={14} aria-hidden="true" />{item.place_name || 'Locality not recorded'}</p>{item.habitat_type && <p>{item.habitat_type}</p>}</div>
      </button>
      <button className="field-result-save" disabled={saving || savedIds.has(item.id)} onClick={() => onSave(item)}>{savedIds.has(item.id) ? <Check size={16} /> : <Bookmark size={16} />}{savedIds.has(item.id) ? 'Saved to your field desk' : 'Save for a visit'}</button>
    </article>)}</div>}
    {!loading && !error && pages > 1 && <nav className="field-pagination" aria-label="Observation pages"><button className="button button-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button className="button button-secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
  </section>
}
