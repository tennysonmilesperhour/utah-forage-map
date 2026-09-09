import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import GuideApp from './GuideApp.jsx'
import HerbAtlasApp from './HerbAtlasApp.jsx'
export { herbGuideRoutes, herbGuideMetadata, herbGuideStructuredData } from './lib/herbGuideSeo'
import AnalyticsConsent from './components/AnalyticsConsent.jsx'
import { guideMetadataForPath, guideRoutes, guideStructuredData } from './lib/guideSeo'
import { pageMetadataForPath, pageStructuredDataForPath } from './lib/seo'

export function renderGuide(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <GuideApp path={path} />
      <AnalyticsConsent />
    </QueryClientProvider>,
  )
}

export { guideMetadataForPath, guideRoutes, guideStructuredData, pageMetadataForPath, pageStructuredDataForPath }

export function renderHerbGuide(path) {
  return renderToString(<><HerbAtlasApp path={path} /><AnalyticsConsent collection="herbs" /></>)
}
