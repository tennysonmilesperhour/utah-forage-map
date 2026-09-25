import { useEffect, useState } from 'react'
import HerbalHeader from './components/HerbalHeader'
import HerbalPracticeLibrary from './components/HerbalPracticeLibrary'
import AuthDialog from './components/AuthDialog'
import { useCurrentUser, useLogout } from './hooks/useAuth'
import { herbHref } from './lib/navigation'
import { applyPageMetadata } from './lib/seo'
import { trackPageView } from './lib/googleTag'
import './herbal.css'
import './herbal-forest.css'

export default function GatheringWaysApp() {
  const { data: user, isLoading } = useCurrentUser()
  const logout = useLogout()
  const [authMode, setAuthMode] = useState(null)
  useEffect(() => {
    applyPageMetadata('gatheringWays'); trackPageView('/herbs/gathering-ways')
    document.body.classList.add('herbal-body')
    return () => document.body.classList.remove('herbal-body')
  }, [])
  return <div className="herbal-shell herbal-shell--forest">
    <a className="skip-link" href="#gathering-content">Skip to gathering ways</a>
    <HerbalHeader view="practice" forest user={user} authLoading={isLoading} onNavigate={view => window.location.assign(herbHref(view))} onAuth={setAuthMode} onLogout={() => logout.mutate()} />
    <HerbalPracticeLibrary />
    <footer className="herbal-footer"><a href="/herbs/atlas">Plant atlas</a><a href="/herbs/fieldcraft">Identification and field safety</a><a href="/about#editorial">Editorial standards</a><a href="mailto:morphiclabsdata@gmail.com">Corrections and support</a></footer>
    {authMode && <AuthDialog context="herbs" mode={authMode} onClose={() => setAuthMode(null)} onAuthenticated={() => setAuthMode(null)} />}
  </div>
}
