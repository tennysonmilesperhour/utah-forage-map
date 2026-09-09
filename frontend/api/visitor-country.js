export default function handler(request, response) {
  const value = request.headers['x-vercel-ip-country']
  const country = typeof value === 'string' && /^[A-Z]{2}$/.test(value) && value !== 'ZZ' ? value : null
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('Vercel-CDN-Cache-Control', 'no-store')
  response.status(200).json({ country })
}
