import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, BookOpen, Globe2, Leaf, LoaderCircle, MapPinned, Maximize2, Search, ShieldAlert, SlidersHorizontal, Sparkles } from 'lucide-react'
import FieldPhoto from './components/FieldPhoto'
import HerbalHeader from './components/HerbalHeader'
import MakerCredit from './components/MakerCredit'
import AuthDialog from './components/AuthDialog'
import PlaceSearch from './components/PlaceSearch'
import OccurrenceLegend from './components/OccurrenceLegend'
import { useGrowingZone, useOccurrence } from './hooks/useOccurrence'
import { hemisphereFor, speciesOccurrence } from './data/occurrence'
import { monthRangeLabel, peakMonths } from './lib/occurrenceGrid'
import { useCurrentUser, useLogout } from './hooks/useAuth'
import { useVisitorCountry } from './hooks/useVisitorCountry'
import { herbHref } from './lib/navigation'
import { applyPageMetadata } from './lib/seo'
import { trackPageView, trackFieldEvent } from './lib/googleTag'
import { boundsArray, dateLabel, licenseHref, mapPlants, mapPlantBySlug, mapSearchParams, MONTHS, readMapSearch, WORLD_BOUNDS } from './lib/herbMap'
import './herbal.css'
import './herbal-forest.css'
import './herb-map.css'
import './occurrence.css'

const MapView = lazy(() => import('./components/MapView'))
const IdentifyPanel = lazy(() => import('./components/IdentifyPanel'))
const statusLabels = { culinary: 'Culinary reference', caution: 'Special caution', study: 'Study reference', toxic: 'Toxic · do not gather' }

function ObservationPhoto({ record, plant }) {
  const [failed, setFailed] = useState(false)
  if (!record.photo || failed) return <div className="herb-map-photo-empty"><Leaf size={32} strokeWidth={1} /><span>Open the original observation for photographs</span></div>
  return <figure className="herb-map-photo"><FieldPhoto url={record.photo.url} alt={`${plant.name} observed by ${record.observer}`} variant="card" eager sizes="(max-width: 800px) 100vw, 360px" onError={() => setFailed(true)} /><figcaption><a href={record.sourceUrl} target="_blank" rel="noreferrer">{record.photo.credit}</a> · <a href={licenseHref(record.photo.license)} target="_blank" rel="noreferrer">{record.photo.license.toUpperCase()}</a></figcaption></figure>
}
function WhereItGrows({ plant, hemisphere, zone, onFitZone }) {
  const summary = speciesOccurrence('herbs', plant.slug)
  if (!summary) return null
  const months = summary.months[hemisphere]
  const local = months.reduce((sum, value) => sum + value, 0) >= 12
  return <section className="herb-map-where" aria-label={`Where ${plant.name} grows`}>
    <p className="herb-kicker">Where it grows</p>
    <p>Its known growing zone is outlined on the map. Switch on Hotspots in the map key to see where the most people have verified {plant.name.toLowerCase()} records.</p>
    <dl><div><dt>Verified records</dt><dd>{summary.total.toLocaleString()}</dd></div><div><dt>People</dt><dd>{summary.observers.toLocaleString()}</dd></div><div><dt>Most records</dt><dd>{monthRangeLabel(peakMonths(local ? months : summary.months[hemisphere === 'north' ? 'south' : 'north']))}</dd></div></dl>
    {zone && <button type="button" onClick={onFitZone}><Maximize2 size={14} />Show the whole growing zone</button>}
  </section>
}
function ObservationDetail({ record, onClose, hemisphere, zone, onFitZone }) {
  const plant = mapPlantBySlug[record.plant]
  return <article className="herb-map-detail">
    <button className="herb-map-back" onClick={onClose}><ArrowLeft size={15} />All observations</button>
    <ObservationPhoto key={record.id} record={record} plant={plant} />
    <div className={`herb-map-status ${plant.status}`}>{statusLabels[plant.status]}</div>
    <h2>{plant.name}</h2><p className="herb-map-latin">{plant.latin}</p>
    <dl><div><dt>Observed</dt><dd>{dateLabel(record.observedOn)}</dd></div><div><dt>Observer</dt><dd>{record.observer}</dd></div><div><dt>Place</dt><dd>{record.locality}</dd></div><div><dt>Location precision</dt><dd>{record.obscured ? 'Approximate public point; the exact location is protected.' : record.accuracy === null ? 'Accuracy not supplied by the observer.' : `Reported accuracy: ${Math.round(record.accuracy).toLocaleString()} m`}</dd></div></dl>
    {plant.status === 'toxic' && <p className="herb-map-danger"><ShieldAlert size={17} />This toxic plant is included for recognition. Do not gather or consume it.</p>}
    <WhereItGrows plant={plant} hemisphere={hemisphere} zone={zone} onFitZone={onFitZone} />
    <a className="herb-solid-button" href={`/herbs/atlas/${plant.slug}`}><BookOpen size={15} />Read the plant profile</a>
    <a className="herb-map-source" href={record.sourceUrl} target="_blank" rel="noreferrer">Original observation <ArrowUpRight size={15} /></a>
    <p className="herb-map-fine">Community identification · iNaturalist research grade. This record does not establish safe identification, current abundance or permission to gather.</p>
    <small>Observation data © {record.observer} · <a href={licenseHref(record.license)} target="_blank" rel="noreferrer">{record.license.toUpperCase()}</a></small>
  </article>
}

export default function HerbMapApp() {
  const [search, setSearch] = useState(() => readMapSearch(typeof window === 'undefined' ? '' : window.location.search))
  const resultsRef = useRef(null)
  const viewportRef = useRef(search.bbox)
  const startedRef = useRef(!!search.bbox)
  const [flyTarget, setFlyTarget] = useState(() => search.bbox ? { bbox: search.bbox, key: 'shared-area' } : null)
  const [areaChanged, setAreaChanged] = useState(false)
  const [selected, setSelected] = useState(null)
  const [visibleCount, setVisibleCount] = useState(20)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [authMode, setAuthMode] = useState(null)
  const [mapError, setMapError] = useState(null)
  const [identifyOpen, setIdentifyOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('identify') === '1')
  const [mapCentre, setMapCentre] = useState(null)
  const { data: user = null, isLoading: authLoading } = useCurrentUser()
  const logout = useLogout()
  const country = useVisitorCountry(!search.bbox)
  const hasMap = !!import.meta.env.VITE_MAPBOX_TOKEN
  const countryPending = hasMap && country.isPending && !search.bbox
  const results = useQuery({
    queryKey: ['herb-observations', search],
    enabled: !!search.bbox,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/herb-observations?${mapSearchParams(search)}`, { signal })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data) throw new Error(data?.error || 'Observations are temporarily unavailable.')
      if (!Array.isArray(data.observations)) throw new Error('The observation source returned an unexpected response.')
      return data
    },
    retry: false, staleTime: 10 * 60 * 1000, refetchOnWindowFocus: false,
  })
  const observations = results.data?.observations || []
  const plant = mapPlantBySlug[search.plant]
  // An open record focuses its own plant; otherwise the plant filter decides.
  const focusPlant = (selected && mapPlantBySlug[selected.plant]) || plant || null
  const [hotspots, setHotspots] = useState(false)
  const occurrence = useOccurrence('herbs', focusPlant?.slug, hotspots)
  const growingZone = useGrowingZone('herbs', focusPlant?.slug)
  const zone = focusPlant ? growingZone.data ?? null : null
  const [userZoneFitKey, setZoneFitKey] = useState(null)
  // Arriving from a plant profile (plant chosen, no shared area) opens on the whole growing zone.
  const [arrivalPlant] = useState(() => !search.bbox && plant ? plant.slug : null)
  const zoneFitKey = userZoneFitKey ?? (arrivalPlant && zone && focusPlant?.slug === arrivalPlant ? `arrival:${arrivalPlant}` : null)
  const hemisphere = hemisphereFor(search.bbox ? (search.bbox[1] + search.bbox[3]) / 2 : NaN)

  useEffect(() => {
    applyPageMetadata('herbMap')
    trackPageView('/herbs/map')
    document.body.classList.add('herbal-body')
    const restore = () => {
      const next = readMapSearch(window.location.search)
      viewportRef.current = next.bbox
      startedRef.current = !!next.bbox
      setSearch(next); setSelected(null); setVisibleCount(20); setAreaChanged(false)
      setFlyTarget({ bbox: next.bbox || WORLD_BOUNDS, key: Date.now() })
    }
    window.addEventListener('popstate', restore)
    return () => { document.body.classList.remove('herbal-body'); window.removeEventListener('popstate', restore) }
  }, [])

  useEffect(() => {
    if (!selected) return
    const panel = resultsRef.current
    panel?.scrollTo({ top: 0 })
    if (window.matchMedia('(max-width: 720px)').matches) panel?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    panel?.focus({ preventScroll: true })
  }, [selected])

  function applySearch(next, replace = false) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', `/herbs/map?${mapSearchParams(next)}`)
    setSearch(next); setSelected(null); setVisibleCount(20); setAreaChanged(false)
  }
  function updateBounds(bounds) {
    const bbox = boundsArray(bounds)
    setMapCentre({ latitude: (bounds.north + bounds.south) / 2, longitude: bounds.west <= bounds.east ? (bounds.west + bounds.east) / 2 : ((bounds.west + bounds.east + 360) / 2 + 180) % 360 - 180 })
    viewportRef.current = bbox
    if (!startedRef.current) {
      startedRef.current = true
      applySearch({ ...search, bbox }, true)
    } else setAreaChanged(search.bbox?.some((value, index) => Math.abs(value - bbox[index]) > 0.15) || false)
  }
  function filter(key, value) {
    startedRef.current = true
    applySearch({ ...search, [key]: value, bbox: viewportRef.current || search.bbox || WORLD_BOUNDS })
  }
  function searchArea() {
    startedRef.current = true
    applySearch({ ...search, bbox: viewportRef.current || WORLD_BOUNDS })
  }
  function chooseRecord(record, fly = false) {
    setIdentifyOpen(false)
    setSelected(record)
    if (fly) setFlyTarget({ center: [record.longitude, record.latitude], key: record.id })
  }

  return <div className="herbal-shell herbal-shell--forest herb-map-shell" data-view="map">
    <a className="herb-map-skip" href="#herb-map-results">Skip to observation list</a>
    <HerbalHeader view="map" forest user={user} authLoading={authLoading} onNavigate={view => window.location.assign(herbHref(view))} onAuth={setAuthMode} onLogout={() => logout.mutate()} />
    <main className="herb-map-main">
      <section className="herb-map-heading"><div><p className="herb-kicker">The Verdant Hours · Global field map</p><h1>meet the wild<span>.</span></h1><p>Explore real plant observations, from your country to the wider world.</p></div><a href="/herbs/atlas"><span>{mapPlants.length} plant profiles</span><BookOpen size={17} />Open the atlas <ArrowUpRight size={14} /></a></section>
      <button className="herb-map-filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="herb-map-filters"><SlidersHorizontal size={16} />{filtersOpen ? 'Hide filters' : 'Place, plant & date filters'}<span>{plant?.name || 'All atlas plants'}</span></button>
      <section id="herb-map-filters" className={`herb-map-filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Map filters">
        <div><label>Search a place</label><PlaceSearch onSelect={setFlyTarget} /></div>
        <label>Plant<select value={search.plant} onChange={event => filter('plant', event.target.value)}><option value="all">All {mapPlants.length} atlas plants</option>{mapPlants.map(item => <option value={item.slug} key={item.slug}>{item.name}{item.status === 'toxic' ? ' · TOXIC' : ''}</option>)}</select></label>
        <label>Observed<select value={search.period} onChange={event => filter('period', event.target.value)}><option value="30">Last 30 days</option><option value="365">Last 12 months</option><option value="all">All recorded years</option></select></label>
        <label>Seasonal month<select value={search.month} onChange={event => filter('month', event.target.value)}><option value="">Any month</option>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>
      </section>
      {plant?.status === 'toxic' && <p className="herb-map-selected-warning"><ShieldAlert size={17} />{plant.name} is toxic. These records are for recognition, never gathering.</p>}
      <div className="herb-map-workspace">
        <section className="herb-map-surface" aria-label="Interactive global herb observation map">
          <Suspense fallback={<div className="herb-map-loading"><LoaderCircle className="spin" />Opening the field map…</div>}>
            {countryPending ? <div className="herb-map-loading"><LoaderCircle className="spin" />Finding your country…</div> : <MapView collection="herbs" sightings={observations} onSightingClick={record => chooseRecord(record)} onBoundsChange={updateBounds} countryCamera={country.data} flyTarget={flyTarget} onMapError={setMapError} density={hotspots ? occurrence.data ?? null : null} zone={zone} zoneFitKey={zoneFitKey} />}
          </Suspense>
          <div className="herb-map-map-actions"><button onClick={searchArea} disabled={results.isFetching || countryPending} className={areaChanged ? 'area-changed' : ''}><Search size={15} />{results.isFetching ? 'Loading observations…' : areaChanged ? 'Search this area' : 'Refresh this area'}</button><button aria-label="View the whole world" title="View the whole world" onClick={() => setFlyTarget({ bbox: WORLD_BOUNDS, key: Date.now() })}><Globe2 size={17} /></button><button className={identifyOpen ? 'area-changed' : ''} aria-expanded={identifyOpen} aria-controls="herb-map-results" onClick={() => setIdentifyOpen(open => !open)}><Sparkles size={15} />Suggest an ID</button></div>
          {mapError && <p className="herb-map-error" role="status">The map could not load. You can still search and browse the observation list.</p>}
          <OccurrenceLegend className="herb-occurrence-legend" collection="herbs" focus={focusPlant ? { slug: focusPlant.slug, name: focusPlant.name, latin: focusPlant.latin } : null} hemisphere={hemisphere} zone={zone} zoneLoading={growingZone.isLoading} hotspots={hotspots} hotspotsStatus={occurrence.isError ? 'error' : occurrence.data ? 'ready' : 'loading'} onToggleHotspots={setHotspots} onFitZone={() => setZoneFitKey(Date.now())} onClear={selected ? () => setSelected(null) : () => filter('plant', 'all')} clearLabel={selected ? 'Close this record' : 'Show all plants'} guideHref={focusPlant ? `/herbs/atlas/${focusPlant.slug}` : undefined} />
          <div className="herb-map-legend" aria-label="Point colours"><span><i />Reference plant</span><span><i className="caution" />Caution / study</span><span><i className="toxic" />Toxic lookalike</span></div>
        </section>
        <aside ref={resultsRef} id="herb-map-results" className="herb-map-results" aria-label="Plant observations" tabIndex={-1}>
          {identifyOpen ? <Suspense fallback={<div className="herb-map-empty"><LoaderCircle className="spin" size={25} /></div>}><IdentifyPanel collection="herbs" location={mapCentre} onClose={() => setIdentifyOpen(false)} onShowOnMap={slug => { trackFieldEvent('id_helper_focus', 'herbs'); filter('plant', slug) }} /></Suspense> : selected ? <ObservationDetail record={selected} onClose={() => setSelected(null)} hemisphere={hemisphere} zone={zone} onFitZone={() => setZoneFitKey(Date.now())} /> : <>
            <div className="herb-map-result-heading"><p className="herb-kicker">In this area</p><h2>{plant?.name || 'Field observations'}</h2><p role="status" aria-live="polite">{results.isFetching ? 'Loading public observations…' : results.isError ? 'Observations unavailable' : results.data ? `${observations.length.toLocaleString()} shown · ${results.data.total.toLocaleString()} matching records` : 'Choose an area to explore'}</p></div>
            {results.isError ? <div className="herb-map-empty" role="alert"><Leaf size={26} /><h3>Field records are taking a pause.</h3><p>{results.error.message}</p><button onClick={() => results.refetch()}>Try again</button></div> : results.isFetching ? <div className="herb-map-empty"><LoaderCircle className="spin" size={25} /><p>Gathering the latest public records…</p></div> : results.data && !observations.length ? <div className="herb-map-empty"><Leaf size={28} /><h3>No matching public records.</h3><p>Try all recorded years, another plant, or a wider area. An empty map does not mean a plant is absent.</p><button onClick={() => { trackFieldEvent('map_empty_recovery', 'herbs'); filter('period', 'all') }}>Search all recorded years</button></div> : !results.data ? <div className="herb-map-empty"><MapPinned size={26} /><p>The map opens on your country when available. Search an area to see public plant records.</p><button onClick={searchArea}>Load observations</button></div> : <>
              <ol className="herb-map-records">{observations.slice(0, visibleCount).map(record => {
                const item = mapPlantBySlug[record.plant]
                return <li key={record.id}><button onClick={() => chooseRecord(record, true)}><span className={`herb-map-record-icon ${item.status}`}><Leaf size={17} /></span><span><strong>{item.name}</strong><small>{dateLabel(record.observedOn)}{record.obscured ? ' · Approximate location' : ''}</small><em>{record.locality}</em>{item.status === 'toxic' && <b>Toxic · do not gather</b>}</span><ArrowUpRight size={14} /></button></li>
              })}</ol>
              {visibleCount < observations.length && <button className="herb-map-more" onClick={() => setVisibleCount(visibleCount + 20)}>Show 20 more observations</button>}
            </>}
            <p className="herb-map-coverage">Up to 200 of the newest matching, openly licensed, wild plant records per search. Coverage varies with observer activity. Research grade reflects community identification; it does not confirm safe use.</p>
            {results.data && <small className="herb-map-updated">Retrieved {new Date(results.data.fetchedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}</small>}
          </>}
        </aside>
      </div>
      <footer className="herb-map-footer"><p><Leaf size={15} />An observation is a place to learn, not permission to harvest. Confirm identity, access and local protections.</p><div><a href="https://www.inaturalist.org" target="_blank" rel="noreferrer">Records from iNaturalist <ArrowUpRight size={12} /></a><a href="/herbs/fieldcraft">Gathering & identification guide</a><a href="/privacy">Privacy</a><MakerCredit /></div></footer>
    </main>
    {authMode && <AuthDialog context="herbs" mode={authMode} onClose={() => setAuthMode(null)} onAuthenticated={() => setAuthMode(null)} />}
    {logout.error && <div className="herb-toast" role="alert">Sign out was unsuccessful. Please try again.</div>}
  </div>
}
