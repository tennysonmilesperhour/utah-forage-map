import { useEffect, useState } from 'react'
import { MapPin, RotateCcw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { useUnitSystem } from '../hooks/useUnits'
import { displayToMetres, metresToDisplay } from '../lib/units'

const HABITAT_TYPES = [
  'forest', 'meadow', 'riparian', 'alpine', 'desert', 'scrubland', 'wetland',
]

const SOURCES = ['community', 'iNaturalist', 'GBIF']

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const PLACE_DEBOUNCE_MS = 400

function ElevationInput({ label, metres, unitSystem, onChangeMetres }) {
  const asText = value => {
    const converted = metresToDisplay(value, unitSystem)
    return converted == null ? '' : String(Math.round(converted))
  }
  const [text, setText] = useState(() => asText(metres))
  const [synced, setSynced] = useState({ metres, unitSystem })

  // Adjusted during render rather than in an effect: the field follows the filter when it is
  // cleared or the units change, but keeps what the reader is part-way through typing.
  if (synced.metres !== metres || synced.unitSystem !== unitSystem) {
    setSynced({ metres, unitSystem })
    const next = asText(metres)
    if (text === '' || Number(text) !== Number(next)) setText(next)
  }

  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        placeholder="Any"
        value={text}
        onChange={event => {
          setText(event.target.value)
          onChangeMetres(displayToMetres(event.target.value, unitSystem))
        }}
      />
    </label>
  )
}

export default function Sidebar({
  filters,
  onChange,
  sightingCount,
  loading,
  species = [],
  variant = 'desktop',
  onClose,
}) {
  const idPrefix = variant === 'mobile' ? 'mobile' : 'desktop'
  const activeFilterCount = Object.values(filters).filter(value => value !== undefined && value !== '').length
  const [placeText, setPlaceText] = useState(filters.place ?? '')
  const { system: unitSystem, setSystem } = useUnitSystem()

  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  // Typing a country should not fire a request per keystroke.
  useEffect(() => {
    const term = placeText.trim()
    if (term === (filters.place ?? '')) return undefined
    const timer = window.setTimeout(() => onChange({ ...filters, place: term || undefined }), PLACE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [placeText, filters, onChange])

  return (
    <aside className={`filter-panel filter-panel-${variant}`} aria-label="Map filters">
      <div className="panel-heading">
        <div>
          <div className="panel-title-row">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <h2>Explore the world</h2>
          </div>
          <p>{loading ? 'Loading observations...' : `${sightingCount ?? 0} public observations on the map`}</p>
        </div>
        {onClose && (
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close filters">
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="filter-scroll">
        <div className="filter-group">
          <label htmlFor={`${idPrefix}-species`}>Species</label>
          <select
            id={`${idPrefix}-species`}
            value={filters.species_id ?? ''}
            onChange={event => set('species_id', event.target.value || undefined)}
          >
            <option value="">All mushrooms</option>
            {species.map(item => (
              <option key={item.id} value={item.id}>{item.common_name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor={`${idPrefix}-place`}>Country or region</label>
          <input
            id={`${idPrefix}-place`}
            type="search"
            placeholder="Any place"
            value={placeText}
            onChange={event => setPlaceText(event.target.value)}
          />
          <p className="field-help">Matches the recorded locality, for example Chile or Bavaria</p>
        </div>

        <div className="filter-group">
          <label htmlFor={`${idPrefix}-recency`}>Observation recency</label>
          <select
            id={`${idPrefix}-recency`}
            value={filters.recent_days ?? ''}
            onChange={event => set('recent_days', event.target.value ? Number(event.target.value) : undefined)}
          >
            <option value="14">Past 14 days</option>
            <option value="30">Past 30 days</option>
            <option value="60">Past 60 days</option>
            <option value="90">Past 90 days</option>
            <option value="">All available dates</option>
          </select>
          <p className="field-help">Found dates, not upload dates</p>
        </div>

        <div className="filter-group">
          <span className="field-label">Season window</span>
          <div className="paired-fields">
            <label>
              <span>From</span>
              <select
                value={filters.month_min ?? ''}
                onChange={event => set('month_min', event.target.value ? Number(event.target.value) : undefined)}
              >
                <option value="">Any month</option>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Through</span>
              <select
                value={filters.month_max ?? ''}
                onChange={event => set('month_max', event.target.value ? Number(event.target.value) : undefined)}
              >
                <option value="">Any month</option>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="filter-group">
          <div className="field-label-row">
            <span className="field-label">Elevation range</span>
            <div className="unit-toggle" role="group" aria-label="Elevation units">
              <button
                type="button"
                className={unitSystem === 'metric' ? 'active' : ''}
                aria-pressed={unitSystem === 'metric'}
                onClick={() => setSystem('metric')}
              >
                m
              </button>
              <button
                type="button"
                className={unitSystem === 'imperial' ? 'active' : ''}
                aria-pressed={unitSystem === 'imperial'}
                onClick={() => setSystem('imperial')}
              >
                ft
              </button>
            </div>
          </div>
          <div className="paired-fields">
            <ElevationInput
              label="Minimum"
              metres={filters.elev_min_m}
              unitSystem={unitSystem}
              onChangeMetres={value => set('elev_min_m', value)}
            />
            <ElevationInput
              label="Maximum"
              metres={filters.elev_max_m}
              unitSystem={unitSystem}
              onChangeMetres={value => set('elev_max_m', value)}
            />
          </div>
          <p className="field-help">{unitSystem === 'imperial' ? 'Feet' : 'Meters'} above sea level</p>
        </div>

        <div className="filter-group">
          <label htmlFor={`${idPrefix}-habitat`}>Habitat</label>
          <select
            id={`${idPrefix}-habitat`}
            value={filters.habitat_type ?? ''}
            onChange={event => set('habitat_type', event.target.value || undefined)}
          >
            <option value="">All habitats</option>
            {HABITAT_TYPES.map(habitat => (
              <option key={habitat} value={habitat}>{habitat.charAt(0).toUpperCase() + habitat.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor={`${idPrefix}-source`}>Observation source</label>
          <select
            id={`${idPrefix}-source`}
            value={filters.source ?? ''}
            onChange={event => set('source', event.target.value || undefined)}
          >
            <option value="">All sources</option>
            {SOURCES.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>

        <label className="check-control" htmlFor={`${idPrefix}-verified-only`}>
          <input
            id={`${idPrefix}-verified-only`}
            type="checkbox"
            checked={Boolean(filters.verified_only)}
            onChange={event => set('verified_only', event.target.checked || undefined)}
          />
          <span>
            <strong>Reviewed locations only</strong>
            <small>Hide observations awaiting community review</small>
          </span>
        </label>

        <div className="safety-note">
          <ShieldCheck size={19} aria-hidden="true" />
          <p><strong>Map data is a starting point.</strong> Never eat a mushroom based on a pin or photo alone.</p>
        </div>
      </div>

      <div className="filter-footer">
        <div>
          <MapPin size={17} aria-hidden="true" />
          <span>{loading ? 'Updating map' : `${sightingCount ?? 0} shown`}</span>
        </div>
        <button type="button" onClick={() => onChange({})} disabled={activeFilterCount === 0}>
          <RotateCcw size={16} aria-hidden="true" /> Clear {activeFilterCount > 0 ? activeFilterCount : ''}
        </button>
      </div>
    </aside>
  )
}
