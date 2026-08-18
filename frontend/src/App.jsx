import { lazy, Suspense, useEffect, useState } from 'react'
import { CheckCircle2, Filter, MailCheck, MapPin, NotebookPen, SearchX, Sprout } from 'lucide-react'
import AccountWorkspace from './components/AccountWorkspace'
import AppHeader from './components/AppHeader'
import AuthDialog from './components/AuthDialog'
import CommunityPanel from './components/CommunityPanel'
import GuestPrompt from './components/GuestPrompt'
import ObservationRecord from './components/ObservationRecord'
import PlaceSearch from './components/PlaceSearch'
import Sidebar from './components/Sidebar'
import SubmitDrawer from './components/SubmitDrawer'
import { useCurrentUser, useLogout, useVerifyEmail } from './hooks/useAuth'
import { useSaveLocation } from './hooks/useAccount'
import { useCreateAlert } from './hooks/useCompanion'
import { useCommunityPortal, useCreateSighting, useSightings, useSpecies } from './hooks/useSightings'
import { useUnitSystem } from './hooks/useUnits'
import { countActiveFilters, DEFAULT_FILTERS } from './lib/filters'
import { regionBySlug } from './data/regions'
import { applyPageMetadata, pathForView, viewFromPathname } from './lib/seo'

const MapView = lazy(() => import('./components/MapView'))
export default function App() {
  const initialParams = new URLSearchParams(window.location.search)
  const initialTaxonId = Number(initialParams.get('taxon')) || undefined
  const initialRegion = regionBySlug[initialParams.get('region')]
  const initialObservationId = initialParams.get('observation')
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, taxon_id: initialTaxonId }))
  const [viewport, setViewport] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [selected, setSelected] = useState(null)
  const [draftLocation, setDraftLocation] = useState(null)
  const [authMode, setAuthMode] = useState(initialParams.get('reset') ? 'reset' : null)
  const [resetToken] = useState(initialParams.get('reset'))
  const [pendingAction, setPendingAction] = useState(null)
  const [pendingSaveTarget, setPendingSaveTarget] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeView, setActiveView] = useState(() => viewFromPathname(window.location.pathname))
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountInitialTab, setAccountInitialTab] = useState(() => initialParams.get('tab') || 'logbook')
  const [followTarget] = useState(initialParams.get('follow'))
  const [followHandled, setFollowHandled] = useState(false)
  const [observationHandled, setObservationHandled] = useState(false)
  const [toast, setToast] = useState('')
  const [guestPromptVisible, setGuestPromptVisible] = useState(
    () => window.localStorage.getItem('ufm:onboarding:guest-message:v1') !== 'true',
  )

  const { system: unitSystem } = useUnitSystem()
  const { data: user = null, isLoading: authLoading } = useCurrentUser()
  const logout = useLogout()
  const verifyEmail = useVerifyEmail()
  const saveLocation = useSaveLocation()
  const createAlert = useCreateAlert()
  const { data: sightings = [], isLoading } = useSightings(filters, initialTaxonId ? null : viewport)
  const { data: species = [] } = useSpecies()
  const { data: portal = {}, isLoading: portalLoading } = useCommunityPortal()
  const createSighting = useCreateSighting()
  const displayedSpeciesCount = new Set(sightings.map(item => item.species_id)).size
  const sourceCount = new Set(sightings.map(item => item.source)).size
  const activeFilterCount = countActiveFilters(filters)

  useEffect(() => {
    if (!initialTaxonId || species.length === 0) return
    const match = species.find(item => item.inaturalist_taxon_id === initialTaxonId)
    if (!match) return
    setFilters(current => ({ ...current, taxon_id: undefined, species_id: match.id }))
  }, [initialTaxonId, species])

  useEffect(() => {
    if (!initialObservationId || observationHandled) return
    const match = sightings.find(item => item.id === initialObservationId)
    setSelected(match ?? { id: initialObservationId })
    setObservationHandled(true)
    if (match) setFlyTarget({ center: [match.longitude, match.latitude], selectedAt: Date.now() })
  }, [initialObservationId, observationHandled, sightings])

  useEffect(() => {
    if (!initialRegion) return
    setFlyTarget({ bbox: initialRegion.bounds, selectedAt: Date.now() })
    // Regional handoff is interpreted once when the map starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        window.history.replaceState({}, '', '/')
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
    <div className="app-shell">
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

      <main className="workspace">
        <Sidebar
          filters={filters}
          onChange={setFilters}
          sightingCount={sightings.length}
          loading={isLoading}
          species={species}
        />

        <section className={`map-stage ${submissionOpen ? 'is-picking' : ''}`} aria-label="Worldwide mushroom observations map">
          <Suspense fallback={<div className="map-loading" role="status"><span>Loading map...</span></div>}>
            <MapView
              sightings={sightings}
              onSightingClick={setSelected}
              onBoundsChange={setViewport}
              flyTarget={flyTarget}
              draftLocation={draftLocation}
              onMapClick={submissionOpen ? setDraftLocation : undefined}
              isPickingLocation={submissionOpen}
            />
          </Suspense>

          <div className="map-toolbar">
            <PlaceSearch onSelect={goToPlace} />
            <button className="map-filter-button" type="button" onClick={() => setFiltersOpen(true)}>
              <Filter size={17} aria-hidden="true" /> Filters
              {activeFilterCount > 0 && <span className="filter-count" aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span>}
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
          </div>

          <div className="map-legend" aria-label={`${sourceCount} observation sources`}>
            <span><i className="legend-dot recent" /> Recent, reviewed field observations</span>
          </div>

          {!isLoading && sightings.length === 0 && !submissionOpen && (
            <div className="map-empty-state" role="status">
              <SearchX size={22} aria-hidden="true" />
              <div>
                <strong>No observations match here</strong>
                <p>{activeFilterCount > 0 ? 'Try clearing a lens or zooming out.' : 'Zoom out or search another place.'}</p>
              </div>
              {activeFilterCount > 0 && (
                <button className="button button-secondary" type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Clear filters</button>
              )}
            </div>
          )}

          {!authLoading && !user && guestPromptVisible && !submissionOpen && !selected && sightings.length > 0 && (
            <GuestPrompt
              onDismiss={dismissGuestPrompt}
              onCreateAccount={() => openAuth('register')}
            />
          )}

          {user && !user.email_verified && !submissionOpen && !selected && (
            <button className="verification-notice" type="button" onClick={() => setAccountOpen(true)}>
              <MailCheck size={18} aria-hidden="true" /> Verify your email to secure account recovery
            </button>
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
          key={accountInitialTab}
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
