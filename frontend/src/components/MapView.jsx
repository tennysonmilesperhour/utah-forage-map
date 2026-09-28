import { useCallback, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useUnitSystem } from '../hooks/useUnits'
import { initialMapCamera } from '../lib/visitorCountry'
import { datasetLevel, geometryBounds, squareSizeLabel, squaresGeoJSON } from '../lib/occurrenceGrid'

const SOURCE_ID = 'mushroom-observations'
const POINT_LAYER = 'observation-points'
const SQUARES_SOURCE = 'occurrence-squares'
const SQUARES_LAYER = 'occurrence-squares-fill'
const ZONE_SOURCE = 'growing-zone'
const ZONE_FILL_LAYER = 'growing-zone-fill'
const ZONE_LINE_LAYER = 'growing-zone-line'

const EDIBILITY_COLORS = {
  edible: '#83a978',
  choice: '#a9c986',
  caution: '#e0b45f',
  inedible: '#8e9a94',
  poisonous: '#df765d',
  deadly: '#b7433a',
}

// Square colour follows the number of different people who reported from that square,
// from a dim tint for one or two people to a bright tint for well-visited ground.
const SQUARE_RAMPS = {
  fungi: ['#51365a', '#9a74b3', '#e9d6ff'],
  herbs: ['#1f4a4a', '#3f9486', '#c3f2df'],
}
const ZONE_COLORS = {
  fungi: { fill: '#f0d2ad', line: '#f5dcbc' },
  herbs: { fill: '#e2f1c4', line: '#ecf7d5' },
}

const EMPTY = { type: 'FeatureCollection', features: [] }

function geojson(sightings) {
  return {
    type: 'FeatureCollection',
    features: sightings.map(sighting => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [sighting.longitude, sighting.latitude],
      },
      properties: {
        id: sighting.id,
        edibility: sighting.species?.edibility ?? 'unknown',
        source: sighting.source,
        plantStatus: sighting.status ?? 'study',
      },
    })),
  }
}

function roundedBounds(map) {
  const bounds = map.getBounds()
  const longitudeSpan = bounds.getEast() - bounds.getWest()
  const normalizeLongitude = value => ((value + 180) % 360 + 360) % 360 - 180
  return {
    west: longitudeSpan >= 360 ? -180 : Number(normalizeLongitude(bounds.getWest()).toFixed(4)),
    south: Number(Math.max(-85, bounds.getSouth()).toFixed(4)),
    east: longitudeSpan >= 360 ? 180 : Number(normalizeLongitude(bounds.getEast()).toFixed(4)),
    north: Number(Math.min(85, bounds.getNorth()).toFixed(4)),
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

export default function MapView({
  sightings = [],
  collection = 'fungi',
  onMapError,
  onSightingClick,
  onBoundsChange,
  flyTarget,
  countryCamera,
  draftLocation,
  onMapClick,
  isPickingLocation = false,
  density = null,
  zone = null,
  zoneFitKey = null,
  densityLabel = 'verified records',
}) {
  const containerRef = useRef(null)
  // Country detection only sets the first camera. Subsequent navigation belongs to the visitor.
  const initialCameraRef = useRef({ target: flyTarget, countryCamera })
  const mapRef = useRef(null)
  const scaleRef = useRef(null)
  const popupRef = useRef(null)
  const { system: unitSystem } = useUnitSystem()
  const draftMarkerRef = useRef(null)
  const sightingsRef = useRef(sightings)
  const densityRef = useRef(density)
  const zoneRef = useRef(zone)
  const densityLabelRef = useRef(densityLabel)
  const onSightingClickRef = useRef(onSightingClick)
  const onBoundsChangeRef = useRef(onBoundsChange)
  const onMapClickRef = useRef(onMapClick)
  const onMapErrorRef = useRef(onMapError)
  const isPickingLocationRef = useRef(isPickingLocation)

  useEffect(() => { sightingsRef.current = sightings }, [sightings])
  useEffect(() => { onSightingClickRef.current = onSightingClick }, [onSightingClick])
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange }, [onBoundsChange])
  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { onMapErrorRef.current = onMapError }, [onMapError])
  useEffect(() => { isPickingLocationRef.current = isPickingLocation }, [isPickingLocation])
  useEffect(() => { densityLabelRef.current = densityLabel }, [densityLabel])

  const syncSource = useCallback(() => {
    const source = mapRef.current?.getSource(SOURCE_ID)
    if (source) source.setData(geojson(sightingsRef.current))
  }, [])

  const syncSquares = useCallback(() => {
    const map = mapRef.current
    const source = map?.getSource(SQUARES_SOURCE)
    if (!source) return
    const level = datasetLevel(densityRef.current, map.getZoom())
    // Coarse squares are few enough to draw worldwide; fine squares are limited to the view.
    source.setData(level ? squaresGeoJSON(level, level.res <= 0.5 ? roundedBounds(map) : null) : EMPTY)
    // Individual points take over from the squares as the view narrows, as on iNaturalist.
    if (map.getLayer(POINT_LAYER)) {
      map.setPaintProperty(POINT_LAYER, 'circle-opacity', densityRef.current
        ? ['interpolate', ['linear'], ['zoom'], 1.8, 0, 2.8, 1]
        : 1)
      map.setPaintProperty(POINT_LAYER, 'circle-stroke-opacity', densityRef.current
        ? ['interpolate', ['linear'], ['zoom'], 1.8, 0, 2.8, 1]
        : 1)
    }
  }, [])

  const syncZone = useCallback(() => {
    const source = mapRef.current?.getSource(ZONE_SOURCE)
    if (source) source.setData(zoneRef.current ?? EMPTY)
  }, [])

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) return undefined

    mapboxgl.accessToken = token
    const compactViewport = containerRef.current.clientWidth < 600
    const ramp = SQUARE_RAMPS[collection] ?? SQUARE_RAMPS.fungi
    const zoneColors = ZONE_COLORS[collection] ?? ZONE_COLORS.fungi
    let map
    try { map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      ...initialMapCamera({ ...initialCameraRef.current, compact: compactViewport }),
      minZoom: 0.3,
      maxBounds: [[-180, -85], [180, 85]],
      renderWorldCopies: false,
      projection: 'globe',
    }) } catch { onMapErrorRef.current?.(true); return undefined }

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }), 'top-right')
    scaleRef.current = new mapboxgl.ScaleControl({ unit: 'metric' })
    map.addControl(scaleRef.current, 'bottom-right')
    popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: `occurrence-popup ${collection}` })

    map.on('error', () => { if (!map.isStyleLoaded()) onMapErrorRef.current?.(true) })
    map.on('load', () => {
      onMapErrorRef.current?.(null)
      // Tint the basemap itself, preserving legibility of labels and the meaning of specimen colors.
      for (const layer of map.getStyle().layers) {
        if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', collection === 'herbs' ? '#0e1e15' : '#080808')
        if (layer.id === 'water' && layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', collection === 'herbs' ? '#102c29' : '#1c1b18')
      }
      map.setFog({
        color: collection === 'herbs' ? '#1c2830' : '#26241e',
        'high-color': collection === 'herbs' ? '#426347' : '#453b2d',
        'horizon-blend': 0.08,
        'space-color': collection === 'herbs' ? '#090809' : '#000000',
        'star-intensity': 0.16,
      })
      const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id

      map.addSource(ZONE_SOURCE, { type: 'geojson', data: zoneRef.current ?? EMPTY })
      map.addLayer({
        id: ZONE_FILL_LAYER,
        type: 'fill',
        source: ZONE_SOURCE,
        paint: { 'fill-color': zoneColors.fill, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.14, 6, 0.09] },
      }, firstLabel)

      map.addSource(SQUARES_SOURCE, { type: 'geojson', data: EMPTY, tolerance: 0 })
      map.addLayer({
        id: SQUARES_LAYER,
        type: 'fill',
        source: SQUARES_SOURCE,
        paint: {
          'fill-color': ['interpolate', ['linear'], ['get', 'intensity'], 0, ramp[0], 0.5, ramp[1], 1, ramp[2]],
          'fill-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0.42, 1, 0.9],
          'fill-outline-color': '#00000055',
        },
      }, firstLabel)

      map.addLayer({
        id: ZONE_LINE_LAYER,
        type: 'line',
        source: ZONE_SOURCE,
        paint: {
          'line-color': zoneColors.line,
          'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 6, 1.6],
          'line-opacity': 0.8,
          'line-dasharray': [2, 1.5],
        },
      })

      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson(sightingsRef.current) })
      map.addLayer({
        id: POINT_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.5, 5, 4, 9, 6, 13, 8],
          'circle-color': collection === 'herbs' ? ['match', ['get', 'plantStatus'], 'culinary', '#b5d58b', 'toxic', '#e98672', '#d8bc80'] : [
            'match', ['get', 'edibility'],
            'choice', EDIBILITY_COLORS.choice,
            'edible', EDIBILITY_COLORS.edible,
            'caution', EDIBILITY_COLORS.caution,
            'poisonous', EDIBILITY_COLORS.poisonous,
            'deadly', EDIBILITY_COLORS.deadly,
            'inedible', EDIBILITY_COLORS.inedible,
            '#d3a95c',
          ],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 6, 1.6, 10, 2],
          'circle-stroke-color': '#f0f3e9',
        },
      })
      syncSquares()
      onBoundsChangeRef.current?.(roundedBounds(map))
    })

    map.on('moveend', () => {
      syncSquares()
      onBoundsChangeRef.current?.(roundedBounds(map))
    })
    const interactiveLayers = () => [POINT_LAYER, SQUARES_LAYER, ZONE_FILL_LAYER].filter(id => map.getLayer(id))
    map.on('click', event => {
      popupRef.current?.remove()
      const features = map.getLayer(POINT_LAYER)
        ? map.queryRenderedFeatures(event.point, { layers: interactiveLayers() })
        : []
      const point = features.find(feature => feature.layer.id === POINT_LAYER && map.getZoom() > 2.2)
      if (point && !isPickingLocationRef.current) {
        const sighting = sightingsRef.current.find(item => item.id === point.properties.id)
        if (sighting) onSightingClickRef.current?.(sighting)
        return
      }
      const square = features.find(feature => feature.layer.id === SQUARES_LAYER)
      if (square && !isPickingLocationRef.current && map.getZoom() < 9) {
        map.easeTo({ center: [square.properties.cx, square.properties.cy], zoom: Math.min(map.getZoom() + 2, 10) })
        return
      }
      onMapClickRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })
    })
    map.on('mousemove', event => {
      const features = map.getLayer(POINT_LAYER)
        ? map.queryRenderedFeatures(event.point, { layers: interactiveLayers() })
        : []
      const point = features.find(feature => feature.layer.id === POINT_LAYER && map.getZoom() > 2.2)
      const square = features.find(feature => feature.layer.id === SQUARES_LAYER)
      const inZone = features.some(feature => feature.layer.id === ZONE_FILL_LAYER)
      map.getCanvas().style.cursor = isPickingLocationRef.current ? 'crosshair' : point || square ? 'pointer' : ''
      if (point || (!square && !inZone)) { popupRef.current?.remove(); return }
      const html = square
        ? `<strong>${Number(square.properties.observers).toLocaleString()} ${square.properties.observers === 1 ? 'person' : 'people'}</strong><span>${Number(square.properties.count).toLocaleString()} ${escapeHtml(densityLabelRef.current)}</span><small>${squareSizeLabel(square.properties.res, event.lngLat.lat)} square${inZone ? ' · inside the growing zone' : ''}</small>`
        : '<strong>Known growing zone</strong><small>Expected range and areas of repeated verified records</small>'
      popupRef.current?.setLngLat(event.lngLat).setHTML(html).addTo(map)
    })
    map.on('mouseout', () => popupRef.current?.remove())

    mapRef.current = map
    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      scaleRef.current = null
    }
  }, [collection, syncSquares])

  useEffect(() => {
    scaleRef.current?.setUnit(unitSystem)
  }, [unitSystem])

  useEffect(() => { syncSource() }, [sightings, syncSource])
  useEffect(() => { densityRef.current = density; syncSquares() }, [density, syncSquares])
  useEffect(() => { zoneRef.current = zone; syncZone() }, [zone, syncZone])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !zoneFitKey || !zoneRef.current) return
    const bounds = geometryBounds(zoneRef.current.geometry)
    // A worldwide zone is better read from the globe than from a stretched fit.
    if (bounds && bounds[2] - bounds[0] < 300) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 60, maxZoom: 7 })
    else map.easeTo({ zoom: 0.8 })
  }, [zoneFitKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTarget) return
    if (flyTarget.bbox?.length === 4) {
      map.fitBounds([[flyTarget.bbox[0], flyTarget.bbox[1]], [flyTarget.bbox[2], flyTarget.bbox[3]]], {
        padding: 70,
        maxZoom: 10,
      })
    } else {
      map.flyTo({ center: flyTarget.center, zoom: 8 })
    }
  }, [flyTarget])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    draftMarkerRef.current?.remove()
    draftMarkerRef.current = null
    if (!draftLocation) return

    const element = document.createElement('div')
    element.className = 'draft-marker'
    draftMarkerRef.current = new mapboxgl.Marker({ element })
      .setLngLat([draftLocation.longitude, draftLocation.latitude])
      .addTo(map)
  }, [draftLocation])

  useEffect(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = isPickingLocation ? 'crosshair' : ''
  }, [isPickingLocation])

  const hasToken = !!import.meta.env.VITE_MAPBOX_TOKEN
  return (
    <div className="map-canvas-wrap">
      <div className="absolute inset-0"><div ref={containerRef} className="h-full w-full" /></div>
      {!hasToken && (
        <div className="map-token-fallback">
          <div><p>The map is unavailable</p><span>You can still browse the observation list.</span></div>
        </div>
      )}
    </div>
  )
}
