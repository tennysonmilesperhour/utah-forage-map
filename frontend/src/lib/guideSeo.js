import { foragingGuides, foragingBySlug } from '../content/foraging.generated'
import { speciesBySlug, speciesGuides } from '../content/species.generated'
import { regionBySlug, regions } from '../data/regions'

import { SITE_URL, DEFAULT_IMAGE, siteEntities, applyMetadata, breadcrumb } from './siteIdentity'
export const GUIDE_SITE_URL = SITE_URL

const DATASET_CREATOR = {
  '@type': 'Organization',
  '@id': `${GUIDE_SITE_URL}/#organization`,
  name: 'Mushroom Forage Map',
  url: `${GUIDE_SITE_URL}/`,
}

const DATASET_LICENSE = {
  '@type': 'CreativeWork',
  name: 'Mushroom Forage Map data reuse notice',
  url: `${GUIDE_SITE_URL}/about#data-license`,
}

const FIXED_METADATA = {
  '/learn/foraging': { title: 'Mushroom & Wild Herb Foraging Guides | Field Skills', description: 'Practical guides to mushroom identification, seasonal records, wild herb gathering, poisonous lookalikes, land access, and documenting finds.' },
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
  '/privacy': {
    title: 'Privacy and Analytics | Mushroom Forage Map',
    description: 'Learn how Mushroom Forage Map handles optional Google Analytics, account information, public observations, and private mushroom locations.',
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
  const topicMatch = path.match(/^\/learn\/foraging\/([^/]+)$/)
  if (topicMatch && foragingBySlug[topicMatch[1]]) {
    const article = foragingBySlug[topicMatch[1]]
    return { path, title: `${article.title} | Mushroom Forage Map`, description: article.summary, article, image: DEFAULT_IMAGE }
  }
  const speciesMatch = path.match(/^\/learn\/species\/([^/]+)$/)
  if (speciesMatch) {
    const species = speciesBySlug[speciesMatch[1]]
    if (species) {
      return {
        path,
        title: `${species.common_name} Identification Guide | Lookalikes and Recent Finds`,
        description: `${species.summary} Compare field marks and lookalikes, then see recent reviewed ${species.common_name.toLowerCase()} observations.`,
        species,
        image: species.image.url,
        imageAlt: species.image.alt,
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
        region, image: DEFAULT_IMAGE,
      }
    }
  }
  return { path, image: DEFAULT_IMAGE, ...(FIXED_METADATA[path] ?? { title: 'Page Not Found | Mushroom Forage Map', description: 'Browse mushroom and wild herb field guides.', missing: true }) }
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

  if (metadata.article || metadata.path === '/learn/foraging') {
    const article = metadata.article
    return { '@context': 'https://schema.org', '@graph': [...siteEntities(), {
      '@type': article ? 'Article' : 'CollectionPage', '@id': `${canonical}#article`,
      name: metadata.title, headline: article?.title || metadata.title, description: metadata.description,
      url: canonical, mainEntityOfPage: canonical, image: DEFAULT_IMAGE,
      inLanguage: 'en', isAccessibleForFree: true, isPartOf: { '@id': website['@id'] },
      publisher: { '@id': `${SITE_URL}/#organization` },
      ...(article ? { author: { '@type': 'Organization', name: article.author, url: `${SITE_URL}/about#editorial` }, datePublished: article.published, dateModified: article.updated, citation: article.sources.map(source => source.url) } : { mainEntity: { '@type': 'ItemList', itemListElement: foragingGuides.map((guide, index) => ({ '@type': 'ListItem', position: index + 1, name: guide.title, url: `${SITE_URL}/learn/foraging/${guide.slug}` })) } }),
    }, breadcrumb([['Mushroom guide', '/learn'], ['Field skills', '/learn/foraging'], ...(article ? [[article.title, metadata.path]] : [])])] }
  }

  if (metadata.region) {
    breadcrumbItems[0] = { '@type': 'ListItem', position: 1, name: 'Regional collections', item: `${GUIDE_SITE_URL}/regions` }
    breadcrumbItems.push({ '@type': 'ListItem', position: 2, name: metadata.region.name, item: canonical })
    return {
      '@context': 'https://schema.org',
      '@graph': [...siteEntities(), {
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
          creator: DATASET_CREATOR,
          license: DATASET_LICENSE,
        },
      }, { '@type': 'BreadcrumbList', itemListElement: breadcrumbItems }],
    }
  }

  if (!metadata.species) {
    return {
      '@context': 'https://schema.org',
      '@graph': [...siteEntities(), {
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
    '@graph': [...siteEntities(), {
      '@type': 'Article',
      headline: `${metadata.species.common_name} identification guide`,
      description: metadata.description,
      url: canonical,
      mainEntityOfPage: canonical,
      author: { '@type': 'Organization', name: metadata.species.author, url: `${SITE_URL}/about#editorial` },
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en', isAccessibleForFree: true,
      citation: metadata.species.sources?.map(source => source.url),
      about: { '@type': 'Thing', name: metadata.species.latin_name, alternateName: metadata.species.common_name, sameAs: `https://www.inaturalist.org/taxa/${metadata.species.taxon_id}` },
      dateModified: metadata.species.last_updated || metadata.species.last_reviewed,
      image: {
        '@type': 'ImageObject',
        contentUrl: metadata.species.image.url,
        caption: metadata.species.image.alt,
        creditText: metadata.species.image.credit,
        creator: {
          '@type': 'Person',
          name: metadata.species.image.creator,
        },
        copyrightNotice: metadata.species.image.copyright_notice,
        license: metadata.species.image.license,
        acquireLicensePage: metadata.species.image.source,
      },
      isPartOf: { '@id': website['@id'] },
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems,
    }],
  }
}

export function applyGuideMetadata(pathname) {
  applyMetadata(guideMetadataForPath(pathname), guideStructuredData(pathname))
}

export function guideRoutes() {
  return [
    '/learn',
    '/learn/foraging',
    ...foragingGuides.map(guide => `/learn/foraging/${guide.slug}`),
    ...speciesGuides.map(species => `/learn/species/${species.slug}`),
    '/learn/safety',
    '/regions',
    ...regions.map(region => `/regions/${region.slug}`),
    '/about',
    '/privacy',
    '/disclaimer',
  ]
}
