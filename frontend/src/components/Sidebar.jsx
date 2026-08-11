import { useState } from 'react'

const HABITAT_TYPES = [
  'forest', 'meadow', 'riparian', 'alpine', 'desert', 'scrubland', 'wetland',
]

const SOURCES = ['community', 'iNaturalist', 'GBIF']

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const EMPTY_FORM = {
  species_id: '',
  found_on: '',
  habitat_type: '',
  elevation_ft: '',
  notes: '',
}

export default function Sidebar({
  filters,
  onChange,
  sightingCount,
  loading,
  species = [],
  draftLocation,
  onDraftLocationChange,
  onCreateSighting,
  creating,
}) {
  const [form, setForm] = useState(EMPTY_FORM)

  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  async function submitSighting(event) {
    event.preventDefault()
    if (!draftLocation || !form.species_id) return

    await onCreateSighting({
      species_id: form.species_id,
      latitude: draftLocation.latitude,
      longitude: draftLocation.longitude,
      found_on: form.found_on || undefined,
      month: form.found_on ? Number(form.found_on.slice(5, 7)) : undefined,
      habitat_type: form.habitat_type || undefined,
      elevation_ft: form.elevation_ft ? Number(form.elevation_ft) : undefined,
      notes: form.notes || undefined,
      source: 'community',
      confidence_score: 50,
    })
    setForm(EMPTY_FORM)
    onDraftLocationChange(null)
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Interactive map</p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">Verified locations</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? 'Loading...' : `${sightingCount ?? 0} sightings and field reports`}
        </p>
      </div>

      <div className="p-4 space-y-5 flex-1">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
            Species or mushroom
          </label>
          <select
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            value={filters.species_id ?? ''}
            onChange={e => set('species_id', e.target.value || undefined)}
          >
            <option value="">All species</option>
            {species.map(item => (
              <option key={item.id} value={item.id}>{item.common_name}</option>
            ))}
          </select>
        </div>

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
            <span className="self-center text-gray-400 text-sm">-</span>
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
            <span className="self-center text-gray-400 text-sm">-</span>
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
            Data source
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
            Reviewed locations only
          </label>
        </div>
      </div>

      <form className="p-4 border-t border-gray-200 space-y-3" onSubmit={submitSighting}>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Submit a find</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {draftLocation
              ? `${draftLocation.latitude.toFixed(4)}, ${draftLocation.longitude.toFixed(4)}`
              : 'Click the map to choose a location'}
          </p>
        </div>
        <select
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
          value={form.species_id}
          onChange={e => setForm({ ...form, species_id: e.target.value })}
          required
        >
          <option value="">Species</option>
          {species.map(item => (
            <option key={item.id} value={item.id}>{item.common_name}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            className="text-sm border border-gray-300 rounded px-2 py-1.5 min-w-0"
            value={form.found_on}
            onChange={e => setForm({ ...form, found_on: e.target.value })}
          />
          <input
            type="number"
            placeholder="Elevation"
            className="text-sm border border-gray-300 rounded px-2 py-1.5 min-w-0"
            value={form.elevation_ft}
            onChange={e => setForm({ ...form, elevation_ft: e.target.value })}
          />
        </div>
        <select
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
          value={form.habitat_type}
          onChange={e => setForm({ ...form, habitat_type: e.target.value })}
        >
          <option value="">Habitat</option>
          {HABITAT_TYPES.map(h => (
            <option key={h} value={h}>{h.charAt(0).toUpperCase() + h.slice(1)}</option>
          ))}
        </select>
        <textarea
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 resize-none"
          rows="2"
          placeholder="Notes"
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
        />
        <button
          className="w-full rounded bg-green-800 px-3 py-2 text-sm font-medium text-white hover:bg-green-900 disabled:bg-gray-300"
          disabled={!draftLocation || !form.species_id || creating}
        >
          {creating ? 'Saving...' : 'Submit for review'}
        </button>
      </form>

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
