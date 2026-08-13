import { useState } from 'react'
import { LoaderCircle, Search, X } from 'lucide-react'

export default function PlaceSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function search(event) {
    event.preventDefault()
    const value = query.trim()
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!value || !token) return

    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        q: value,
        access_token: token,
        limit: '5',
        language: navigator.language.split('-')[0] || 'en',
      })
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`)
      if (!response.ok) throw new Error('Search failed')
      const payload = await response.json()
      setResults(payload.features ?? [])
      if (!(payload.features ?? []).length) setError('No places found')
    } catch {
      setResults([])
      setError('Place search is unavailable')
    } finally {
      setLoading(false)
    }
  }

  function choose(feature) {
    const coordinates = feature.geometry?.coordinates
    if (!coordinates) return
    onSelect({
      center: coordinates,
      bbox: feature.properties?.bbox ?? feature.bbox,
      key: feature.id,
    })
    setQuery(feature.properties?.full_address ?? feature.properties?.name ?? feature.place_name ?? query)
    setResults([])
    setError('')
  }

  function clear() {
    setQuery('')
    setResults([])
    setError('')
  }

  return (
    <div className="place-search">
      <form onSubmit={search} role="search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Find a city, region, or country"
          aria-label="Find a place"
        />
        {query && !loading && (
          <button type="button" onClick={clear} aria-label="Clear place search">
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <button type="submit" aria-label="Search for place" disabled={!query.trim() || loading}>
          {loading ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
        </button>
      </form>
      {(results.length > 0 || error) && (
        <div className="place-results" role="listbox">
          {error && <p>{error}</p>}
          {results.map(feature => (
            <button key={feature.id} type="button" role="option" aria-selected="false" onClick={() => choose(feature)}>
              <strong>{feature.properties?.name ?? feature.text}</strong>
              <span>{feature.properties?.full_address ?? feature.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
