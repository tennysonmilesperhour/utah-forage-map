import { herbAtlasRoute, herbGuidePath, herbGuides, herbRegions, HERB_ATLAS_PATH, GUIDE_CHECKED } from '../data/herbGuide'
import { SITE_URL } from './seo'
export function herbGuideRoutes() { return [HERB_ATLAS_PATH, `${HERB_ATLAS_PATH}/compare`, '/herbs/regions', ...herbRegions.map(r => `/herbs/regions/${r.slug}`), '/herbs/fieldcraft', ...herbGuides.map(herbGuidePath)] }
export function herbGuideMetadata(pathname) {
  const path = pathname.replace(/\/$/, '')
  const route = herbAtlasRoute(path)
  let title = 'Global Herb Gathering Atlas | The Verdant Hours'
  let description = 'Explore 44 plant profiles, six regional collections, toxic lookalikes and practical field skills in the herbal gathering reference guide.'
  if (route.plant) { title = `${route.plant.name} | Field Marks, Lookalikes & Care`; description = `${route.plant.summary} Read identification notes, local-season context, safety cautions and botanical sources.` }
  else if (route.region) { title = `${route.region.name} Herbal Reference | The Verdant Hours`; description = route.region.description }
  else if (route.type === 'regions') { title = 'Regional Herb Guides | The Verdant Hours'; description = 'Explore six world regions with selected plant references, climate context and local botanical sources.' }
  else if (route.type === 'compare') { title = 'Compare Herb Field Marks & Lookalikes | The Verdant Hours'; description = 'Compare two botanical reference profiles side by side, with safety, habitat, season and preparation notes.' }
  else if (route.type === 'fieldcraft') { title = 'Herb Gathering Field Skills & Safety | The Verdant Hours'; description = 'A field manual for plant identification, regional seasons, responsible gathering, food preparation, storage and poison response.' }
  else if (route.type === 'missing') { title = 'Plant Page Not Found | The Verdant Hours'; description = 'Find a plant by common or scientific name in the herbal atlas.' }
  return { path, title, description, image: `${SITE_URL}${route.plant?.photos[0]?.url || '/images/herbs/hoh-rainforest-griffin-quinn.webp'}`, missing: route.type === 'missing', plant: route.plant }
}
export function herbGuideStructuredData(path) {
  const meta = herbGuideMetadata(path)
  return { '@context': 'https://schema.org', '@type': meta.plant ? 'Article' : 'CollectionPage', headline: meta.title, name: meta.title, description: meta.description, url: `${SITE_URL}${meta.path}`, dateModified: GUIDE_CHECKED, isAccessibleForFree: true, ...(meta.plant ? { about: { '@type': 'Thing', name: meta.plant.latin, alternateName: meta.plant.name }, citation: meta.plant.sources.map(s => s.url) } : {}) }
}
export function applyHerbGuideMetadata(path) {
  const meta = herbGuideMetadata(path)
  document.title = meta.title
  for (const [attribute, key] of [['property', 'og:image'], ['name', 'twitter:image']]) {
    if (!document.head.querySelector(`meta[${attribute}="${key}"]`)) {
      const imageMeta = document.createElement('meta'); imageMeta.setAttribute(attribute, key); document.head.appendChild(imageMeta)
    }
  }
  for (const [selector, attribute, value] of [['meta[name="description"]', 'content', meta.description], ['meta[property="og:title"]', 'content', meta.title], ['meta[property="og:description"]', 'content', meta.description], ['meta[property="og:url"]', 'content', `${SITE_URL}${meta.path}`], ['meta[property="og:image"]', 'content', meta.image], ['meta[name="twitter:image"]', 'content', meta.image], ['link[rel="canonical"]', 'href', `${SITE_URL}${meta.path}`]]) document.head.querySelector(selector)?.setAttribute(attribute, value)
  let structured = document.getElementById('herb-guide-structured-data')
  if (!structured) { structured = document.createElement('script'); structured.type = 'application/ld+json'; structured.id = 'herb-guide-structured-data'; document.head.appendChild(structured) }
  structured.textContent = JSON.stringify(herbGuideStructuredData(path))
  if (meta.missing) { const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex'; document.head.appendChild(robots) }
}
