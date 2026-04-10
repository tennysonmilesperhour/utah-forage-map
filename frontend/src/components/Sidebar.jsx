const HABITAT_TYPES = [
  'forest', 'meadow', 'riparian', 'alpine', 'desert', 'scrubland', 'wetland',
]

const SOURCES = ['community', 'iNaturalist', 'GBIF']

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function Sidebar({ filters, onChange, sightingCount, loading }) {
  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Utah Forage Map</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? 'Loading…' : `${sightingCount ?? 0} sightings`}
        </p>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Month range */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
            Month range
          </label>
          <div className="flex gap-2">
            <select
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5"
              value={filters.month_min ?? ''}
              onChange={e => set('month_min', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Any</option>
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <span className="self-center text-gray-400 text-sm">–</span>
            <select
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5"
              value={filters.month_max ?? ''}
              onChange={e => set('month_max', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Any</option>
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Elevation */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
            Elevation (ft)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 w-0"
              value={filters.elev_min ?? ''}
              onChange={e => set('elev_min', e.target.value ? Number(e.target.value) : undefined)}
            />
            <span className="self-center text-gray-400 text-sm">–</span>
            <input
              type="number"
              placeholder="Max"
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 w-0"
              value={filters.elev_max ?? ''}
              onChange={e => set('elev_max', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Habitat */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
            Habitat type
          </label>
          <select
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            value={filters.habitat_type ?? ''}
            onChange={e => set('habitat_type', e.target.value || undefined)}
          >
            <option value="">All habitats</option>
            {HABITAT_TYPES.map(h => (
              <option key={h} value={h}>{h.charAt(0).toUpperCase() + h.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Source */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
            Source
          </label>
          <select
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            value={filters.source ?? ''}
            onChange={e => set('source', e.target.value || undefined)}
          >
            <option value="">All sources</option>
            {SOURCES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Verified only */}
        <div className="flex items-center gap-2">
          <input
            id="verified-only"
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-green-600"
            checked={!!filters.verified_only}
            onChange={e => set('verified_only', e.target.checked || undefined)}
          />
          <label htmlFor="verified-only" className="text-sm text-gray-700">
            Verified sightings only
          </label>
        </div>
      </div>

      {/* Reset */}
      <div className="p-4 border-t border-gray-200">
        <button
          className="w-full text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
          onClick={() => onChange({})}
        >
          Reset filters
        </button>
      </div>
    </aside>
  )
}
