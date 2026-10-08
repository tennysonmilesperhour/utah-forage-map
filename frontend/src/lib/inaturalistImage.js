// iNaturalist derivative widths: https://www.inaturalist.org/pages/api+reference
const HOST = /^https:\/\/(?:static\.inaturalist\.org|inaturalist-open-data\.s3(?:\.us-east-1)?\.amazonaws\.com)\//i
const SIZE = /\/(square|thumb|small|medium|large|original)(\.[a-z0-9]+)(?=$|[?#])/i

const WIDTH = { square: 75, thumb: 100, small: 240, medium: 500, large: 1024 }

const VARIANTS = {
  thumb: { fallback: 'small', sizes: ['thumb', 'small'], layout: '72px' },
  card: { fallback: 'medium', sizes: ['small', 'medium'], layout: '(max-width: 800px) 92vw, 420px' },
  detail: { fallback: 'large', sizes: ['medium', 'large'], layout: '100vw' },
}

export function isInaturalistPhoto(url) {
  return typeof url === 'string' && HOST.test(url) && SIZE.test(url)
}

export function inaturalistUrl(url, size) {
  if (!isInaturalistPhoto(url) || !WIDTH[size]) return url
  return url.replace(SIZE, `/${size}$2`)
}

export function photoSource(url, variant = 'card') {
  const spec = VARIANTS[variant] || VARIANTS.card
  if (!isInaturalistPhoto(url)) return { src: url || '' }
  return {
    src: inaturalistUrl(url, spec.fallback),
    srcSet: spec.sizes.map(size => `${inaturalistUrl(url, size)} ${WIDTH[size]}w`).join(', '),
    sizes: spec.layout,
  }
}
