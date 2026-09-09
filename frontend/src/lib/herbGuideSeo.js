import { herbAtlasRoute, herbGuidePath, herbGuides, herbRegions, HERB_ATLAS_PATH, GUIDE_CHECKED } from '../data/herbGuide'
import { SITE_URL, siteEntities, breadcrumb, applyMetadata } from './siteIdentity'
export function herbGuideRoutes() { return [HERB_ATLAS_PATH, `${HERB_ATLAS_PATH}/compare`, '/herbs/regions', ...herbRegions.map(r => `/herbs/regions/${r.slug}`), '/herbs/fieldcraft', ...herbGuides.map(herbGuidePath)] }
export function herbGuideMetadata(pathname) {
  const path = pathname.replace(/\/$/, '')
  const route = herbAtlasRoute(path)
  let title = 'Global Herb Gathering Atlas | The Verdant Hours'
  let description = 'Explore 44 plant profiles, six regional collections, toxic lookalikes and practical field skills in the herbal gathering reference guide.'
  if (route.plant) { title = `${route.plant.name} Identification & Foraging Guide | The Verdant Hours`; description = `${route.plant.summary} Read identification notes, local-season context, safety cautions and botanical sources.` }
  else if (route.region) { title = `${route.region.name} Herbal Reference | The Verdant Hours`; description = route.region.description }
  else if (route.type === 'regions') { title = 'Regional Herb Guides | The Verdant Hours'; description = 'Explore six world regions with selected plant references, climate context and local botanical sources.' }
  else if (route.type === 'compare') { title = 'Compare Herb Field Marks & Lookalikes | The Verdant Hours'; description = 'Compare two botanical reference profiles side by side, with safety, habitat, season and preparation notes.' }
  else if (route.type === 'fieldcraft') { title = 'Herb Gathering Field Skills & Safety | The Verdant Hours'; description = 'A field manual for plant identification, regional seasons, responsible gathering, food preparation, storage and poison response.' }
  else if (route.type === 'missing') { title = 'Plant Page Not Found | The Verdant Hours'; description = 'Find a plant by common or scientific name in the herbal atlas.' }
  return { path, title, description, image: `${SITE_URL}${route.plant?.photos[0]?.url || '/images/herbs/forest-immersion.webp'}`, missing: route.type === 'missing', noindex: route.type === 'compare', plant: route.plant }
}
export function herbGuideStructuredData(path) {
  const meta = herbGuideMetadata(path)
  const canonical = `${SITE_URL}${meta.path}`
  const items = [['Herb gathering', '/herbs'], ['Plant atlas', HERB_ATLAS_PATH]]
  if (meta.path !== HERB_ATLAS_PATH) items.push([meta.plant?.name || meta.title, meta.path])
  const page = {
    '@type': meta.plant ? 'Article' : 'CollectionPage', '@id': `${canonical}#page`,
    headline: meta.title, name: meta.title, description: meta.description,
    url: canonical, mainEntityOfPage: canonical, inLanguage: 'en', image: meta.image,
    dateModified: GUIDE_CHECKED, isAccessibleForFree: true,
    isPartOf: { '@id': `${SITE_URL}/#website` }, publisher: { '@id': `${SITE_URL}/#organization` },
    ...(meta.plant ? {
      author: { '@type': 'Organization', name: 'The Verdant Hours field desk', url: `${SITE_URL}/about#editorial` },
      about: { '@type': 'Thing', name: meta.plant.latin, alternateName: meta.plant.name },
      citation: meta.plant.sources.map(source => source.url),
    } : {}),
  }
  return { '@context': 'https://schema.org', '@graph': [...siteEntities(), page, breadcrumb(items)] }
}
export function applyHerbGuideMetadata(path) {
  applyMetadata(herbGuideMetadata(path), herbGuideStructuredData(path))
}
