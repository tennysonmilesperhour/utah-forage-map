import { useCallback, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useUnitSystem } from '../hooks/useUnits'
import { initialMapCamera } from '../lib/visitorCountry'

const SOURCE_ID = 'mushroom-observations'
const CLUSTER_LAYER = 'observation-clusters'
const CLUSTER_COUNT_LAYER = 'observation-cluster-count'
const POINT_LAYER = 'observation-points'

const EDIBILITY_COLORS = {
  edible: '#83a978',
  choice: '#a9c986',
  caution: '#e0b45f',
  inedible: '#8e9a94',
  poisonous: '#df765d',
  deadly: '#b7433a',
}

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
}) {
  const containerRef = useRef(null)
  // Country detection only sets the first camera. Subsequent navigation belongs to the visitor.
  const initialCameraRef = useRef({ target: flyTarget, countryCamera })
  const mapRef = useRef(null)
  const scaleRef = useRef(null)
  const { system: unitSystem } = useUnitSystem()
  const draftMarkerRef = useRef(null)
  const sightingsRef = useRef(sightings)
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

  const syncSource = useCallback(() => {
    const source = mapRef.current?.getSource(SOURCE_ID)
    if (source) source.setData(geojson(sightingsRef.current))
  }, [])

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) return undefined

    mapboxgl.accessToken = token
    const compactViewport = containerRef.current.clientWidth < 600
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      ...initialMapCamera({ ...initialCameraRef.current, compact: compactViewport }),
      minZoom: 0.3,
      maxBounds: [[-180, -85], [180, 85]],
      renderWorldCopies: false,
      projection: 'globe',
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }), 'top-right')
    scaleRef.current = new mapboxgl.ScaleControl({ unit: 'metric' })
    map.addControl(scaleRef.current, 'bottom-right')

    map.on('error', () => { if (!map.isStyleLoaded()) onMapErrorRef.current?.(true) })
    map.on('load', () => {
      onMapErrorRef.current?.(null)
      // Tint the basemap itself, preserving legibility of labels and the meaning of specimen colors.
      for (const layer of map.getStyle().layers) {
        if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', collection === 'herbs' ? '#0e1e15' : '#19151d')
        if (layer.id === 'water' && layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', collection === 'herbs' ? '#102c29' : '#102f35')
      }
      map.setFog({
        color: '#1c2830',
        'high-color': collection === 'herbs' ? '#426347' : '#49314b',
        'horizon-blend': 0.08,
        'space-color': '#090809',
        'star-intensity': 0.16,
      })
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojson(sightingsRef.current),
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 48,
      })
      map.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': collection === 'herbs' ? ['step', ['get', 'point_count'], '#3d694f', 50, '#597543', 250, '#324f43'] : ['step', ['get', 'point_count'], '#8a583b', 50, '#73445e', 250, '#493953'],
          'circle-radius': ['step', ['get', 'point_count'], 17, 50, 21, 250, 26],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#edd0a8',
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
          'text-size': 12,
        },
        paint: { 'text-color': '#f7f9f1' },
      })
      map.addLayer({
        id: POINT_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 6,
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
          'circle-stroke-width': 2,
          'circle-stroke-color': '#f0f3e9',
        },
      })
      onBoundsChangeRef.current?.(roundedBounds(map))
    })

    map.on('moveend', () => onBoundsChangeRef.current?.(roundedBounds(map)))
    map.on('click', event => {
      const features = map.getLayer(CLUSTER_LAYER)
        ? map.queryRenderedFeatures(event.point, { layers: [CLUSTER_LAYER, POINT_LAYER] })
        : []
      const feature = features[0]
      if (feature?.layer.id === CLUSTER_LAYER) {
        map.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(map.getZoom() + 2, 13) })
        return
      }
      if (feature?.layer.id === POINT_LAYER) {
        const sighting = sightingsRef.current.find(item => item.id === feature.properties.id)
        if (sighting) onSightingClickRef.current?.(sighting)
        return
      }
      onMapClickRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })
    })
    map.on('mousemove', event => {
      const interactive = map.getLayer(CLUSTER_LAYER)
        ? map.queryRenderedFeatures(event.point, { layers: [CLUSTER_LAYER, POINT_LAYER] }).length > 0
        : false
      map.getCanvas().style.cursor = isPickingLocationRef.current ? 'crosshair' : interactive ? 'pointer' : ''
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      scaleRef.current = null
    }
  }, [collection])

  useEffect(() => {
    scaleRef.current?.setUnit(unitSystem)
  }, [unitSystem])

  useEffect(() => { syncSource() }, [sightings, syncSource])

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
