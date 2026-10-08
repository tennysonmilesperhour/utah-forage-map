import { photoSource } from '../lib/inaturalistImage'

export default function FieldPhoto({ url, alt = '', variant = 'card', priority = false, eager = false, sizes, width, height, onError }) {
  if (!url) return null
  const source = photoSource(url, variant)
  const immediate = priority || eager
  return (
    <img
      src={source.src}
      srcSet={source.srcSet}
      sizes={source.srcSet ? (sizes || source.sizes) : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={immediate ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding={priority ? 'auto' : 'async'}
      onError={onError}
    />
  )
}
