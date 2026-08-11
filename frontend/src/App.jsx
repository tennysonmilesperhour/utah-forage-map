import { useState } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import { useCommunityPortal, useCreateSighting, useSightings, useSpecies } from './hooks/useSightings'

const NAV_ITEMS = ['Maps', 'Finds', 'Events', 'Clubs', 'Guides', 'Safety']

const FIND_TONES = [
  'bg-emerald-100 text-emerald-900',
  'bg-sky-100 text-sky-900',
  'bg-violet-100 text-violet-900',
  'bg-amber-100 text-amber-900',
]

function formatEventDate(value) {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function App() {
  const [filters, setFilters] = useState({})
  const [selected, setSelected] = useState(null)
  const [draftLocation, setDraftLocation] = useState(null)

  const { data: sightings = [], isLoading } = useSightings(filters)
  const { data: species = [] } = useSpecies()
  const { data: portal = {}, isLoading: portalLoading } = useCommunityPortal()
  const createSighting = useCreateSighting()
  const verifiedCount = sightings.filter(item => item.verified).length
  const sources = new Set(sightings.map(item => item.source)).size
  const finds = portal.finds ?? []
  const events = portal.events ?? []
  const clubs = portal.clubs ?? []
  const resources = portal.resources ?? []

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-stone-50 text-stone-950">
      <header className="h-14 shrink-0 border-b border-stone-200 bg-white">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded bg-green-800 text-sm font-semibold text-white">
              UF
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Utah Forage Map</h1>
              <p className="text-xs text-stone-500">Verified sightings, seasons, and community field notes</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map(item => (
              <button key={item} className="rounded px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-950">
                {item}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button className="hidden rounded border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 sm:inline-flex">
              Logbook
            </button>
            <button
              className="rounded bg-green-800 px-3 py-2 text-sm font-medium text-white hover:bg-green-900"
              onClick={() => setDraftLocation(draftLocation ?? { latitude: 39.32, longitude: -111.09 })}
            >
              Submit find
            </button>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)] overflow-hidden xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <Sidebar
          filters={filters}
          onChange={setFilters}
          sightingCount={sightings.length}
          loading={isLoading}
          species={species}
          draftLocation={draftLocation}
          onDraftLocationChange={setDraftLocation}
          onCreateSighting={(payload) => createSighting.mutateAsync(payload)}
          creating={createSighting.isPending}
        />
        <section className="relative min-h-0">
          <MapView
            sightings={sightings}
            onSightingClick={setSelected}
            draftLocation={draftLocation}
            onMapClick={setDraftLocation}
          />
          <div className="pointer-events-none absolute left-4 top-4 z-10 grid max-w-xl gap-2 sm:grid-cols-3">
            <div className="rounded border border-stone-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
              <p className="text-xs font-medium uppercase text-stone-500">Approved pins</p>
              <p className="text-lg font-semibold text-stone-950">{sightings.length.toLocaleString()}</p>
            </div>
            <div className="rounded border border-stone-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
              <p className="text-xs font-medium uppercase text-stone-500">Verified</p>
              <p className="text-lg font-semibold text-stone-950">{verifiedCount.toLocaleString()}</p>
            </div>
            <div className="rounded border border-stone-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
              <p className="text-xs font-medium uppercase text-stone-500">Data sources</p>
              <p className="text-lg font-semibold text-stone-950">{sources.toLocaleString()}</p>
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-stone-200 bg-white xl:block">
          <div className="border-b border-stone-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Community</p>
            <h2 className="mt-1 text-lg font-semibold text-stone-950">Finds, events, and field help</h2>
            <p className="mt-1 text-sm text-stone-500">
              {portalLoading
                ? 'Loading community activity...'
                : 'Browse local activity, learn what is in season, and check safety notes before heading out.'}
            </p>
          </div>

          <section className="border-b border-stone-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-950">Popular finds</h3>
              <button className="text-xs font-medium text-green-800 hover:text-green-950">View all</button>
            </div>
            <div className="space-y-2">
              {finds.map((item, index) => (
                <button key={item.title} className="flex w-full items-center gap-3 rounded border border-stone-200 p-2 text-left hover:bg-stone-50">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded text-xs font-semibold ${FIND_TONES[index % FIND_TONES.length]}`}>
                    ID
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-stone-900">{item.title}</span>
                    <span className="block text-xs text-stone-500">
                      {item.region}{item.reviewed ? ' - reviewed' : ' - pending review'}
                    </span>
                  </span>
                </button>
              ))}
              {!portalLoading && finds.length === 0 && (
                <p className="rounded border border-stone-200 p-3 text-sm text-stone-500">No community finds published yet.</p>
              )}
            </div>
          </section>

          <section className="border-b border-stone-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-950">Upcoming events</h3>
              <button className="text-xs font-medium text-green-800 hover:text-green-950">Submit</button>
            </div>
            <div className="space-y-3">
              {events.map(event => (
                <div key={event.title} className="grid grid-cols-[3.5rem_1fr] gap-3">
                  <div className="rounded border border-stone-200 bg-stone-50 px-2 py-1 text-center text-xs font-semibold text-stone-700">
                    {formatEventDate(event.starts_on)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-900">{event.title}</p>
                    <p className="text-xs text-stone-500">{event.location_name}</p>
                  </div>
                </div>
              ))}
              {!portalLoading && events.length === 0 && (
                <p className="rounded border border-stone-200 p-3 text-sm text-stone-500">No events published yet.</p>
              )}
            </div>
          </section>

          <section className="border-b border-stone-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-950">Local clubs</h3>
              <button className="text-xs font-medium text-green-800 hover:text-green-950">Add club</button>
            </div>
            <div className="space-y-2">
              {clubs.map(club => (
                <button key={club.name} className="w-full rounded border border-stone-200 px-3 py-2 text-left hover:bg-stone-50">
                  <span className="block text-sm font-medium text-stone-900">{club.name}</span>
                  <span className="block text-xs text-stone-500">{club.region} - {club.meeting_cadence}</span>
                </button>
              ))}
              {!portalLoading && clubs.length === 0 && (
                <p className="rounded border border-stone-200 p-3 text-sm text-stone-500">No clubs published yet.</p>
              )}
            </div>
          </section>

          <section className="border-b border-stone-200 p-4">
            <h3 className="text-sm font-semibold text-stone-950">Resources & guides</h3>
            <div className="mt-3 space-y-2">
              {resources.map(item => (
                <button key={item.title} className="w-full rounded border border-stone-200 px-3 py-2 text-left hover:bg-stone-50">
                  <span className="block text-sm font-medium text-stone-800">{item.title}</span>
                  <span className="block text-xs text-stone-500">{item.category}</span>
                </button>
              ))}
              {!portalLoading && resources.length === 0 && (
                <p className="rounded border border-stone-200 p-3 text-sm text-stone-500">No resources published yet.</p>
              )}
            </div>
          </section>

          <section className="p-4">
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-sm font-semibold text-amber-950">Field safety</h3>
              <p className="mt-1 text-sm text-amber-900">
                Never eat a mushroom from map data alone. Verify every find with multiple field marks, current land rules, and an expert when uncertain.
              </p>
            </div>
          </section>
        </aside>
      </main>

      {selected && (
        <div className="absolute bottom-6 left-80 z-20 max-w-sm rounded border border-stone-200 bg-white p-4 shadow-lg">
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
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                <dt>Source</dt>
                <dd className="text-gray-800">{selected.source}</dd>
                <dt>Elevation</dt>
                <dd className="text-gray-800">
                  {selected.elevation_ft ? `${Math.round(selected.elevation_ft).toLocaleString()} ft` : 'Unknown'}
                </dd>
                <dt>Habitat</dt>
                <dd className="text-gray-800">{selected.habitat_type ?? 'Unknown'}</dd>
                <dt>Status</dt>
                <dd className="text-gray-800">{selected.verified ? 'Verified' : 'Unverified'}</dd>
              </dl>
            </div>
            <button
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              onClick={() => setSelected(null)}
            >
              x
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
