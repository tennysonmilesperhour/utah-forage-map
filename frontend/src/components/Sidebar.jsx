import { useEffect, useState } from 'react'
import { Globe2, MapPin, RotateCcw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { HABITAT_TYPES, habitatLabel } from '../lib/habitats'
import { useUnitSystem } from '../hooks/useUnits'
import { displayToFeet, elevationLabel, feetToDisplay } from '../lib/units'

const SOURCES = ['community', 'iNaturalist', 'GBIF', 'field desk']

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const PLACE_DEBOUNCE_MS = 400

function ElevationInput({ label, valueFt, unitSystem, onChangeFt }) {
  const asText = feet => {
    const converted = feetToDisplay(feet, unitSystem)
    return converted == null ? '' : String(Math.round(converted))
  }
  const [text, setText] = useState(() => asText(valueFt))
  const [synced, setSynced] = useState({ valueFt, unitSystem })

  // Adjust during render rather than in an effect: the field follows the filter when it is
  // cleared or the units change, but keeps what the reader is part-way through typing.
  if (synced.valueFt !== valueFt || synced.unitSystem !== unitSystem) {
    setSynced({ valueFt, unitSystem })
    const next = asText(valueFt)
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
          onChangeFt(displayToFeet(event.target.value, unitSystem))
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
  const { system: unitSystem, setSystem } = useUnitSystem()
  const [placeText, setPlaceText] = useState(filters.place ?? '')

  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  useEffect(() => {
    setPlaceText(filters.place ?? '')
  }, [filters.place])

  useEffect(() => {
    const term = placeText.trim()
    if (term === (filters.place ?? '')) return undefined
    const timer = window.setTimeout(() => set('place', term || undefined), PLACE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
    // `set` closes over the current filters, which the dependency below already tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeText, filters])

  return (
    <aside className={`filter-panel filter-panel-${variant}`} aria-label="Map filters">
      <div className="panel-heading">
        <div>
          <div className="panel-title-row">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <h2>Explore worldwide</h2>
          </div>
          <p>{loading ? 'Loading observations...' : `${sightingCount ?? 0} public observations in view`}</p>
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
          <p className="field-help">Matches the recorded locality, for example Chile or Bavaria.</p>
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
          <p className="field-help">Fruiting seasons are about six months apart between hemispheres.</p>
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
              valueFt={filters.elev_min}
              unitSystem={unitSystem}
              onChangeFt={value => set('elev_min', value)}
            />
            <ElevationInput
              label="Maximum"
              valueFt={filters.elev_max}
              unitSystem={unitSystem}
              onChangeFt={value => set('elev_max', value)}
            />
          </div>
          <p className="field-help">{elevationLabel(unitSystem) === 'm' ? 'Metres' : 'Feet'} above sea level</p>
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
              <option key={habitat} value={habitat}>{habitatLabel(habitat)}</option>
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
          <p><strong>Map data is a starting point.</strong> Edibility varies by region and look-alikes differ by continent. Never eat a mushroom based on a pin or photo alone.</p>
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

      <p className="filter-scope-note">
        <Globe2 size={15} aria-hidden="true" /> Observations load for the part of the world you are viewing.
      </p>
    </aside>
  )
}
