export const SITE_URL = 'https://worldmushroomforaging.org'

const PAGE_METADATA = {
  map: {
    path: '/',
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
  herbs: {
    path: '/herbs',
    title: 'The Verdant Hours | Herbal Gathering Almanac',
    description: 'Explore a safety-led herbal field atlas with seasonal harvest windows, local weather, optional lunar tradition, private watch zones, gathered inventory, and a wish list.',
  },
}

export function viewFromPathname(pathname) {
  if (pathname === '/herbs' || pathname.startsWith('/herbs/')) return 'herbs'
  if (pathname === '/field-guide' || pathname.startsWith('/field-guide/')) return 'guide'
  if (pathname === '/community' || pathname.startsWith('/community/')) return 'community'
  return 'map'
}

export function pathForView(view) {
  return PAGE_METADATA[view]?.path ?? '/'
}

export function pageMetadataForPath(pathname) {
  return PAGE_METADATA[viewFromPathname(pathname)] ?? PAGE_METADATA.map
}

export function pageStructuredDataForPath(pathname) {
  if (viewFromPathname(pathname) !== 'herbs') return null
  return {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'WebApplication',
      name: 'The Verdant Hours',
      url: `${SITE_URL}/herbs`,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Any',
      isAccessibleForFree: true,
      description: PAGE_METADATA.herbs.description,
      featureList: [
        'Seasonal herbal field atlas',
        'Local weather gathering signals',
        'Astronomical moon phase and lunar sign',
        'Private herb watch zones',
        'Gathered inventory and wish list',
      ],
    }, {
      '@type': 'CollectionPage',
      name: 'Herbal gathering atlas',
      url: `${SITE_URL}/herbs`,
      description: PAGE_METADATA.herbs.description,
      about: { '@type': 'Thing', name: 'Responsible herbal foraging' },
      isPartOf: { '@id': `${SITE_URL}/#website` },
    }],
  }
}

function setMeta(selector, attribute, value) {
  const element = document.head.querySelector(selector)
  if (element) element.setAttribute(attribute, value)
}

export function applyPageMetadata(view) {
  const metadata = PAGE_METADATA[view] ?? PAGE_METADATA.map
  const canonicalUrl = `${SITE_URL}${metadata.path}`
  document.title = metadata.title
  setMeta('meta[name="description"]', 'content', metadata.description)
  setMeta('meta[property="og:title"]', 'content', metadata.title)
  setMeta('meta[property="og:description"]', 'content', metadata.description)
  setMeta('meta[property="og:url"]', 'content', canonicalUrl)
  setMeta('meta[name="twitter:title"]', 'content', metadata.title)
  setMeta('meta[name="twitter:description"]', 'content', metadata.description)
  setMeta('link[rel="canonical"]', 'href', canonicalUrl)
}
