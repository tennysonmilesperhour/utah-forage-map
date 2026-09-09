import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import AnalyticsConsent from './components/AnalyticsConsent'
import { initGoogleTag } from './lib/googleTag'
import { initAdSense } from './lib/adsense'

// Both integrations are no-ops unless configured. GA waits for opt-in consent.
initGoogleTag()
initAdSense()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const root = document.getElementById('root')
const pathname = window.location.pathname
const isHerbalGuidePath = /^\/herbs\/(atlas|regions|fieldcraft)(\/|$)/.test(pathname)
const isHerbalPath = pathname === '/herbs' || pathname.startsWith('/herbs/')
const isGuidePath = pathname === '/learn' || pathname.startsWith('/learn/') || pathname === '/regions' || pathname.startsWith('/regions/') || pathname === '/about' || pathname === '/privacy' || pathname === '/disclaimer'
async function mount() {
  const { default: Page } = isHerbalGuidePath ? await import('./HerbAtlasApp.jsx')
    : isHerbalPath ? await import('./HerbalApp.jsx')
      : isGuidePath ? await import('./GuideApp.jsx') : await import('./App.jsx')
  const snapshot = document.getElementById('public-query-snapshot')
  if (snapshot) {
    for (const entry of JSON.parse(snapshot.textContent)) queryClient.setQueryData(entry.key, entry.data, { updatedAt: entry.updatedAt })
  }
  const content = <StrictMode><QueryClientProvider client={queryClient}><Page path={pathname} /><AnalyticsConsent collection={isHerbalPath ? 'herbs' : 'fungi'} /></QueryClientProvider></StrictMode>
  if ((isGuidePath || isHerbalGuidePath) && root.hasChildNodes()) hydrateRoot(root, content)
  else createRoot(root).render(content)
}
mount()
