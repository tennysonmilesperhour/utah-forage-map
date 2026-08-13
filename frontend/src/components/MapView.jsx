import { useCallback, useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import PlaceSearch from './PlaceSearch'
import { useUnitSystem } from '../hooks/useUnits'

// The map opens on the whole world; results then pull it toward wherever the data is.
const WORLD_CENTER = [10, 25]
const WORLD_ZOOM = 1.4
const SOURCE_ID = 'sightings'
const CLUSTER_LAYER = 'sighting-clusters'
const CLUSTER_COUNT_LAYER = 'sighting-cluster-count'
const POINT_LAYER = 'sighting-points'
const VIEWPORT_DEBOUNCE_MS = 350

const EDIBILITY_COLORS = {
  edible: '#16a34a',
  choice: '#15803d',
  inedible: '#9ca3af',
  poisonous: '#dc2626',
  deadly: '#7f1d1d',
}

const SOURCE_COLORS = {
  community: '#184a3b',
  iNaturalist: '#2563eb',
  GBIF: '#7c3aed',
  'field desk': '#6b7280',
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

function toFeatureCollection(sightings, unitSystem) {
  return {
    type: 'FeatureCollection',
    features: sightings.map(sighting => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [sighting.longitude, sighting.latitude] },
      properties: {
        id: String(sighting.id),
        color: markerColor(sighting),
        ring: SOURCE_COLORS[sighting.source] ?? '#6b7280',
        popup: popupMarkup(sighting, unitSystem),
      },
    })),
  }
}

function popupMarkup(sighting, unitSystem) {
  const elevation = sighting.elevation_ft == null
    ? null
    : unitSystem === 'imperial'
      ? `${Math.round(sighting.elevation_ft).toLocaleString()} ft`
      : `${Math.round(sighting.elevation_ft / 3.280839895).toLocaleString()} m`

  return `
    <div style="font-size:13px;line-height:1.4">
      <strong>${escapeHtml(sighting.species?.common_name ?? 'Unknown')}</strong>
      ${sighting.species?.latin_name ? `<br><em style="color:#666">${escapeHtml(sighting.species.latin_name)}</em>` : ''}
      ${sighting.place_name ? `<br>${escapeHtml(sighting.place_name)}` : ''}
      ${sighting.found_on ? `<br>Found: ${escapeHtml(sighting.found_on)}` : ''}
      ${elevation ? `<br>Elev: ${escapeHtml(elevation)}` : ''}
      ${sighting.habitat_type ? `<br>Habitat: ${escapeHtml(sighting.habitat_type)}` : ''}
      <br>Source: ${escapeHtml(sighting.source)}
      ${sighting.verified ? '<br><span style="color:#16a34a">Reviewed</span>' : ''}
    </div>
  `
}

function boundsOf(sightings) {
  const bounds = new mapboxgl.LngLatBounds()
  sightings.forEach(sighting => bounds.extend([sighting.longitude, sighting.latitude]))
  return bounds
}

export default function MapView({
  sightings = [],
  onSightingClick,
  draftLocation,
  onMapClick,
  isPickingLocation = false,
  onViewportChange,
  fitToken = 0,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const scaleRef = useRef(null)
  const draftMarkerRef = useRef(null)
  const popupRef = useRef(null)
  const sightingsRef = useRef(sightings)
  const onSightingClickRef = useRef(onSightingClick)
  const onMapClickRef = useRef(onMapClick)
  const onViewportChangeRef = useRef(onViewportChange)
  const appliedFitRef = useRef(0)
  const [styleReady, setStyleReady] = useState(false)
  const { system: unitSystem } = useUnitSystem()

  useEffect(() => { sightingsRef.current = sightings }, [sightings])
  useEffect(() => { onSightingClickRef.current = onSightingClick }, [onSightingClick])
  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { onViewportChangeRef.current = onViewportChange }, [onViewportChange])

  const flyToPlace = useCallback((place) => {
    const map = mapRef.current
    if (!map) return
    if (place.bbox) {
      map.fitBounds(place.bbox, { padding: 60, maxZoom: 12, duration: 900 })
      return
    }
    map.flyTo({ center: place.center, zoom: 9, duration: 900 })
  }, [])

  // Init map once
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      console.warn('VITE_MAPBOX_TOKEN is not set - map will not load')
      return undefined
    }

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      projection: 'globe',
      renderWorldCopies: true,
    })

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }), 'top-right')
    scaleRef.current = new mapboxgl.ScaleControl({ unit: 'metric' })
    map.addControl(scaleRef.current, 'bottom-right')

    map.on('click', (event) => {
      onMapClickRef.current?.({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      })
    })

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: 12,
      })

      map.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#2f7d5e', 25, '#1f6a4d', 100, '#184a3b'],
          'circle-radius': ['step', ['get', 'point_count'], 15, 25, 20, 100, 26],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.92,
        },
      })

      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      })

      map.addLayer({
        id: POINT_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 7, 14, 9],
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'ring'],
        },
      })

      map.on('click', CLUSTER_LAYER, (event) => {
        const feature = event.features?.[0]
        if (!feature) return
        const zoomTo = zoom => map.easeTo({ center: feature.geometry.coordinates, zoom })
        const result = map.getSource(SOURCE_ID)?.getClusterExpansionZoom(
          feature.properties.cluster_id,
          (error, zoom) => { if (!error) zoomTo(zoom) },
        )
        // Newer releases resolve a promise instead of calling back.
        if (result && typeof result.then === 'function') result.then(zoomTo).catch(() => {})
      })

      map.on('click', POINT_LAYER, (event) => {
        const feature = event.features?.[0]
        if (!feature) return
        const coordinates = feature.geometry.coordinates.slice()
        // Keep the popup on the copy of the world the reader clicked.
        while (Math.abs(event.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += event.lngLat.lng > coordinates[0] ? 360 : -360
        }
        popupRef.current?.remove()
        popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: false })
          .setLngLat(coordinates)
          .setHTML(feature.properties.popup)
          .addTo(map)
        const sighting = sightingsRef.current.find(item => String(item.id) === feature.properties.id)
        if (sighting) onSightingClickRef.current?.(sighting)
      })

      for (const layer of [CLUSTER_LAYER, POINT_LAYER]) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }

      setStyleReady(true)
    })

    let viewportTimer = 0
    map.on('moveend', () => {
      window.clearTimeout(viewportTimer)
      viewportTimer = window.setTimeout(() => {
        const bounds = map.getBounds()
        onViewportChangeRef.current?.({
          min_lat: Number(bounds.getSouth().toFixed(2)),
          max_lat: Number(bounds.getNorth().toFixed(2)),
          min_lng: Number(bounds.getWest().toFixed(2)),
          max_lng: Number(bounds.getEast().toFixed(2)),
        })
      }, VIEWPORT_DEBOUNCE_MS)
    })

    mapRef.current = map

    return () => {
      window.clearTimeout(viewportTimer)
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
      scaleRef.current = null
      setStyleReady(false)
    }
  }, [])

  // Push observations into the clustered source
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    map.getSource(SOURCE_ID)?.setData(toFeatureCollection(sightings, unitSystem))
  }, [sightings, styleReady, unitSystem])

  // Frame the results after the first load and whenever the filters change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || sightings.length === 0) return
    if (appliedFitRef.current === fitToken) return
    appliedFitRef.current = fitToken
    map.fitBounds(boundsOf(sightings), { padding: 70, maxZoom: 9, duration: 900 })
  }, [sightings, styleReady, fitToken])

  useEffect(() => {
    scaleRef.current?.setUnit(unitSystem)
  }, [unitSystem])

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
      {hasToken && <PlaceSearch onSelect={flyToPlace} />}
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
