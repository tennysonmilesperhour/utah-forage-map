import { speciesBySlug, speciesGuides } from '../content/species.generated'
import { regionBySlug, regions } from '../data/regions'

export const GUIDE_SITE_URL = 'https://worldmushroomforaging.org'

const FIXED_METADATA = {
  '/learn': {
    title: 'Mushroom Identification Guide | Field Marks, Lookalikes and Live Finds',
    description: 'Study 30 mushrooms with concise field marks, dangerous lookalike checks, licensed photos, cited safety guidance, and recent reviewed observations.',
  },
  '/learn/safety': {
    title: 'Wild Mushroom Safety and Poison Response | Mushroom Forage Map',
    description: 'Learn the non-negotiable rules of wild mushroom identification and what to do immediately after a suspected mushroom poisoning.',
  },
  '/regions': {
    title: 'Regional Mushroom Season Reports | Recent Finds and Seasonal Charts',
    description: 'Compare recent reviewed mushroom observations and all-time monthly patterns across ten forest and habitat regions worldwide.',
  },
  '/about': {
    title: 'About and Editorial Standards | Mushroom Forage Map',
    description: 'Learn how Mushroom Forage Map separates observations from identification, protects locations, cites guide content, and marks review status.',
  },
  '/disclaimer': {
    title: 'Identification and Foraging Disclaimer | Mushroom Forage Map',
    description: 'Understand the limits of map observations, species guide content, photos, edibility labels, and community review.',
  },
}

function normalizedPath(pathname) {
  if (!pathname || pathname === '/') return '/learn'
  return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
}

export function guideMetadataForPath(pathname) {
  const path = normalizedPath(pathname)
  const speciesMatch = path.match(/^\/learn\/species\/([^/]+)$/)
  if (speciesMatch) {
    const species = speciesBySlug[speciesMatch[1]]
    if (species) {
      return {
        path,
        title: `${species.common_name} Identification Guide | Lookalikes and Recent Finds`,
        description: `${species.summary} Compare field marks and lookalikes, then see recent reviewed ${species.common_name.toLowerCase()} observations.`,
        species,
      }
    }
  }
  const regionMatch = path.match(/^\/regions\/([^/]+)$/)
  if (regionMatch) {
    const region = regionBySlug[regionMatch[1]]
    if (region) {
      return {
        path,
        title: `${region.name} Mushroom Season Report | Recent Field Records`,
        description: `See recent reviewed mushroom observations, current field signals, and monthly seasonal evidence for ${region.name}.`,
        region,
      }
    }
  }
  return { path, ...(FIXED_METADATA[path] ?? FIXED_METADATA['/learn']) }
}

export function guideStructuredData(pathname) {
  const metadata = guideMetadataForPath(pathname)
  const canonical = `${GUIDE_SITE_URL}${metadata.path}`
  const website = {
    '@type': 'WebSite',
    '@id': `${GUIDE_SITE_URL}/#website`,
    url: `${GUIDE_SITE_URL}/`,
    name: 'Mushroom Forage Map',
  }
  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Mushroom guide', item: `${GUIDE_SITE_URL}/learn` },
  ]

  if (metadata.region) {
    breadcrumbItems[0] = { '@type': 'ListItem', position: 1, name: 'Regional collections', item: `${GUIDE_SITE_URL}/regions` }
    breadcrumbItems.push({ '@type': 'ListItem', position: 2, name: metadata.region.name, item: canonical })
    return {
      '@context': 'https://schema.org',
      '@graph': [website, {
        '@type': 'CollectionPage',
        name: metadata.title,
        description: metadata.description,
        url: canonical,
        about: { '@type': 'Place', name: metadata.region.name },
        isPartOf: { '@id': website['@id'] },
        mainEntity: {
          '@type': 'Dataset',
          name: `${metadata.region.name} public mushroom observation summary`,
          description: 'Recent public field records and all-time monthly counts from research-grade iNaturalist observations.',
          spatialCoverage: metadata.region.name,
          measurementTechnique: 'Reviewed public observations aggregated by date and region',
          creator: { '@type': 'Organization', name: 'Mushroom Forage Map' },
        },
      }, { '@type': 'BreadcrumbList', itemListElement: breadcrumbItems }],
    }
  }

  if (!metadata.species) {
    return {
      '@context': 'https://schema.org',
      '@graph': [website, {
        '@type': metadata.path === '/learn' ? 'CollectionPage' : 'WebPage',
        name: metadata.title,
        description: metadata.description,
        url: canonical,
        isPartOf: { '@id': website['@id'] },
      }],
    }
  }

  breadcrumbItems.push({
    '@type': 'ListItem', position: 2, name: metadata.species.common_name, item: canonical,
  })
  return {
    '@context': 'https://schema.org',
    '@graph': [website, {
      '@type': 'Article',
      headline: `${metadata.species.common_name} identification guide`,
      description: metadata.description,
      url: canonical,
      mainEntityOfPage: canonical,
      author: { '@type': 'Organization', name: metadata.species.author },
      dateModified: metadata.species.last_reviewed,
      image: {
        '@type': 'ImageObject',
        contentUrl: metadata.species.image.url,
        caption: metadata.species.image.alt,
        creditText: metadata.species.image.credit,
        acquireLicensePage: metadata.species.image.source,
      },
      isPartOf: { '@id': website['@id'] },
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems,
    }],
  }
}

function setMeta(selector, attribute, value) {
  const element = document.head.querySelector(selector)
  if (element) element.setAttribute(attribute, value)
}

export function applyGuideMetadata(pathname) {
  const metadata = guideMetadataForPath(pathname)
  const canonical = `${GUIDE_SITE_URL}${metadata.path}`
  document.title = metadata.title
  setMeta('meta[name="description"]', 'content', metadata.description)
  setMeta('meta[property="og:title"]', 'content', metadata.title)
  setMeta('meta[property="og:description"]', 'content', metadata.description)
  setMeta('meta[property="og:url"]', 'content', canonical)
  setMeta('meta[property="og:type"]', 'content', metadata.species ? 'article' : 'website')
  setMeta('meta[name="twitter:title"]', 'content', metadata.title)
  setMeta('meta[name="twitter:description"]', 'content', metadata.description)
  setMeta('link[rel="canonical"]', 'href', canonical)

  let script = document.head.querySelector('#guide-structured-data')
  if (!script) {
    script = document.createElement('script')
    script.id = 'guide-structured-data'
    script.type = 'application/ld+json'
    document.head.append(script)
  }
  script.textContent = JSON.stringify(guideStructuredData(pathname))
}

export function guideRoutes() {
  return [
    '/learn',
    ...speciesGuides.map(species => `/learn/species/${species.slug}`),
    '/learn/safety',
    '/regions',
    ...regions.map(region => `/regions/${region.slug}`),
    '/about',
    '/disclaimer',
  ]
}
