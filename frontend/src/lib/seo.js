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
}

export function viewFromPathname(pathname) {
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
