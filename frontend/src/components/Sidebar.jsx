import { MapPin, RotateCcw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'

const HABITAT_TYPES = [
  'forest', 'meadow', 'riparian', 'alpine', 'desert', 'scrubland', 'wetland',
]

const SOURCES = ['community', 'iNaturalist', 'GBIF']

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

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
  const currentMonth = new Date().getMonth() + 1
  const showingCurrentMonth = filters.month_min === currentMonth && filters.month_max === currentMonth
  const activeFilterCount = Object.values(filters).filter(value => value !== undefined && value !== '').length

  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  function setCurrentMonth(enabled) {
    onChange({
      ...filters,
      month_min: enabled ? currentMonth : undefined,
      month_max: enabled ? currentMonth : undefined,
    })
  }

  return (
    <aside className={`filter-panel filter-panel-${variant}`} aria-label="Map filters">
      <div className="panel-heading">
        <div>
          <div className="panel-title-row">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <h2>Explore Utah</h2>
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

        <label className="check-control" htmlFor={`${idPrefix}-current-month`}>
          <input
            id={`${idPrefix}-current-month`}
            type="checkbox"
            checked={showingCurrentMonth}
            onChange={event => setCurrentMonth(event.target.checked)}
          />
          <span>
            <strong>Observed this month</strong>
            <small>Show reviewed {MONTHS[currentMonth - 1]} records from any year</small>
          </span>
        </label>

        <div className="filter-group">
          <span className="field-label">Elevation range</span>
          <div className="paired-fields">
            <label>
              <span>Minimum</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Any"
                value={filters.elev_min ?? ''}
                onChange={event => set('elev_min', event.target.value ? Number(event.target.value) : undefined)}
              />
            </label>
            <label>
              <span>Maximum</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Any"
                value={filters.elev_max ?? ''}
                onChange={event => set('elev_max', event.target.value ? Number(event.target.value) : undefined)}
              />
            </label>
          </div>
          <p className="field-help">Feet above sea level</p>
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
