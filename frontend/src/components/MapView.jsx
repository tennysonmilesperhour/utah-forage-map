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

const SOURCE_CLASSES = {
  community: 'community',
  iNaturalist: 'inaturalist',
  GBIF: 'gbif',
}

function markerColor(sighting) {
  return EDIBILITY_COLORS[sighting.species?.edibility] ?? '#f59e0b'
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default function MapView({ sightings = [], onSightingClick, draftLocation, onMapClick, isPickingLocation = false }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const draftMarkerRef = useRef(null)
  const sightingsRef = useRef(sightings)
  const onSightingClickRef = useRef(onSightingClick)
  const onMapClickRef = useRef(onMapClick)

  useEffect(() => {
    sightingsRef.current = sightings
  }, [sightings])

  useEffect(() => {
    onSightingClickRef.current = onSightingClick
  }, [onSightingClick])

  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])

  // Sync markers when sightings change
  const syncMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    sightingsRef.current.forEach(s => {
      const el = document.createElement('div')
      el.className = `forage-marker source-${SOURCE_CLASSES[s.source] ?? 'other'}`
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
            <strong>${escapeHtml(s.species?.common_name ?? 'Unknown')}</strong>
            ${s.species?.latin_name ? `<br><em style="color:#666">${escapeHtml(s.species.latin_name)}</em>` : ''}
            ${s.found_on ? `<br>Found: ${escapeHtml(s.found_on)}` : ''}
            ${s.elevation_ft ? `<br>Elev: ${Math.round(s.elevation_ft).toLocaleString()} ft` : ''}
            ${s.habitat_type ? `<br>Habitat: ${escapeHtml(s.habitat_type)}` : ''}
            <br>Source: ${escapeHtml(s.source)}
            ${s.verified ? '<br><span style="color:#16a34a">Verified</span>' : ''}
          </div>
        `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([s.longitude, s.latitude])
        .setPopup(popup)
        .addTo(map)

      el.addEventListener('click', () => onSightingClickRef.current?.(s))
      markersRef.current.push(marker)
    })
  }, [])

  // Init map once
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      console.warn('VITE_MAPBOX_TOKEN is not set - map will not load')
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
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-right')
    map.on('click', (event) => {
      onMapClickRef.current?.({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      })
    })

    mapRef.current = map
    syncMarkers()
    if (!map.loaded()) map.once('load', syncMarkers)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [syncMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    syncMarkers()
    if (!map.loaded()) map.once('load', syncMarkers)
  }, [sightings, syncMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    draftMarkerRef.current?.remove()
    draftMarkerRef.current = null

    if (!draftLocation) return

    const el = document.createElement('div')
    el.className = 'draft-marker'
    draftMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([draftLocation.longitude, draftLocation.latitude])
      .addTo(map)
  }, [draftLocation])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = isPickingLocation ? 'crosshair' : ''
  }, [isPickingLocation])

  const hasToken = !!import.meta.env.VITE_MAPBOX_TOKEN

  return (
    <div className="map-canvas-wrap">
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {!hasToken && (
        <div className="map-token-fallback">
          <div>
            <p>Mapbox token required</p>
            <span>
              Set <code className="bg-gray-100 px-1 rounded">VITE_MAPBOX_TOKEN</code> in{' '}
              <code className="bg-gray-100 px-1 rounded">frontend/.env</code>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
