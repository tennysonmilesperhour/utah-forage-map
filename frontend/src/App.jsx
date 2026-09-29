import DataFreshness from './components/DataFreshness'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Filter, MailCheck, MapPin, NotebookPen, SearchX, Sparkles, Sprout } from 'lucide-react'
import AccountWorkspace from './components/AccountWorkspace'
import AppHeader from './components/AppHeader'
import AuthDialog from './components/AuthDialog'
import CommunityPanel from './components/CommunityPanel'
import GuestPrompt from './components/GuestPrompt'
import OccurrenceLegend from './components/OccurrenceLegend'
import ObservationRecord from './components/ObservationRecord'
import PlaceSearch from './components/PlaceSearch'
import Sidebar from './components/Sidebar'
import SubmitDrawer from './components/SubmitDrawer'
import { useCurrentUser, useLogout, useVerifyEmail } from './hooks/useAuth'
import { useSaveLocation } from './hooks/useAccount'
import { useCreateAlert, useObservationRecord } from './hooks/useCompanion'
import { useCommunityPortal, useCreateSighting, useSightings, useSpecies } from './hooks/useSightings'
import { useGrowingZone, useOccurrence } from './hooks/useOccurrence'
import { useUnitSystem } from './hooks/useUnits'
import { useVisitorCountry } from './hooks/useVisitorCountry'
import { countActiveFilters, DEFAULT_FILTERS } from './lib/filters'
import { regionBySlug } from './data/regions'
import { hemisphereFor } from './data/occurrence'
import { speciesIndexBySlug, speciesIndexByTaxon } from './content/species-index.generated'
import { applyPageMetadata, pathForView, viewFromPathname } from './lib/seo'
import { trackPageView, trackFieldEvent } from './lib/googleTag'
import './mycelial.css'
import './occurrence.css'

const MapView = lazy(() => import('./components/MapView'))
const IdentifyPanel = lazy(() => import('./components/IdentifyPanel'))
export default function App({ path = '/map' }) {
  const initialParams = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const initialTaxonId = Number(initialParams.get('taxon')) || undefined
  const initialRegion = regionBySlug[initialParams.get('region')]
  const initialObservationId = initialParams.get('observation')
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, taxon_id: initialTaxonId }))
  const [viewport, setViewport] = useState(null)
  const [flyTarget, setFlyTarget] = useState(() => initialRegion ? { bbox: initialRegion.bounds } : null)
  const [selected, setSelected] = useState(null)
  const [draftLocation, setDraftLocation] = useState(null)
  const [mapError, setMapError] = useState(false)
  const [mapAttempt, setMapAttempt] = useState(0)
  const [authMode, setAuthMode] = useState(initialParams.get('reset') ? 'reset' : null)
  const [resetToken] = useState(initialParams.get('reset'))
  const [pendingAction, setPendingAction] = useState(null)
  const [pendingSaveTarget, setPendingSaveTarget] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeView, setActiveView] = useState(() => viewFromPathname(typeof window === 'undefined' ? path : window.location.pathname))
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountInitialTab, setAccountInitialTab] = useState(() => initialParams.get('tab') || 'logbook')
  const [followTarget] = useState(initialParams.get('follow'))
  const [followHandled, setFollowHandled] = useState(false)
  const [observationHandled, setObservationHandled] = useState(false)
  const [toast, setToast] = useState('')
  const [userZoneFitKey, setZoneFitKey] = useState(null)
  const [hotspots, setHotspots] = useState(false)
  const [identifyOpen, setIdentifyOpen] = useState(() => initialParams.get('identify') === '1')
  const stageRef = useRef(null)
  const [guestPromptVisible, setGuestPromptVisible] = useState(
    () => typeof window === 'undefined' || window.localStorage.getItem('ufm:onboarding:guest-message:v1') !== 'true',
  )

  const { system: unitSystem } = useUnitSystem()
  const shouldLocateCountry = !initialRegion && !initialObservationId && !flyTarget
  const countryCamera = useVisitorCountry(shouldLocateCountry)
  const { data: user = null, isLoading: authLoading } = useCurrentUser()
  const logout = useLogout()
  const verifyEmail = useVerifyEmail()
  const saveLocation = useSaveLocation()
  const createAlert = useCreateAlert()
  const sharedRecord = useObservationRecord(initialObservationId)
  const { data: sightings = [], isLoading, isError: sightingsError, refetch: retrySightings } = useSightings(filters, initialTaxonId ? null : viewport)
  const { data: species = [] } = useSpecies()
  const { data: portal = {}, isLoading: portalLoading } = useCommunityPortal()
  const createSighting = useCreateSighting()
  const displayedSpeciesCount = new Set(sightings.map(item => item.species_id)).size
  const activeFilterCount = countActiveFilters(filters)
  const filterTaxonId = species.find(item => item.id === filters.species_id)?.inaturalist_taxon_id ?? filters.taxon_id
  // An open record focuses its own species; otherwise the species filter decides.
  const focusGuide = speciesIndexByTaxon[selected?.species?.inaturalist_taxon_id] ?? speciesIndexByTaxon[filterTaxonId] ?? null
  const focus = focusGuide ? { slug: focusGuide.slug, name: focusGuide.common_name, latin: focusGuide.latin_name } : null
  const occurrence = useOccurrence('fungi', focus?.slug, hotspots)
  const growingZone = useGrowingZone('fungi', focus?.slug)
  const zone = focus ? growingZone.data ?? null : null
  const hemisphere = hemisphereFor(viewport ? (viewport.north + viewport.south) / 2 : NaN)
  // A guide's "Show on map" link opens on the species' whole growing zone.
  const arrivalSlug = speciesIndexByTaxon[initialTaxonId]?.slug
  const zoneFitKey = userZoneFitKey ?? (arrivalSlug && zone && focus?.slug === arrivalSlug ? `arrival:${arrivalSlug}` : null)
  const mapCentre = viewport ? {
    latitude: (viewport.north + viewport.south) / 2,
    longitude: viewport.west <= viewport.east ? (viewport.west + viewport.east) / 2 : ((viewport.west + viewport.east + 360) / 2 + 180) % 360 - 180,
  } : null

  useEffect(() => {
    if (!initialTaxonId || species.length === 0) return
    const match = species.find(item => item.inaturalist_taxon_id === initialTaxonId)
    if (!match) return
    setFilters(current => ({ ...current, taxon_id: undefined, species_id: match.id }))
  }, [initialTaxonId, species])

  useEffect(() => {
    if (!initialObservationId || observationHandled) return
    // A shared record can sit outside the loaded map window, so wait for the record itself
    // before deciding where to fly.
    const match = sightings.find(item => item.id === initialObservationId) ?? sharedRecord.data
    // Open a missing record's panel after its first failed load rather than waiting out the retries.
    if (!match && sharedRecord.isPending && !sharedRecord.failureCount) return
    setSelected(match ?? { id: initialObservationId })
    setObservationHandled(true)
    if (Number.isFinite(match?.latitude) && Number.isFinite(match?.longitude)) setFlyTarget({ center: [match.longitude, match.latitude], selectedAt: Date.now() })
  }, [initialObservationId, observationHandled, sightings, sharedRecord.data, sharedRecord.isPending, sharedRecord.failureCount])

  useEffect(() => {
    // The toolbar wraps onto a second row on narrower screens; panels below it read its height.
    const stage = stageRef.current
    const toolbar = stage?.querySelector('.map-toolbar')
    if (!toolbar) return undefined
    const update = () => stage.style.setProperty('--map-toolbar-bottom', `${Math.round(toolbar.offsetTop + toolbar.offsetHeight)}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (authLoading || followHandled || !followTarget) return
    if (!user) {
      setPendingAction('follow')
      setAuthMode('register')
      return
    }
    const [kind, value] = followTarget.split(':')
    const payload = kind === 'species'
      ? { kind, species_taxon_id: Number(value) }
      : { kind, region_slug: value }
    createAlert.mutateAsync(payload)
      .then(() => setToast('Weekly field bulletins are on.'))
      .catch(() => setToast('That field bulletin could not be created.'))
      .finally(() => {
        setFollowHandled(true)
        window.history.replaceState({}, '', '/map')
      })
    // The handoff is consumed once after authentication resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, followHandled, followTarget, user])

  useEffect(() => {
    if (authLoading || window.location.pathname !== '/account') return
    if (user) {
      setAccountInitialTab(initialParams.get('tab') || 'logbook')
      setAccountOpen(true)
    } else {
      setAuthMode('login')
    }
    // Account links are interpreted once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  useEffect(() => {
    applyPageMetadata(activeView)
    trackPageView(window.location.pathname)
  }, [activeView])

  useEffect(() => {
    function syncRoute() {
      setActiveView(viewFromPathname(window.location.pathname))
    }
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    const token = initialParams.get('verify')
    if (!token) return
    verifyEmail.mutateAsync(token)
      .then(() => setToast('Email verified. Your field account is ready.'))
      .catch(() => setToast('That verification link is invalid or expired.'))
      .finally(() => window.history.replaceState({}, '', window.location.pathname))
    // The link is consumed once when the app starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismissGuestPrompt() {
    setGuestPromptVisible(false)
    window.localStorage.setItem('ufm:onboarding:guest-message:v1', 'true')
  }

  function openAuth(mode, action = null) {
    setPendingAction(action)
    setAuthMode(mode)
  }

  function openAccount(tab = 'logbook') {
    setAccountInitialTab(tab)
    setAccountOpen(true)
  }

  function navigate(view, { replace = false } = {}) {
    const path = pathForView(view)
    if (window.location.pathname !== path) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    }
    setActiveView(view)
  }

  function openSubmission() {
    if (!user) {
      openAuth('register', 'submit')
      return
    }
    setSelected(null)
    setSubmissionOpen(true)
  }

  function focusSpecies(slug) {
    const taxonId = speciesIndexBySlug[slug]?.taxon_id
    const match = species.find(item => item.inaturalist_taxon_id === taxonId)
    setSelected(null)
    setFilters(current => ({ ...current, species_id: match?.id, taxon_id: match ? undefined : taxonId }))
    trackFieldEvent('id_helper_focus', 'fungi')
  }

  function goToPlace(target) {
    setSelected(null)
    setFlyTarget({ ...target, selectedAt: Date.now() })
  }

  function viewSightingOnMap(sighting) {
    navigate('map')
    setSelected(sighting)
    setFlyTarget({ center: [sighting.longitude, sighting.latitude], selectedAt: Date.now() })
  }

  function addFindFromCommunity() {
    navigate('map')
    openSubmission()
  }

  function createAccountFromCommunity() {
    navigate('map')
    openAuth('register')
  }

  function handleAuthenticated() {
    setAuthMode(null)
    if (pendingAction === 'submit') setSubmissionOpen(true)
    if (pendingAction === 'save' && pendingSaveTarget) saveSelected(true, pendingSaveTarget)
    setPendingAction(null)
    setPendingSaveTarget(null)
  }

  async function saveSelected(skipAuthCheck = false, target = selected) {
    if (!target) return
    if (!user && !skipAuthCheck) {
      setPendingSaveTarget(target)
      openAuth('register', 'save')
      return
    }
    await saveLocation.mutateAsync({
      sighting_id: target.id,
      title: target.species?.common_name ?? 'Saved observation',
      latitude: target.latitude,
      longitude: target.longitude,
    })
    setToast('Place saved to your field desk.')
  }

  function closeSubmission() {
    setSubmissionOpen(false)
    setDraftLocation(null)
  }

  async function submitSighting(payload) {
    await createSighting.mutateAsync(payload)
    closeSubmission()
    setToast('Observation submitted for community review.')
  }

  async function signOut() {
    await logout.mutateAsync()
    closeSubmission()
    setAccountOpen(false)
    setToast('You are signed out. The public map is still available.')
  }

  return (
    <div className="app-shell mycelial-theme">
      <AppHeader
        user={user}
        authLoading={authLoading}
        activeView={activeView}
        onCreateAccount={() => openAuth('register')}
        onSignIn={() => openAuth('login')}
        onSubmitFind={openSubmission}
        onNavigate={navigate}
        onOpenAccount={() => openAccount()}
        onLogout={signOut}
      />

      <main className="workspace"><h1 className="sr-only">Fungi field map and community</h1>
        <Sidebar
          filters={filters}
          onChange={setFilters}
          sightingCount={sightings.length}
          loading={isLoading}
          species={species}
        />

        <section ref={stageRef} className={`map-stage ${submissionOpen ? 'is-picking' : ''}`} aria-label="Worldwide mushroom observations map">
          <Suspense fallback={<div className="map-loading" role="status"><span>Loading map...</span></div>}>
            {shouldLocateCountry && countryCamera.isLoading ? <div className="map-loading" role="status"><span>Loading map...</span></div> : <MapView key={mapAttempt} onMapError={setMapError}
              countryCamera={countryCamera.data}
              sightings={sightings}
              onSightingClick={setSelected}
              onBoundsChange={setViewport}
              flyTarget={flyTarget}
              draftLocation={draftLocation}
              onMapClick={submissionOpen ? setDraftLocation : undefined}
              isPickingLocation={submissionOpen}
              density={hotspots ? occurrence.data ?? null : null}
              zone={zone}
              zoneFitKey={zoneFitKey}
            />}
          </Suspense>

          <details className="map-data-status"><summary>Observation updates</summary><DataFreshness /></details>
          {mapError && <div className="map-failure" role="alert"><h2>The map could not load</h2><p>Your library and regional guides remain available.</p><button className="button button-secondary" onClick={() => { trackFieldEvent('map_retry', 'fungi'); setMapError(false); setMapAttempt(value => value + 1) }}>Retry map</button><a href="/regions">Browse regions</a><a href="/">Open the library</a></div>}
          <div className="map-toolbar">
            <PlaceSearch onSelect={goToPlace} />
            <button className="map-filter-button" type="button" onClick={() => setFiltersOpen(true)}>
              <Filter size={17} aria-hidden="true" /> Filters
              {activeFilterCount > 0 && <span className="filter-count" aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span>}
            </button>
            <button className={`map-filter-button map-identify-button ${identifyOpen ? 'active' : ''}`} type="button" aria-expanded={identifyOpen} onClick={() => setIdentifyOpen(open => !open)}>
              <Sparkles size={17} aria-hidden="true" /> Suggest an ID
            </button>
            <div className="map-results" aria-live="polite">
              <MapPin size={17} aria-hidden="true" />
              <strong>{sightings.length}</strong>
              <span>locations</span>
              <i aria-hidden="true" />
              <Sprout size={17} aria-hidden="true" />
              <strong>{displayedSpeciesCount}</strong>
              <span>species</span>
            </div>
            <button className="button button-primary map-submit-button" type="button" onClick={openSubmission}>
              <NotebookPen size={17} aria-hidden="true" /> Add a find
            </button>
            {user && !user.email_verified && !submissionOpen && !selected && (
              <button className="verification-notice" type="button" onClick={() => setAccountOpen(true)}>
                <MailCheck size={18} aria-hidden="true" /> Verify your email to secure account recovery
              </button>
            )}
          </div>

          <OccurrenceLegend
            className={`map-occurrence-legend ${selected ? 'is-compact' : ''}`}
            collection="fungi"
            focus={focus}
            hemisphere={hemisphere}
            zone={zone}
            zoneLoading={growingZone.isLoading}
            hotspots={hotspots}
            hotspotsStatus={occurrence.isError ? 'error' : occurrence.data ? 'ready' : 'loading'}
            onToggleHotspots={setHotspots}
            onFitZone={() => setZoneFitKey(Date.now())}
            onClear={selected ? () => setSelected(null) : () => setFilters(current => ({ ...current, species_id: undefined, taxon_id: undefined }))}
            clearLabel={selected ? 'Close this record' : 'Show all species'}
            guideHref={focus ? `/learn/species/${focus.slug}` : undefined}
          />

          {sightingsError && <div className="map-empty-state" role="alert"><div><strong>Observations could not be loaded</strong><p>The map is still available. Retry, or browse the library.</p></div><button className="button button-secondary" onClick={() => { trackFieldEvent('map_retry', 'fungi'); retrySightings() }}>Retry records</button><a href="/">Open library</a></div>}
          {!sightingsError && !isLoading && sightings.length === 0 && !submissionOpen && (
            <div className="map-empty-state" role="status">
              <SearchX size={22} aria-hidden="true" />
              <div>
                <strong>No observations match here</strong>
                <p>{activeFilterCount > 0 ? 'Try clearing a lens or zooming out.' : 'Zoom out or search another place.'}</p>
              </div>
              {activeFilterCount > 0 && (
                <button className="button button-secondary" type="button" onClick={() => { trackFieldEvent('map_empty_recovery', 'fungi'); setFilters({ ...DEFAULT_FILTERS }) }}>Clear filters</button>
              )}
            </div>
          )}

          {identifyOpen && (
            <Suspense fallback={null}>
              <IdentifyPanel className="map-identify-panel" collection="fungi" location={mapCentre} onClose={() => setIdentifyOpen(false)} onShowOnMap={focusSpecies} />
            </Suspense>
          )}

          {!authLoading && !user && guestPromptVisible && !submissionOpen && !selected && !identifyOpen && sightings.length > 0 && (
            <GuestPrompt
              onDismiss={dismissGuestPrompt}
              onCreateAccount={() => openAuth('register')}
            />
          )}


          {selected && <ObservationRecord
            sighting={selected}
            user={user}
            unitSystem={unitSystem}
            onClose={() => setSelected(null)}
            onSave={target => saveSelected(false, target)}
            saving={saveLocation.isPending}
            onCreateAccount={action => openAuth('register', action)}
            onOpenAccount={() => openAccount('settings')}
            onToast={setToast}
          />}
        </section>
      </main>

      {filtersOpen && (
        <div className="drawer-layer filter-drawer-layer">
          <button className="drawer-backdrop" type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" />
          <Sidebar
            filters={filters}
            onChange={setFilters}
            sightingCount={sightings.length}
            loading={isLoading}
            species={species}
            variant="mobile"
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      )}

      {activeView !== 'map' && (
        <CommunityPanel
          key={activeView}
          portal={portal}
          loading={portalLoading}
          initialView={activeView}
          user={user}
          onClose={() => navigate('map')}
          onNavigate={navigate}
          onViewSighting={viewSightingOnMap}
          onAddFind={addFindFromCommunity}
          onCreateAccount={createAccountFromCommunity}
        />
      )}

      {submissionOpen && (
        <SubmitDrawer
          species={species}
          location={draftLocation}
          onSubmit={submitSighting}
          onClose={closeSubmission}
          creating={createSighting.isPending}
        />
      )}

      {accountOpen && user && (
        <AccountWorkspace
          key={`${user.id}:${accountInitialTab}`}
          user={user}
          species={species}
          initialTab={accountInitialTab}
          onClose={() => setAccountOpen(false)}
          onDeleted={() => { setAccountOpen(false); setToast('Your account has been deleted.') }}
          onToast={setToast}
        />
      )}

      {authMode && (
        <AuthDialog
          mode={authMode}
          resetToken={resetToken}
          onClose={() => { setAuthMode(null); setPendingAction(null) }}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} aria-hidden="true" /> {toast}
        </div>
      )}
    </div>
  )
}
