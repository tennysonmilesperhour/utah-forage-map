import { next } from '@vercel/functions'
import { classify } from './server/agent-bots.js'

const SITE = 'https://worldmushroomforaging.org'
const LOG_URL = process.env.AGENT_LOG_URL || 'https://utah-forage-api.vercel.app/api/agent-log'

export const config = {
  matcher: '/((?!assets/|images/|icons/|favicon).*)',
}

// Logs known AI crawlers, assistants and tools (never people's browsers) to the traffic table through
// the API, and points markdown twins back to their canonical HTML page.
export default function middleware(request, context) {
  const url = new URL(request.url)
  const hit = classify(request.headers.get('user-agent'), url.pathname)
  const secret = process.env.AGENT_LOG_SECRET
  if (hit && secret) {
    context.waitUntil(fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Log-Key': secret },
      body: JSON.stringify({ ...hit, path: url.pathname, user_agent: request.headers.get('user-agent') ?? '' }),
    }).catch(() => {}))
  }
  if (url.pathname.endsWith('.md') && !url.pathname.startsWith('/reference/')) {
    const canonical = url.pathname === '/index.md' ? `${SITE}/` : `${SITE}${url.pathname.slice(0, -3)}`
    return next({ headers: { Link: `<${canonical}>; rel="canonical"`, 'Content-Type': 'text/markdown; charset=utf-8' } })
  }
  return next()
}
