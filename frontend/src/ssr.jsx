import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import GuideApp from './GuideApp.jsx'
import HerbAtlasApp from './HerbAtlasApp.jsx'
import App from './App.jsx'
import HerbalApp from './HerbalApp.jsx'
export { herbGuideRoutes, herbGuideMetadata, herbGuideStructuredData } from './lib/herbGuideSeo'
import AnalyticsConsent from './components/AnalyticsConsent.jsx'
import { guideMetadataForPath, guideRoutes, guideStructuredData } from './lib/guideSeo'
import { pageMetadataForPath, pageStructuredDataForPath } from './lib/seo'

export function renderGuide(path, snapshot = []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  for (const entry of snapshot) queryClient.setQueryData(entry.key, entry.data, { updatedAt: entry.updatedAt })
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <GuideApp path={path} />
      <AnalyticsConsent />
    </QueryClientProvider>,
  )
}

export function renderApp(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToString(<QueryClientProvider client={queryClient}>{path === '/herbs' ? <HerbalApp /> : <App path={path} />}</QueryClientProvider>)
}

export { guideMetadataForPath, guideRoutes, guideStructuredData, pageMetadataForPath, pageStructuredDataForPath }

export function renderHerbGuide(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToString(<QueryClientProvider client={queryClient}><HerbAtlasApp path={path} /><AnalyticsConsent collection="herbs" /></QueryClientProvider>)
}
