import herbObservations from '../api/herb-observations.js'
import visitorCountry from '../api/visitor-country.js'

const handlers = new Map([
  ['/herb-observations', herbObservations],
  ['/visitor-country', visitorCountry],
])

// Vite does not execute Vercel functions or rewrites. Reuse the deployed
// handlers locally before Vite's HTML fallback can swallow these requests.
export function localMapApiMiddleware(request, response, next) {
  const handler = handlers.get(new URL(request.url, 'http://localhost').pathname)
  if (!handler) return next()
  response.status = code => { response.statusCode = code; return response }
  response.json = data => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(data))
  }
  Promise.resolve().then(() => handler(request, response)).catch(next)
}

export function localMapApi() {
  const configure = server => { server.middlewares.use(localMapApiMiddleware) }
  return {
    name: 'local-map-api',
    configureServer: configure,
    configurePreviewServer: configure,
  }
}
