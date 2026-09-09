import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BellRing, BookHeart, CalendarDays, Check, ChevronRight, CloudSun,
  Heart, Leaf, ListPlus, LocateFixed, LogIn, Minus, MoonStar, Plus, Search, ShieldAlert, ShoppingBasket, Sparkles,
  Trash2, UserPlus, X, ArrowDown, ArrowUpRight,
} from 'lucide-react'
import AuthDialog from './components/AuthDialog'
import HerbalHeader from './components/HerbalHeader'
import HerbMoonVisual from './components/HerbMoonVisual'
import { getApiError, useCurrentUser, useLogout } from './hooks/useAuth'
import {
  useCreateHerbInventory, useCreateHerbWatchZone, useCreateHerbWishlist,
  useDeleteHerbInventory, useDeleteHerbWatchZone, useDeleteHerbWishlist,
  useHerbAlmanac, useHerbInventory, useHerbWatchZones, useHerbWishlist,
  useUpdateHerbInventory, useUpdateHerbWatchZone,
} from './hooks/useHerbs'
import { herbIntents, herbProfiles, herbsBySlug, harvestMonthsFor } from './data/herbs'
import { lunarContext } from './lib/lunar'
import { trackPageView } from './lib/googleTag'
import { applyPageMetadata } from './lib/seo'
import './herbal.css'
import './herbal-forest.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const VIEWS = ['today', 'plants', 'watches', 'pantry']

function dateLabel(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
}

function currentView() {
  const view = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('view')
  return VIEWS.includes(view) ? view : 'today'
}

function weatherLabel(code) {
  if (code == null) return 'Conditions unavailable'
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Fog or low cloud'
  if (code <= 67) return 'Rain nearby'
  if (code <= 77) return 'Snow nearby'
  if (code <= 82) return 'Rain showers'
  return 'Storm conditions'
}

function MoonDial({ moon }) {
  const next = moon.nextQuarter ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(moon.nextQuarter) : 'soon'
  return (
    <section className="moon-observatory" aria-labelledby="moon-title">
      <HerbMoonVisual moon={moon} />
      <div className="moon-copy">
        <p className="herb-kicker"><MoonStar size={15} /> Sky clock</p>
        <h2 id="moon-title">{moon.phase}</h2>
        <p className="moon-sign">Moon in {moon.sign} <span>Tropical zodiac</span></p>
        <dl><div><dt>Illuminated</dt><dd>{Math.round(moon.illumination * 100)}%</dd></div><div><dt>Next quarter</dt><dd>{next}</dd></div></dl>
        <p className="tradition-note"><Sparkles size={15} /> Traditional correspondence only. The astronomical position is calculated; harvest efficacy is not established.</p>
      </div>
    </section>
  )
}

function WeatherReading({ weather, locating, hasLocation, onLocate }) {
  if (!hasLocation) return (
    <section className="weather-reading is-empty">
      <CloudSun size={28} aria-hidden="true" />
      <div><p className="herb-kicker">Local conditions</p><h2>Bring the weather into view</h2><p>Use an approximate device location to check rain, wind, and a practical dry gathering window. It is not saved until you create a watch zone.</p></div>
      <button className="herb-outline-button" type="button" onClick={onLocate} disabled={locating}><LocateFixed size={16} /> {locating ? 'Locating...' : 'Use my location'}</button>
    </section>
  )
  if (!weather) return <section className="weather-reading is-empty"><CloudSun size={28} /><div><p className="herb-kicker">Local conditions</p><h2>Weather reading unavailable</h2><p>The plant and sky almanac still works without it.</p></div></section>
  const dry = weather.precipitation <= 0.2 && weather.rain_24h <= 1 && weather.wind_speed <= 35
  return (
    <section className="weather-reading">
      <div className="weather-primary"><CloudSun size={29} /><span><strong>{Math.round(weather.temperature)}°</strong><small>{weatherLabel(weather.weather_code)}</small></span></div>
      <div className="weather-metrics"><span><small>Last 24h rain</small><strong>{weather.rain_24h ?? '—'} mm</strong></span><span><small>Next 48h</small><strong>{weather.rain_next_48h ?? '—'} mm</strong></span><span><small>Wind</small><strong>{Math.round(weather.wind_speed)} km/h</strong></span></div>
      <div className={`gathering-verdict ${dry ? 'ready' : 'hold'}`}><Check size={17} /><span><strong>{dry ? 'Dry window open' : 'Wait for a drier window'}</strong><small>{dry ? 'Gather after dew dries and before midday heat.' : 'Wet plants bruise easily and dry less reliably.'}</small></span></div>
    </section>
  )
}

function SeasonalLedger({ hemisphere, onOpen, onNavigate }) {
  const month = new Date().getMonth() + 1
  const inSeason = herbProfiles.filter(herb => harvestMonthsFor(herb, hemisphere).includes(month))
  return (
    <section className="seasonal-ledger" id="seasonal-ledger">
      <div className="herb-section-heading"><div><p className="herb-kicker"><CalendarDays size={15} /> {hemisphere === 'south' ? 'Southern' : 'Northern'} hemisphere · {MONTHS[month - 1]}</p><h2>Plants to revisit this season.</h2></div><button className="herb-outline-button" type="button" onClick={() => onNavigate('plants')}>Explore the atlas <ArrowUpRight size={16} /></button></div>
      <p className="herb-calendar-context">A broad temperate calendar, shifted for the selected hemisphere. Check local plant stage and climate; this is not a tropical calendar or a harvest-safety signal. <a href="/herbs/fieldcraft#seasons">Read the seasonal guide</a>.</p>
      <div className="seasonal-list">
        {inSeason.map(herb => <button type="button" key={herb.slug} onClick={() => onOpen(herb)}><img src={herb.image.url} alt="" loading="lazy" /><span><strong>{herb.name}</strong><em>{herb.latin}</em><small>{herb.parts.join(' · ')}</small></span><ArrowUpRight size={17} /></button>)}
      </div>
      {!inSeason.length && <p className="herb-empty">A quieter season for gathering. Explore the atlas to get to know what grows nearby.</p>}
      <p className="ledger-footnote">Season ranges are broad guides and shift with elevation, latitude, rainfall, and local ecology.</p>
    </section>
  )
}

function TodayView({ almanac, location, locating, moon, onLocate, onOpenPlant, onNavigate }) {
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  return (
    <main className="herbal-main herbal-today">
      <section className="herbal-forest" aria-label="Today's herbal almanac">
        <img className="herbal-forest-image" src="/images/herbs/forest-sanctuary.webp" alt="" fetchPriority="high" />
        <div className="herbal-forest-topline"><span><span className="herb-live-dot" /> Your daily almanac</span><span>{today}</span></div>
        <div className="herbal-forest-content">
          <div className="herbal-intro">
            <p className="herb-kicker">A little closer to the living world</p>
            <h1>Meet the plants.<br /><span>Listen to what stirs.</span></h1>
            <p>Come with curiosity. Get to know the plants, notice the lives around them, and gather with care.</p>
            <div className="herbal-hero-actions"><button className="herb-solid-button" type="button" onClick={() => onNavigate('plants')}>Find your next plant <ArrowUpRight size={18} /></button><a href="/herbs/fieldcraft">Explore field skills <ArrowUpRight size={16} /></a></div>
          </div>
          <MoonDial moon={moon} />
        </div>
        <WeatherReading weather={almanac?.weather} hasLocation={Boolean(location)} locating={locating} onLocate={onLocate} />
      </section>
      <SeasonalLedger hemisphere={almanac?.hemisphere ?? 'north'} onOpen={onOpenPlant} onNavigate={onNavigate} />
      <section className="herb-callouts">
        <button type="button" onClick={() => onNavigate('watches')}><BellRing size={23} /><span><strong>Set a watch zone</strong><small>Combine season, weather, and optional sky timing around a place and intention.</small></span><ChevronRight size={18} /></button>
        <button type="button" onClick={() => onNavigate('pantry')}><ShoppingBasket size={23} /><span><strong>Open your pantry</strong><small>Record gathered material, quantities, preparations, and what you hope to find next.</small></span><ChevronRight size={18} /></button>
      </section>
    </main>
  )
}

// Approved forest B direction with the original atmospheric backdrop.
function ForestTodayView({ almanac, location, locating, moon, onLocate, onOpenPlant, onNavigate }) {
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  return (
    <main className="herbal-main herbal-today forest-today">
      <section className="forest-immersive-hero" aria-label="Today's herbal almanac">
        <img className="forest-immersive-image" src="/images/herbs/forest-immersion.webp" alt="" fetchPriority="high" />
        <div className="forest-dateline"><span><span className="herb-live-dot" /> A little closer to the living world</span><span>{today}</span></div>
        <div className="forest-hero-layout">
          <div className="forest-hero-copy">
            <p className="herb-kicker">Meet the plants. Listen to what stirs.</p>
            <h1>gather<span>.</span></h1>
            <p>Come with curiosity. Get to know the plants, notice the lives around them, and gather with care.</p>
            <div className="herbal-hero-actions"><button className="herb-solid-button" type="button" onClick={() => onNavigate('plants')}>Find your next plant <ArrowUpRight size={18} /></button><a href="/herbs/fieldcraft">Explore field skills <ArrowUpRight size={16} /></a></div>
          </div>
          <MoonDial moon={moon} />
        </div>
        <div className="forest-hero-foot"><span>THE VERDANT HOURS / A FIELD COMPANION</span><a href="#seasonal-ledger">Follow the season <ArrowDown size={14} /></a></div>
      </section>
      <div className="forest-conditions"><WeatherReading weather={almanac?.weather} hasLocation={Boolean(location)} locating={locating} onLocate={onLocate} /></div>
      <SeasonalLedger hemisphere={almanac?.hemisphere ?? 'north'} onOpen={onOpenPlant} onNavigate={onNavigate} />
      <section className="herb-callouts">
        <button type="button" onClick={() => onNavigate('watches')}><BellRing size={23} /><span><strong>Set a watch zone</strong><small>Combine season, weather, and optional sky timing around a place and intention.</small></span><ChevronRight size={18} /></button>
        <button type="button" onClick={() => onNavigate('pantry')}><ShoppingBasket size={23} /><span><strong>Open your pantry</strong><small>Record gathered material, quantities, preparations, and what you hope to find next.</small></span><ChevronRight size={18} /></button>
      </section>
    </main>
  )
}

function PlantDetail({ herb, hemisphere, onClose, onWatch, onWish }) {
  return (
    <aside className="herb-specimen" aria-label={`${herb.name} field notes`}>
      <button className="herb-specimen-close" type="button" onClick={onClose} aria-label="Close plant notes"><X size={19} /></button>
      <figure><img src={herb.image.url} alt={`${herb.name} growing in the field`} /><figcaption><a href={herb.image.source} target="_blank" rel="noreferrer">{herb.image.credit}</a></figcaption></figure>
      <div className="herb-specimen-copy"><p className="herb-kicker">{herb.family}</p><h2>{herb.name}</h2><p className="herb-latin">{herb.latin}</p>
        <div className="harvest-months" aria-label="Typical harvest months">{MONTHS.map((month, index) => <span className={harvestMonthsFor(herb, hemisphere).includes(index + 1) ? 'active' : ''} key={month}>{month}</span>)}</div>
        <dl className="specimen-notes"><div><dt>Field marks</dt><dd>{herb.fieldMarks}</dd></div><div><dt>Habitat</dt><dd>{herb.habitat}</dd></div><div><dt>Harvest</dt><dd>{herb.harvest}</dd></div><div><dt>Stewardship</dt><dd>{herb.stewardship}</dd></div></dl>
        <div className="herb-caution"><ShieldAlert size={18} /><span><strong>Before use</strong>{herb.caution}</span></div>
        <div className="herb-tradition"><MoonStar size={18} /><span><strong>Traditional sky note</strong>{herb.tradition} Preferred traditional window: {herb.moon.join(' or ')}.</span></div>
        <div className="specimen-actions"><button className="herb-solid-button" type="button" onClick={() => onWatch(herb)}><BellRing size={16} /> Watch this plant</button><button className="herb-outline-button" type="button" onClick={() => onWish(herb)}><Heart size={16} /> Add to wish list</button></div>
      </div>
    </aside>
  )
}

function PlantsView({ hemisphere, selected, onSelect, onClose, onWatch, onWish }) {
  const [query, setQuery] = useState('')
  const [part, setPart] = useState('All parts')
  const parts = ['All parts', ...new Set(herbProfiles.flatMap(herb => herb.parts))]
  const visible = herbProfiles.filter(herb => `${herb.name} ${herb.latin} ${herb.habitat}`.toLowerCase().includes(query.toLowerCase()) && (part === 'All parts' || herb.parts.includes(part)))
  return (
    <main className="herbal-main plant-atlas-main">
      <section className="atlas-heading"><div><p className="herb-kicker">Twelve plants to know slowly</p><h1>The gathering atlas</h1></div><p>Begin with field marks, harvest windows, and care for the patch. Each plant also offers a quiet invitation to observe and reflect.</p></section>
      <div className="herb-atlas-tools"><label><Search size={18} /><span className="sr-only">Search plants</span><input type="search" placeholder="Search plant or habitat" value={query} onChange={event => setQuery(event.target.value)} /></label><select value={part} onChange={event => setPart(event.target.value)} aria-label="Filter by gathered part">{parts.map(value => <option key={value}>{value}</option>)}</select></div>
      <section className="herb-folio" aria-label="Herbal field guides">
        {visible.map((herb, index) => <button type="button" className={index % 5 === 0 ? 'folio-feature' : ''} onClick={() => onSelect(herb)} key={herb.slug}><img src={herb.image.url} alt={`${herb.name} in habitat`} loading="lazy" /><span className="folio-copy"><small>{herb.family}</small><strong>{herb.name}</strong><em>{herb.latin}</em><span>{herb.parts.join(' · ')}</span></span></button>)}
      </section>
      {!visible.length && <p className="herb-atlas-empty" role="status">No plants match these filters. Try another name, habitat, or gathered part.</p>}
      {selected && <PlantDetail herb={selected} hemisphere={hemisphere} onClose={onClose} onWatch={onWatch} onWish={onWish} />}
    </main>
  )
}

function GuestGate({ title, copy, onAuth }) {
  return <section className="herb-guest-gate"><span><BookHeart size={28} /></span><div><p className="herb-kicker">Private field account</p><h2>{title}</h2><p>{copy}</p></div><div><button className="herb-solid-button" type="button" onClick={() => onAuth('register')}><UserPlus size={16} /> Create account</button><button className="herb-outline-button" type="button" onClick={() => onAuth('login')}><LogIn size={16} /> Sign in</button></div></section>
}

function WatchForm({ location, presetHerb, onLocate, locating, onSubmit, busy }) {
  const [form, setForm] = useState({ name: '', herb_slug: presetHerb?.slug ?? herbProfiles[0].slug, intention: herbIntents[0], why: '', latitude: location?.latitude ?? '', longitude: location?.longitude ?? '', radius_km: 25, watch_season: true, watch_weather: true, watch_moon: false })
  async function submit(event) {
    event.preventDefault()
    await onSubmit({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), radius_km: Number(form.radius_km), why: form.why || null })
    setForm(current => ({ ...current, name: '', why: '' }))
  }
  return (
    <form className="watch-form" onSubmit={submit}>
      <div className="watch-form-heading"><p className="herb-kicker">New watch zone</p><h2>Name a place and a purpose</h2></div>
      <label>Zone name<input required maxLength="120" placeholder="Creek path, home valley..." value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <div className="herb-paired-fields"><label>Plant<select value={form.herb_slug} onChange={event => setForm({ ...form, herb_slug: event.target.value })}>{herbProfiles.map(herb => <option value={herb.slug} key={herb.slug}>{herb.name}</option>)}</select></label><label>Intention<select value={form.intention} onChange={event => setForm({ ...form, intention: event.target.value })}>{herbIntents.map(value => <option key={value}>{value}</option>)}</select></label></div>
      <label>Why this matters to you<textarea rows="3" maxLength="500" placeholder="What would you like to make room for? A slower walk, time to notice, a familiar place to return to…" value={form.why} onChange={event => setForm({ ...form, why: event.target.value })} /></label>
      <div className="watch-location-heading"><span>Approximate center</span><button type="button" onClick={onLocate} disabled={locating}><LocateFixed size={15} /> {locating ? 'Locating...' : 'Use my location'}</button></div>
      <div className="herb-paired-fields"><label>Latitude<input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={event => setForm({ ...form, latitude: event.target.value })} /></label><label>Longitude<input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={event => setForm({ ...form, longitude: event.target.value })} /></label></div>
      <label>Watch radius <span>{form.radius_km} km</span><input type="range" min="1" max="250" value={form.radius_km} onChange={event => setForm({ ...form, radius_km: event.target.value })} /></label>
      <fieldset className="signal-choices"><legend>Readiness signals</legend><label><input type="checkbox" checked={form.watch_season} onChange={event => setForm({ ...form, watch_season: event.target.checked })} /><span><CalendarDays size={17} /><strong>Growing season</strong><small>Broad regional harvest months</small></span></label><label><input type="checkbox" checked={form.watch_weather} onChange={event => setForm({ ...form, watch_weather: event.target.checked })} /><span><CloudSun size={17} /><strong>Dry weather</strong><small>Rain and wind at the zone</small></span></label><label><input type="checkbox" checked={form.watch_moon} onChange={event => setForm({ ...form, watch_moon: event.target.checked })} /><span><MoonStar size={17} /><strong>Sky tradition</strong><small>Optional, not scientifically established</small></span></label></fieldset>
      <button className="herb-solid-button watch-submit" disabled={busy || (!form.watch_season && !form.watch_weather && !form.watch_moon)}><BellRing size={17} /> {busy ? 'Saving...' : 'Start watching'}</button>
    </form>
  )
}

function WatchCard({ zone, onToggle, onDelete }) {
  const status = zone.readiness
  const reasons = [{ label: 'Season', enabled: zone.watch_season, ready: status.season_ready }, { label: 'Weather', enabled: zone.watch_weather, ready: status.weather_ready }, { label: 'Sky tradition', enabled: zone.watch_moon, ready: status.moon_ready }].filter(item => item.enabled)
  return (
    <article className={`watch-card ${status.ready && zone.enabled ? 'is-ready' : ''}`}><div className="watch-card-top"><span className="watch-plant-mark"><Leaf size={20} /></span><div><p>{zone.name}</p><h3>{zone.herb_name}</h3><em>{zone.herb_latin_name}</em></div><label className="herb-switch"><input type="checkbox" checked={zone.enabled} onChange={event => onToggle(zone.id, event.target.checked)} /><span /></label></div><p className="watch-intention"><Sparkles size={15} /> {zone.intention}{zone.why ? ` · ${zone.why}` : ''}</p><div className="signal-status">{reasons.map(item => <span className={item.ready ? 'ready' : 'waiting'} key={item.label}>{item.ready ? <Check size={13} /> : <CalendarDays size={13} />}{item.label}</span>)}</div><div className="watch-card-foot"><span>{status.ready ? 'Gathering window open' : 'Watching for alignment'}</span><small>{zone.radius_km} km radius · {zone.hemisphere} calendar</small><button className="herb-icon-button" type="button" onClick={() => onDelete(zone.id)} aria-label={`Delete ${zone.name}`}><Trash2 size={16} /></button></div></article>
  )
}

function WatchesView({ user, location, locating, presetHerb, onLocate, onAuth, onToast }) {
  const zones = useHerbWatchZones(Boolean(user))
  const create = useCreateHerbWatchZone()
  const update = useUpdateHerbWatchZone()
  const remove = useDeleteHerbWatchZone()
  async function add(payload) { try { await create.mutateAsync(payload); onToast('Herb watch zone saved.') } catch (error) { onToast(getApiError(error, 'The watch zone could not be saved.')) } }
  return (
    <main className="herbal-main watches-main"><section className="atlas-heading"><div><p className="herb-kicker">Season × weather × chosen tradition</p><h1>Watch zones</h1></div><p>A watch opens only when every signal you chose aligns. Daily email checks stay quiet when nothing has changed.</p></section>
      {!user && <GuestGate title="Let the season come to you" copy="An account keeps watch zones private and carries them between devices. The plant atlas remains public." onAuth={onAuth} />}
      {user && <div className="watch-workspace"><WatchForm key={`${presetHerb?.slug ?? 'default'}:${location?.latitude ?? 'none'}`} location={location} presetHerb={presetHerb} onLocate={onLocate} locating={locating} onSubmit={add} busy={create.isPending} /><section className="watch-list"><div className="watch-list-heading"><h2>Your active ground</h2><span>{zones.data?.filter(zone => zone.enabled).length ?? 0} watching</span></div>{zones.isLoading && <p className="herb-empty">Reading your watch zones...</p>}{zones.data?.map(zone => <WatchCard key={zone.id} zone={zone} onToggle={(id, enabled) => update.mutate({ id, enabled })} onDelete={id => remove.mutate(id)} />)}{!zones.isLoading && !zones.data?.length && <p className="herb-empty">Your first watch zone will appear here.</p>}</section></div>}
    </main>
  )
}

function InventoryForm({ presetHerb, onSubmit, busy }) {
  const [form, setForm] = useState({ herb_slug: presetHerb?.slug ?? herbProfiles[0].slug, quantity: 1, unit: 'bunch', gathered_on: new Date().toISOString().slice(0, 10), location_name: '', preparation: 'Fresh', notes: '' })
  async function submit(event) { event.preventDefault(); await onSubmit({ ...form, quantity: Number(form.quantity), location_name: form.location_name || null, preparation: form.preparation || null, notes: form.notes || null }); setForm(current => ({ ...current, quantity: 1, notes: '' })) }
  return <form className="pantry-form" onSubmit={submit}><div><p className="herb-kicker">Gathered inventory</p><h2>Add to the shelf</h2></div><label>Plant<select value={form.herb_slug} onChange={event => setForm({ ...form, herb_slug: event.target.value })}>{herbProfiles.map(herb => <option value={herb.slug} key={herb.slug}>{herb.name}</option>)}</select></label><div className="herb-paired-fields"><label>Amount<input type="number" min="0.1" step="0.1" required value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} /></label><label>Unit<select value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })}>{['g', 'oz', 'bunch', 'jar', 'portion'].map(value => <option key={value}>{value}</option>)}</select></label></div><label>Gathered on<input type="date" required value={form.gathered_on} onChange={event => setForm({ ...form, gathered_on: event.target.value })} /></label><div className="herb-paired-fields"><label>Place<input maxLength="160" placeholder="Private label" value={form.location_name} onChange={event => setForm({ ...form, location_name: event.target.value })} /></label><label>Preparation<input maxLength="80" placeholder="Fresh, dried..." value={form.preparation} onChange={event => setForm({ ...form, preparation: event.target.value })} /></label></div><label>Field notes<textarea rows="3" maxLength="1000" placeholder="Record plant condition, growing conditions and preparation notes." value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label><button className="herb-solid-button" disabled={busy}><ListPlus size={17} /> {busy ? 'Adding...' : 'Add gathering'}</button></form>
}

function WishlistForm({ presetHerb, onSubmit, busy }) {
  const [form, setForm] = useState({ herb_slug: presetHerb?.slug ?? herbProfiles[0].slug, intention: herbIntents[0], priority: 'season' })
  return <form className="wishlist-form" onSubmit={event => { event.preventDefault(); onSubmit(form) }}><div><p className="herb-kicker">Wish list</p><h2>Something to seek</h2></div><label>Plant<select value={form.herb_slug} onChange={event => setForm({ ...form, herb_slug: event.target.value })}>{herbProfiles.map(herb => <option value={herb.slug} key={herb.slug}>{herb.name}</option>)}</select></label><label>Intention<select value={form.intention} onChange={event => setForm({ ...form, intention: event.target.value })}>{herbIntents.map(value => <option key={value}>{value}</option>)}</select></label><label>When<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}><option value="next">Seek next</option><option value="season">This season</option><option value="someday">Someday</option></select></label><button className="herb-outline-button" disabled={busy}><Heart size={17} /> Add to wish list</button></form>
}

function PantryView({ user, presetHerb, onAuth, onToast }) {
  const inventory = useHerbInventory(Boolean(user)); const wishlist = useHerbWishlist(Boolean(user))
  const createInventory = useCreateHerbInventory(); const updateInventory = useUpdateHerbInventory(); const deleteInventory = useDeleteHerbInventory(); const createWish = useCreateHerbWishlist(); const deleteWish = useDeleteHerbWishlist()
  async function addInventory(payload) { try { await createInventory.mutateAsync(payload); onToast('Gathering added to your pantry.') } catch (error) { onToast(getApiError(error, 'The gathering could not be saved.')) } }
  async function addWish(payload) { try { await createWish.mutateAsync(payload); onToast('Wish list updated.') } catch (error) { onToast(getApiError(error, 'The wish could not be saved.')) } }
  return <main className="herbal-main pantry-main"><section className="atlas-heading"><div><p className="herb-kicker">Private seasonal memory</p><h1>Pantry and wish list</h1></div><p>Keep amounts, dates, preparations, and future interests together. These records are private to your field account.</p></section>{!user && <GuestGate title="Remember what the season gave" copy="Create an account to keep a private gathered inventory and wish list. Nothing here is published to the community map." onAuth={onAuth} />}{user && <><div className="pantry-forms"><InventoryForm key={`inventory:${presetHerb?.slug ?? 'default'}`} presetHerb={presetHerb} onSubmit={addInventory} busy={createInventory.isPending} /><WishlistForm key={`wish:${presetHerb?.slug ?? 'default'}`} presetHerb={presetHerb} onSubmit={addWish} busy={createWish.isPending} /></div><div className="pantry-ledgers"><section><div className="pantry-ledger-heading"><h2>On the shelf</h2><span>{inventory.data?.length ?? 0} entries</span></div>{inventory.data?.map(item => { const step = item.unit === 'g' ? 10 : 1; return <article className="inventory-row" key={item.id}><span className="inventory-plant"><Leaf size={18} /></span><div><h3>{item.herb_name}</h3><p>{dateLabel(item.gathered_on)}{item.location_name ? ` · ${item.location_name}` : ''}</p><small>{item.preparation}{item.notes ? ` · ${item.notes}` : ''}</small></div><div className="inventory-stepper"><button type="button" disabled={item.quantity <= step} onClick={() => updateInventory.mutate({ id: item.id, quantity: Math.max(step, item.quantity - step) })} aria-label={`Reduce ${item.herb_name}`}><Minus size={15} /></button><strong>{item.quantity} {item.unit}</strong><button type="button" onClick={() => updateInventory.mutate({ id: item.id, quantity: item.quantity + step })} aria-label={`Increase ${item.herb_name}`}><Plus size={15} /></button></div><button className="herb-icon-button" type="button" onClick={() => deleteInventory.mutate(item.id)} aria-label={`Delete ${item.herb_name}`}><Trash2 size={16} /></button></article>})}{!inventory.isLoading && !inventory.data?.length && <p className="herb-empty">No gathered material recorded yet.</p>}</section><section><div className="pantry-ledger-heading"><h2>What you hope to meet</h2><span>{wishlist.data?.length ?? 0} wishes</span></div>{wishlist.data?.map(item => <article className="wish-row" key={item.id}><Heart size={18} /><div><h3>{item.herb_name}</h3><p>{item.intention || 'No intention noted'}</p></div><span>{item.priority}</span><button className="herb-icon-button" type="button" onClick={() => deleteWish.mutate(item.id)} aria-label={`Remove ${item.herb_name}`}><Trash2 size={16} /></button></article>)}{!wishlist.isLoading && !wishlist.data?.length && <p className="herb-empty">Your wish list is open.</p>}</section></div></>}</main>
}

function HerbalFooter() {
  return <footer className="herbal-footer"><div><Leaf size={18} /><span><strong>The Verdant Hours</strong><small>Notice what is here. Gather with care.</small></span></div><p>Never consume a wild plant unless identity is certain. Check permissions, contamination, allergies, pregnancy cautions, and medication interactions with qualified local sources and a health professional.</p><div><a href="/herbs/atlas">Global herb atlas</a><a href="/herbs/fieldcraft">Field skills & sources</a><a href="/learn/foraging/wild-herb-gathering">Start herb gathering</a><a href="https://www.poison.org/articles/plant" target="_blank" rel="noreferrer">Poison Control plant safety</a><a href="https://www.fda.gov/consumers/consumer-updates/fda-101-dietary-supplements" target="_blank" rel="noreferrer">FDA herbal safety</a></div></footer>
}

export default function HerbalApp() {
  const shellRef = useRef(null)
  const [view, setView] = useState(currentView)
  const [forest, setForest] = useState(() => typeof window === 'undefined' || new URLSearchParams(window.location.search).get('design') !== 'classic')
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [selected, setSelected] = useState(null)
  const [presetHerb, setPresetHerb] = useState(() => typeof window === 'undefined' ? null : herbsBySlug[new URLSearchParams(window.location.search).get('plant')] ?? null)
  const [authMode, setAuthMode] = useState(null)
  const [toast, setToast] = useState('')
  const moon = useMemo(() => lunarContext(), [])
  const { data: user = null, isLoading: authLoading } = useCurrentUser()
  const logout = useLogout()
  const almanac = useHerbAlmanac(location)

  useEffect(() => { applyPageMetadata('herbs'); document.body.classList.add('herbal-body'); trackPageView(`/herbs?view=${view}`); return () => document.body.classList.remove('herbal-body') }, [view])
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3600); return () => window.clearTimeout(timer) }, [toast])
  useEffect(() => { const restoreView = () => { setView(currentView()); setForest(new URLSearchParams(window.location.search).get('design') !== 'classic'); setSelected(null) }; window.addEventListener('popstate', restoreView); return () => window.removeEventListener('popstate', restoreView) }, [])
  useEffect(() => { shellRef.current?.scrollTo({ top: 0, behavior: 'instant' }) }, [view])

  function navigate(next) { if (next === 'plants' && forest) { window.location.assign('/herbs/atlas'); return } const params = new URLSearchParams(); if (!forest) params.set('design', 'classic'); if (next !== 'today') params.set('view', next); const url = `/herbs${params.size ? `?${params}` : ''}`; window.history.pushState({}, '', url); setView(next); setSelected(null) }
  function locate() { if (!navigator.geolocation) { setToast('Location is unavailable in this browser.'); return } setLocating(true); navigator.geolocation.getCurrentPosition(position => { setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocating(false) }, () => { setToast('Location permission was not granted. You can enter coordinates in a watch zone.'); setLocating(false) }, { enableHighAccuracy: false, timeout: 10000 }) }
  function watchPlant(herb) { setPresetHerb(herb); setSelected(null); navigate('watches') }
  function wishForPlant(herb) { setPresetHerb(herb); setSelected(null); navigate('pantry') }
  async function signOut() { await logout.mutateAsync(); setToast('Signed out. The herbal atlas remains open.') }

  useEffect(() => { if (view === 'plants' && forest) window.location.replace('/herbs/atlas') }, [view, forest])

  const Today = forest ? ForestTodayView : TodayView
  return <div className={`herbal-shell${forest ? ' herbal-shell--forest' : ''}`} data-view={view} ref={shellRef}><HerbalHeader view={view} forest={forest} user={user} authLoading={authLoading} onNavigate={navigate} onAuth={setAuthMode} onLogout={signOut} />
    {view === 'today' && <Today almanac={almanac.data} location={location} locating={locating} moon={moon} onLocate={locate} onOpenPlant={herb => { if (forest) { window.location.assign(`/herbs/atlas/${herb.slug}`); return } setSelected(herb); navigate('plants'); setSelected(herb) }} onNavigate={navigate} />}
    {view === 'plants' && <PlantsView hemisphere={almanac.data?.hemisphere ?? 'north'} selected={selected} onSelect={setSelected} onClose={() => setSelected(null)} onWatch={watchPlant} onWish={wishForPlant} />}
    {view === 'watches' && <WatchesView user={user} location={location} locating={locating} presetHerb={presetHerb} onLocate={locate} onAuth={setAuthMode} onToast={setToast} />}
    {view === 'pantry' && <PantryView user={user} presetHerb={presetHerb} onAuth={setAuthMode} onToast={setToast} />}
    <HerbalFooter />
    {authMode && <AuthDialog context="herbs" mode={authMode} onClose={() => setAuthMode(null)} onAuthenticated={() => { setAuthMode(null); setToast('Your field account is ready.') }} />}
    {toast && <div className="herb-toast" role="status"><Check size={17} />{toast}</div>}
  </div>
}
