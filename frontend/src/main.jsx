import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import GuideApp from './GuideApp.jsx'
import { initGoogleTag } from './lib/googleTag'
import { initAdSense } from './lib/adsense'

// Load Google Ads/GA and AdSense tags. Both are no-ops unless their env vars
// are configured, so nothing loads until the integration is switched on.
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
const isGuidePath = pathname === '/learn' || pathname.startsWith('/learn/') || pathname === '/regions' || pathname.startsWith('/regions/') || pathname === '/about' || pathname === '/disclaimer'
const content = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {isGuidePath ? <GuideApp path={pathname} /> : <App />}
    </QueryClientProvider>
  </StrictMode>
)

if (isGuidePath && root.hasChildNodes()) hydrateRoot(root, content)
else createRoot(root).render(content)
