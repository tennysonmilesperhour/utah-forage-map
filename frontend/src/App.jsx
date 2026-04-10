import { useState } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { useSightings } from './hooks/useSightings'

export default function App() {
  const [filters, setFilters] = useState({})
  const [selected, setSelected] = useState(null)

  const { data: sightings = [], isLoading } = useSightings(filters)

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        filters={filters}
        onChange={setFilters}
        sightingCount={sightings.length}
        loading={isLoading}
      />
      <MapView
        sightings={sightings}
        onSightingClick={setSelected}
      />

      {selected && (
        <div className="absolute bottom-6 left-80 bg-white rounded-lg shadow-lg p-4 z-10 max-w-xs">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="font-semibold text-gray-900">
                {selected.species?.common_name ?? 'Unknown species'}
              </p>
              {selected.species?.latin_name && (
                <p className="text-sm italic text-gray-500">{selected.species.latin_name}</p>
              )}
              {selected.notes && (
                <p className="text-sm text-gray-700 mt-1">{selected.notes}</p>
              )}
            </div>
            <button
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
