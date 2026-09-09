import { CACHE_SECONDS, cachedObservations, parseSearch } from '../server/herb-observations.js'

export default async function handler(request, response) {
  response.setHeader('X-Robots-Tag', 'noindex')
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Use GET to read observations.' })
  }
  let search
  try { search = parseSearch(new URL(request.url, 'https://worldmushroomforaging.org').searchParams) }
  catch (error) { return response.status(400).json({ error: error.message }) }
  try {
    const data = await cachedObservations(search)
    response.setHeader('Cache-Control', 'public, max-age=60')
    response.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`)
    return response.status(200).json(data)
  } catch (error) {
    response.setHeader('Retry-After', '60')
    return response.status(503).json({ error: error.name === 'TimeoutError' ? 'The observation source is taking too long. Please try again.' : error.message })
  }
}
