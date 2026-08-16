import { lazy, Suspense, useEffect, useState } from 'react'
import { Bookmark, BookOpen, CheckCircle2, Filter, MailCheck, MapPin, NotebookPen, SearchX, Sprout, X } from 'lucide-react'
import AccountWorkspace from './components/AccountWorkspace'
import AppHeader from './components/AppHeader'
import AuthDialog from './components/AuthDialog'
import CommunityPanel from './components/CommunityPanel'
import GuestPrompt from './components/GuestPrompt'
import PlaceSearch from './components/PlaceSearch'
import Sidebar from './components/Sidebar'
import SubmitDrawer from './components/SubmitDrawer'
import { useCurrentUser, useLogout, useVerifyEmail } from './hooks/useAuth'
import { useSaveLocation } from './hooks/useAccount'
import { useCommunityPortal, useCreateSighting, useSightings, useSpecies } from './hooks/useSightings'
import { useUnitSystem } from './hooks/useUnits'
import { countActiveFilters, DEFAULT_FILTERS } from './lib/filters'
import { speciesPathForTaxon } from './content/species.generated'
import { applyPageMetadata, pathForView, viewFromPathname } from './lib/seo'
import { formatElevation } from './lib/units'

const MapView = lazy(() => import('./components/MapView'))
function foundDateLabel(value) {
  if (!value) return 'Unknown'
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function App() {
  const initialParams = new URLSearchParams(window.location.search)
  const initialTaxonId = Number(initialParams.get('taxon')) || undefined
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, taxon_id: initialTaxonId }))
  const [viewport, setViewport] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [selected, setSelected] = useState(null)
  const [draftLocation, setDraftLocation] = useState(null)
  const [authMode, setAuthMode] = useState(initialParams.get('reset') ? 'reset' : null)
  const [resetToken] = useState(initialParams.get('reset'))
  const [pendingAction, setPendingAction] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeView, setActiveView] = useState(() => viewFromPathname(window.location.pathname))
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [guestPromptVisible, setGuestPromptVisible] = useState(
    () => window.localStorage.getItem('ufm:onboarding:guest-message:v1') !== 'true',
  )

  const { system: unitSystem } = useUnitSystem()
  const { data: user = null, isLoading: authLoading } = useCurrentUser()
  const logout = useLogout()
  const verifyEmail = useVerifyEmail()
  const saveLocation = useSaveLocation()
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
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [toast])

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
    if (pendingAction === 'save' && selected) saveSelected(true)
    setPendingAction(null)
  }

  async function saveSelected(skipAuthCheck = false) {
    if (!selected) return
    if (!user && !skipAuthCheck) {
      openAuth('register', 'save')
      return
    }
    await saveLocation.mutateAsync({
      sighting_id: selected.id,
      title: selected.species?.common_name ?? 'Saved observation',
      latitude: selected.latitude,
      longitude: selected.longitude,
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
        onOpenAccount={() => setAccountOpen(true)}
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

          {selected && (
            <article className="sighting-detail" aria-label="Selected observation">
              <button className="icon-button sighting-close" type="button" onClick={() => setSelected(null)} aria-label="Close observation details">
                <X size={18} aria-hidden="true" />
              </button>
              <div className="sighting-heading">
                <div>
                  <span className={selected.verified ? 'status-reviewed' : 'status-pending'}>
                    {selected.verified ? 'Reviewed' : 'Pending review'}
                  </span>
                  <h2>{selected.species?.common_name ?? 'Unknown species'}</h2>
                  {selected.species?.latin_name && <p>{selected.species.latin_name}</p>}
                </div>
              </div>
              {selected.notes && <p className="sighting-notes">{selected.notes}</p>}
              <dl>
                <div><dt>Found</dt><dd>{foundDateLabel(selected.found_on)}</dd></div>
                <div><dt>Source</dt><dd>{selected.source}</dd></div>
                <div><dt>Elevation</dt><dd>{formatElevation(selected.elevation_ft, unitSystem)}</dd></div>
                <div><dt>Habitat</dt><dd>{selected.habitat_type ?? 'Unknown'}</dd></div>
                <div><dt>Place</dt><dd>{selected.place_name ?? 'Not recorded'}</dd></div>
              </dl>
              <button className="button button-secondary save-place-button" type="button" onClick={() => saveSelected()} disabled={saveLocation.isPending}>
                <Bookmark size={17} aria-hidden="true" /> {saveLocation.isPending ? 'Saving...' : 'Save place'}
              </button>
              {speciesPathForTaxon(selected.species?.inaturalist_taxon_id) && (
                <a className="button button-secondary learn-species-button" href={speciesPathForTaxon(selected.species.inaturalist_taxon_id)}>
                  <BookOpen size={17} aria-hidden="true" /> Learn to identify
                </a>
              )}
            </article>
          )}
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
          user={user}
          species={species}
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
