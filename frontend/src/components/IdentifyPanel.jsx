import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Crosshair, LoaderCircle, MapPinned, ShieldAlert, Sparkles, X } from 'lucide-react'
import { fieldMarks, markGroups } from '../data/fieldMarks'
import { hemisphereFor, occurrenceSummary } from '../data/occurrence'
import { loadNearbyEvidence, rankSuggestions } from '../lib/identify'
import { MONTH_NAMES } from '../lib/occurrenceGrid'

const EDIBILITY_LABELS = { choice: 'Choice edible', edible: 'Edible-listed', caution: 'Edible with caution', inedible: 'Not a food mushroom', poisonous: 'Poisonous', deadly: 'Deadly' }
const HERB_LABELS = { culinary: 'Culinary reference', caution: 'Extra care needed', study: 'Study first', toxic: 'Toxic' }

// Each map loads only its own catalogue.
async function candidatesFor(collection) {
  if (collection === 'herbs') {
    const { herbGuides, herbGuideBySlug } = await import('../data/herbGuide')
    return herbGuides.map(plant => ({
      slug: plant.slug, name: plant.name, latin: plant.latin, image: plant.photos[0]?.url,
      danger: plant.status === 'toxic', label: HERB_LABELS[plant.status], guideHref: `/herbs/atlas/${plant.slug}`,
      dangerousLookalikes: plant.lookalikes.filter(item => item.slug && herbGuideBySlug[item.slug]?.status === 'toxic').map(item => item.name),
    }))
  }
  const { speciesIndex } = await import('../content/species-index.generated')
  return speciesIndex.map(species => ({
    slug: species.slug, name: species.common_name, latin: species.latin_name,
    image: species.image.replace(/\/large\.(jpe?g|png)$/i, '/small.$1'),
    danger: ['poisonous', 'deadly'].includes(species.edibility), label: EDIBILITY_LABELS[species.edibility], guideHref: `/learn/species/${species.slug}`,
    dangerousLookalikes: species.lookalikes.filter(item => item.severity === 'deadly').map(item => item.name),
  }))
}

function formatCoordinate(value, positive, negative) {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`
}

export default function IdentifyPanel({ collection, location, onClose, onShowOnMap, className = '' }) {
  const [selected, setSelected] = useState({})
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [ownLocation, setOwnLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const place = ownLocation ?? location
  const latitude = place ? Number(place.latitude.toFixed(1)) : null
  const longitude = place ? Number(place.longitude.toFixed(1)) : null
  const hemisphere = hemisphereFor(latitude)
  const catalogue = useQuery({ queryKey: ['id-candidates', collection], queryFn: () => candidatesFor(collection), staleTime: Infinity })
  const candidates = catalogue.data ?? []
  const evidence = useQuery({
    queryKey: ['id-evidence', collection, latitude, longitude],
    enabled: latitude !== null,
    queryFn: ({ signal }) => loadNearbyEvidence(collection, latitude, longitude, { signal }),
    staleTime: Infinity,
    retry: 1,
  })
  const suggestions = rankSuggestions({
    candidates, traits: fieldMarks[collection], selected, evidence: evidence.data, month, hemisphere, summaries: occurrenceSummary[collection],
  })
  const groups = markGroups[collection]
  const localCount = evidence.data ? new Set([...evidence.data.seen.keys(), ...evidence.data.expected]).size : 0

  function choose(key, value) {
    setSelected(current => ({ ...current, [key]: current[key] === value ? undefined : value }))
  }

  function locateMe() {
    if (!navigator.geolocation) { setLocationError('Location is not available in this browser.'); return }
    setLocating(true); setLocationError('')
    navigator.geolocation.getCurrentPosition(
      position => { setOwnLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocating(false) },
      () => { setLocationError('Location was not shared. The map centre is used instead.'); setLocating(false) },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }

  return (
    <section className={`identify-panel ${collection} ${className}`} aria-labelledby="identify-title">
      <header className="identify-heading">
        <div>
          <p><Sparkles size={14} aria-hidden="true" />Suggest an ID</p>
          <h2 id="identify-title">What did you find?</h2>
          <span>Choose what you can see. Suggestions are ranked by your field marks, by who has recorded each {collection === 'herbs' ? 'plant' : 'species'} near you, and by where it is known to grow.</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close ID suggestions"><X size={17} /></button>
      </header>

      <div className="identify-where">
        <div>
          <strong>{place ? `${formatCoordinate(place.latitude, 'N', 'S')}, ${formatCoordinate(place.longitude, 'E', 'W')}` : 'Move the map to your area'}</strong>
          <small>{ownLocation ? 'Your location, rounded to about 10 km' : 'Map centre'}{evidence.data ? ` · ${localCount} catalogue ${collection === 'herbs' ? 'plants' : 'species'} recorded or expected nearby` : ''}</small>
        </div>
        <button type="button" onClick={ownLocation ? () => setOwnLocation(null) : locateMe} disabled={locating}>{locating ? <LoaderCircle className="spin" size={14} /> : <Crosshair size={14} />}{ownLocation ? 'Use map centre' : 'Use my location'}</button>
        {locationError && <p role="status">{locationError}</p>}
      </div>

      <label className="identify-month">When<select value={month} onChange={event => setMonth(Number(event.target.value))}>{MONTH_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>

      {groups.map(group => (
        <fieldset className="identify-group" key={group.key}>
          <legend>{group.label}</legend>
          <div>
            {group.options.map(([value, label]) => (
              <button type="button" key={value} aria-pressed={selected[group.key] === value} className={selected[group.key] === value ? 'active' : ''} onClick={() => choose(group.key, value)}>
                {group.key === 'colors' || group.key === 'flowers' ? <i className={`swatch ${value}`} aria-hidden="true" /> : null}{label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="identify-results" aria-live="polite">
        <h3>{evidence.isFetching || catalogue.isLoading ? 'Checking what grows nearby…' : `Top suggestions${Object.values(selected).some(Boolean) ? '' : ' for this place and month'}`}</h3>
        {evidence.isError && <p className="identify-note">Nearby records could not load, so suggestions use field marks and season only.</p>}
        {suggestions.length === 0 && !evidence.isFetching && !catalogue.isLoading && <p className="identify-note">No catalogue {collection === 'herbs' ? 'plant' : 'species'} matches those marks here. The catalogue is a small part of what grows; try fewer marks.</p>}
        <ol>
          {suggestions.map(item => (
            <li key={item.slug} className={item.danger ? 'danger' : ''}>
              {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="identify-thumb" />}
              <div>
                <strong>{item.name}</strong>
                <em>{item.latin}</em>
                <span className={`identify-status ${item.danger ? 'danger' : ''}`}>{item.danger && <ShieldAlert size={12} aria-hidden="true" />}{item.label}</span>
                <div className="identify-badges">
                  {item.marks.chosen > 0 && <span>Matches {item.marks.matched.length} of {item.marks.chosen} {item.marks.chosen === 1 ? 'mark' : 'marks'}</span>}
                  {item.seenPeople > 0 && <span className="seen">Seen nearby · {item.seenPeople.toLocaleString()} {item.seenPeople === 1 ? 'person' : 'people'}</span>}
                  {item.expected && <span className="expected">Expected nearby</span>}
                  {item.inSeason && <span>Records in {MONTH_NAMES[month]}</span>}
                </div>
                {item.dangerousLookalikes.length > 0 && <p className="identify-warning"><ShieldAlert size={13} aria-hidden="true" />Rule out: {item.dangerousLookalikes.join(', ')}</p>}
                <div className="identify-actions">
                  <button type="button" onClick={() => onShowOnMap(item.slug)}><MapPinned size={14} />Where it grows</button>
                  <a href={item.guideHref}><BookOpen size={14} />Field marks</a>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="identify-note">A suggestion is a place to start comparing, never an identification. {collection === 'herbs' ? 'Confirm every plant with a regional flora and a knowledgeable local person.' : 'Never eat a mushroom based on this list; confirm with a qualified local expert.'}</p>
      </div>
    </section>
  )
}
