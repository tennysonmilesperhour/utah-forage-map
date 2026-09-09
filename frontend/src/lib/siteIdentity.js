export const SITE_URL = 'https://worldmushroomforaging.org'
export const SITE_NAME = 'Mushroom Forage Map'
export const SUPPORT_EMAIL = 'morphiclabsdata@gmail.com'
export const DEFAULT_IMAGE = `${SITE_URL}/images/fungi/forest-floor-extended.webp`
export const HERB_IMAGE = `${SITE_URL}/images/herbs/forest-immersion.webp`

export function siteEntities() {
  return [{
    '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME,
    url: `${SITE_URL}/`, email: SUPPORT_EMAIL,
    publishingPrinciples: `${SITE_URL}/about#editorial`,
    correctionsPolicy: `${SITE_URL}/about#corrections`,
    contactPoint: { '@type': 'ContactPoint', contactType: 'Editorial corrections and support', email: SUPPORT_EMAIL },
  }, {
    '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: SITE_NAME,
    alternateName: 'World Mushroom Foraging', url: `${SITE_URL}/`, inLanguage: 'en',
    publisher: { '@id': `${SITE_URL}/#organization` },
    description: 'A worldwide mushroom observation map, mushroom field guides, and The Verdant Hours wild herb atlas.',
  }]
}

export function breadcrumb(items) {
  return { '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], index) => ({
    '@type': 'ListItem', position: index + 1, name, item: `${SITE_URL}${path}`,
  })) }
}

export function applyMetadata(metadata, structuredData) {
  const canonical = `${SITE_URL}${metadata.path}`
  const image = metadata.image || DEFAULT_IMAGE
  document.title = metadata.title
  const tags = [
    ['name', 'description', metadata.description],
    ['name', 'robots', metadata.noindex || metadata.missing ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'],
    ['property', 'og:type', metadata.article || metadata.species || metadata.plant ? 'article' : 'website'],
    ['property', 'og:site_name', SITE_NAME], ['property', 'og:title', metadata.title],
    ['property', 'og:description', metadata.description], ['property', 'og:url', canonical],
    ['property', 'og:image', image], ['property', 'og:image:alt', metadata.imageAlt || metadata.title],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', metadata.title],
    ['name', 'twitter:description', metadata.description], ['name', 'twitter:image', image],
    ['name', 'twitter:image:alt', metadata.imageAlt || metadata.title],
  ]
  for (const [attribute, name, content] of tags) {
    let tag = document.head.querySelector(`meta[${attribute}="${name}"]`)
    if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attribute, name); document.head.appendChild(tag) }
    tag.content = content
  }
  document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach(tag => tag.remove())
  if (structuredData) {
    const tag = document.createElement('script')
    tag.id = 'page-structured-data'; tag.type = 'application/ld+json'; tag.textContent = JSON.stringify(structuredData)
    document.head.appendChild(tag)
  }
}
