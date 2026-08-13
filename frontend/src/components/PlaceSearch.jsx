import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'

const GEOCODER_URL = 'https://api.mapbox.com/search/geocode/v6/forward'
const DEBOUNCE_MS = 300

// A worldwide map needs a way to get somewhere specific without endless panning.
export default function PlaceSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const listId = useId()

  useEffect(() => {
    const term = query.trim()
    if (term.length < 3) {
      setResults([])
      setSearching(false)
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const url = `${GEOCODER_URL}?q=${encodeURIComponent(term)}&limit=5&access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error('Place search failed')
        const data = await response.json()
        setResults((data.features ?? []).map(feature => ({
          id: feature.id ?? feature.properties?.mapbox_id,
          name: feature.properties?.name ?? feature.properties?.full_address ?? term,
          context: feature.properties?.place_formatted ?? '',
          center: feature.geometry?.coordinates,
          bbox: feature.properties?.bbox,
        })).filter(place => Array.isArray(place.center)))
        setOpen(true)
      } catch (error) {
        if (error.name !== 'AbortError') setResults([])
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    function onPointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function choose(place) {
    onSelect?.(place)
    setOpen(false)
    setQuery(place.name)
  }

  function clear() {
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="place-search" ref={wrapRef}>
      <div className="place-search-field">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="Search anywhere in the world"
          aria-label="Search for a place"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          autoComplete="off"
          onChange={event => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={event => {
            if (event.key === 'Escape') clear()
            if (event.key === 'Enter') {
              event.preventDefault()
              if (results[0]) choose(results[0])
            }
          }}
        />
        {searching && <Loader2 size={16} className="place-search-spinner" aria-hidden="true" />}
        {!searching && query && (
          <button type="button" onClick={clear} aria-label="Clear place search">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="place-search-results" id={listId} role="listbox" aria-label="Place results">
          {results.map(place => (
            <li key={place.id ?? `${place.center[0]},${place.center[1]}`} role="option" aria-selected="false">
              <button type="button" onClick={() => choose(place)}>
                <strong>{place.name}</strong>
                {place.context && <span>{place.context}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
