import test from 'node:test'
import assert from 'node:assert/strict'
import { inaturalistUrl, photoSource } from '../src/lib/inaturalistImage.js'

const largeJpeg = 'https://inaturalist-open-data.s3.amazonaws.com/photos/167364677/large.jpg'
const largeJpegExt = 'https://inaturalist-open-data.s3.amazonaws.com/photos/10420482/large.jpeg'
const local = '/images/fungi/forest-floor-extended.webp'

test('cards and thumbs never request large or original iNaturalist files', () => {
  for (const variant of ['thumb', 'card']) {
    const source = photoSource(largeJpeg, variant)
    assert.doesNotMatch(source.src, /\/(large|original)\./)
    assert.doesNotMatch(source.srcSet, /\/(large|original)\./)
    assert.match(source.srcSet, /\/small\.jpg \d+w/)
  }
  assert.equal(photoSource(largeJpeg, 'card').src, largeJpeg.replace('/large.', '/medium.'))
  assert.match(photoSource(largeJpeg, 'thumb').src, /\/small\.jpg$/)
})

test('detail views keep the large derivative and offer a medium fallback', () => {
  const source = photoSource(largeJpegExt, 'detail')
  assert.equal(source.src, largeJpegExt)
  assert.match(source.srcSet, /\/medium\.jpeg 500w/)
  assert.match(source.srcSet, /\/large\.jpeg 1024w/)
  assert.doesNotMatch(source.srcSet, /\/original\./)
})

test('size swaps keep the original extension and ignore non-iNaturalist urls', () => {
  assert.equal(inaturalistUrl(largeJpegExt, 'small'), largeJpegExt.replace('/large.', '/small.'))
  assert.equal(photoSource(local, 'card').src, local)
  assert.equal(photoSource(local, 'card').srcSet, undefined)
  assert.equal(inaturalistUrl('https://example.com/photos/1/large.jpg', 'small'), 'https://example.com/photos/1/large.jpg')
})
