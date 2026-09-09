import { SITE_URL, DEFAULT_IMAGE, HERB_IMAGE, FUNGI_LIBRARY_METADATA, siteEntities, applyMetadata } from './siteIdentity'
export { SITE_URL } from './siteIdentity'

const PAGE_METADATA = {
  library: FUNGI_LIBRARY_METADATA,
  supporters: { path: '/supporters', title: 'Optional Support | World Mushroom Foraging', description: 'All fungi and herb guides, maps and field tools stay free. Optional annual support includes small thank-yous, including forty pocket poems.' },
  map: {
    path: '/map',
    title: 'Worldwide Mushroom Forage Map | Recent Reviewed Observations',
    description: 'Explore privacy-safe, reviewed mushroom observations worldwide. Filter recent finds by species, season, habitat, elevation, and place without creating an account.',
  },
  community: {
    path: '/community',
    title: 'Mushroom Foraging Community | Recent Finds, Events and Groups',
    description: 'See recent reviewed mushroom observations, discover upcoming foraging events and groups, and contribute field knowledge to the worldwide map.',
  },
  guide: {
    path: '/field-guide',
    title: 'Mushroom Field Guide | Map Safety, Privacy and Data Sources',
    description: 'Learn how to read the mushroom forage map, check access rules, understand location privacy, evaluate reviewed observations, and forage more responsibly.',
  },
  herbMap: {
    path: '/herbs/map',
    title: 'Global Herb Foraging Map | Wild Plant Observations',
    description: 'Explore real, publicly shared wild herb observations worldwide. Search by country, plant, date and month, with 44 atlas profiles, source credits and location privacy.',
  },
  herbs: {
    path: '/herbs',
    title: 'Wild Herb Foraging Guide & Plant Atlas | The Verdant Hours',
    description: 'Explore 44 wild plant profiles, toxic lookalikes, regional seasons, and responsible herb gathering. Plan field visits with The Verdant Hours almanac.',
  },
}

export function viewFromPathname(pathname) {
  if (pathname === '/' || /^\/learn\/?$/.test(pathname)) return 'library'
  if (/^\/supporters\/?$/.test(pathname)) return 'supporters'
  if (/^\/herbs\/map\/?$/.test(pathname)) return 'herbMap'
  if (pathname === '/herbs' || pathname.startsWith('/herbs/')) return 'herbs'
  if (pathname === '/field-guide' || pathname.startsWith('/field-guide/')) return 'guide'
  if (pathname === '/community' || pathname.startsWith('/community/')) return 'community'
  return 'map'
}

export function pathForView(view) {
  return PAGE_METADATA[view]?.path ?? '/'
}

export function pageMetadataForPath(pathname) {
  const metadata = PAGE_METADATA[viewFromPathname(pathname)] ?? PAGE_METADATA.map
  return { ...metadata, image: metadata.path.startsWith('/herbs') ? HERB_IMAGE : DEFAULT_IMAGE }
}

export function pageStructuredDataForPath(pathname) {
  const metadata = pageMetadataForPath(pathname)
  const herbs = metadata.path.startsWith('/herbs')
  const canonical = `${SITE_URL}${metadata.path}`
  const page = {
    '@type': ['/', '/community'].includes(metadata.path) ? 'CollectionPage' : 'WebPage',
    '@id': `${canonical}#webpage`, name: metadata.title, description: metadata.description,
    url: canonical, inLanguage: 'en', isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` }, isAccessibleForFree: true,
  }
  const graph = [...siteEntities(), page]
  if (herbs || metadata.path === '/map') graph.push({
    '@type': 'WebApplication', '@id': `${canonical}#application`,
    name: herbs ? 'The Verdant Hours' : 'Mushroom Forage Map', url: canonical,
    description: metadata.description, applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any', isAccessibleForFree: true,
    publisher: { '@id': `${SITE_URL}/#organization` },
    featureList: herbs ? ['Global wild plant observation map', 'Wild herb field atlas', 'Regional plant references', 'Seasonal almanac', 'Private watch zones and pantry'] : ['Worldwide mushroom observation map', 'Country opening view', 'Species and date filters', 'Privacy-safe public records'],
  })
  if (metadata.path === '/map') graph.push({
    '@type': 'Dataset', '@id': `${SITE_URL}/#dataset`, name: 'Recent public mushroom observations',
    description: 'Reviewed public mushroom records with dates, source attribution, species and privacy-safe locality. Coverage varies by place and observation effort.',
    url: canonical, creator: { '@id': `${SITE_URL}/#organization` },
    license: `${SITE_URL}/about#data-license`, isAccessibleForFree: true,
    spatialCoverage: { '@type': 'Place', name: 'Worldwide' },
  })
  return { '@context': 'https://schema.org', '@graph': graph }
}

export function applyPageMetadata(view) {
  const metadata = pageMetadataForPath(PAGE_METADATA[view]?.path || '/')
  const params = new URLSearchParams(window.location.search)
  const privatePage = window.location.pathname === '/account' || ['reset', 'verify', 'follow', 'checkout', 'session_id', 'billing'].some(key => params.has(key))
  applyMetadata({ ...metadata, noindex: privatePage }, pageStructuredDataForPath(metadata.path))
}
