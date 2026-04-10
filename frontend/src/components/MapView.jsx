import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Utah center
const UTAH_CENTER = [-111.09, 39.32]
const UTAH_ZOOM = 6

const EDIBILITY_COLORS = {
  edible: '#16a34a',
  choice: '#15803d',
  inedible: '#9ca3af',
  poisonous: '#dc2626',
  deadly: '#7f1d1d',
}

function markerColor(sighting) {
  return EDIBILITY_COLORS[sighting.species?.edibility] ?? '#f59e0b'
}

export default function MapView({ sightings = [], onSightingClick }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  // Init map once
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      console.warn('VITE_MAPBOX_TOKEN is not set — map will not load')
      return
    }

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: UTAH_CENTER,
      zoom: UTAH_ZOOM,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-right')

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Sync markers when sightings change
  const syncMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    sightings.forEach(s => {
      const el = document.createElement('div')
      el.className = 'forage-marker'
      el.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${markerColor(s)};
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        cursor: pointer;
      `

      const popup = new mapboxgl.Popup({ offset: 10, closeButton: false })
        .setHTML(`
          <div style="font-size:13px;line-height:1.4">
            <strong>${s.species?.common_name ?? 'Unknown'}</strong>
            ${s.species?.latin_name ? `<br><em style="color:#666">${s.species.latin_name}</em>` : ''}
            ${s.found_on ? `<br>Found: ${s.found_on}` : ''}
            ${s.elevation_ft ? `<br>Elev: ${Math.round(s.elevation_ft).toLocaleString()} ft` : ''}
            ${s.habitat_type ? `<br>Habitat: ${s.habitat_type}` : ''}
            ${s.verified ? '<br><span style="color:#16a34a">✓ Verified</span>' : ''}
          </div>
        `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([s.longitude, s.latitude])
        .setPopup(popup)
        .addTo(map)

      el.addEventListener('click', () => onSightingClick?.(s))
      markersRef.current.push(marker)
    })
  }, [sightings, onSightingClick])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (map.loaded()) {
      syncMarkers()
    } else {
      map.once('load', syncMarkers)
    }
  }, [syncMarkers])

  const hasToken = !!import.meta.env.VITE_MAPBOX_TOKEN

  return (
    <div className="flex-1 relative">
      <div ref={containerRef} className="absolute inset-0" />
      {!hasToken && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center p-6 bg-white rounded-lg shadow">
            <p className="font-medium text-gray-800 mb-2">Mapbox token required</p>
            <p className="text-sm text-gray-500">
              Set <code className="bg-gray-100 px-1 rounded">VITE_MAPBOX_TOKEN</code> in{' '}
              <code className="bg-gray-100 px-1 rounded">frontend/.env</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
