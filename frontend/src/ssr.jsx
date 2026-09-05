import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import GuideApp from './GuideApp.jsx'
import AnalyticsConsent from './components/AnalyticsConsent.jsx'
import { guideMetadataForPath, guideRoutes, guideStructuredData } from './lib/guideSeo'
import { pageMetadataForPath } from './lib/seo'

export function renderGuide(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <GuideApp path={path} />
      <AnalyticsConsent />
    </QueryClientProvider>,
  )
}

export { guideMetadataForPath, guideRoutes, guideStructuredData, pageMetadataForPath }
