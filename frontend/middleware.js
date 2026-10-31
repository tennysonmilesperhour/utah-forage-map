import { next } from '@vercel/functions'
import { classify } from './server/agent-bots.js'

const SITE = 'https://worldmushroomforaging.org'
const LOG_URL = process.env.AGENT_LOG_URL || 'https://utah-forage-api.vercel.app/api/agent-log'

export const config = {
  matcher: '/((?!assets/|images/|icons/|favicon).*)',
}

// Name of the MCP tool in a tools/call request (never its arguments), or null.
export async function mcpToolName(request) {
  if (request.method !== 'POST') return null
  try {
    const payload = await request.json()
    const call = (Array.isArray(payload) ? payload : [payload]).find(message => message?.method === 'tools/call')
    const name = typeof call?.params?.name === 'string' ? call.params.name.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 60) : ''
    return name || null
  } catch {
    return null
  }
}

// Logs known AI crawlers, assistants and tools (never people's browsers) to the traffic table through
// the API, and points markdown twins back to their canonical HTML page.
export default function middleware(request, context) {
  const url = new URL(request.url)
  const hit = classify(request.headers.get('user-agent'), url.pathname)
  const secret = process.env.AGENT_LOG_SECRET
  if (hit && secret) {
    const copy = url.pathname === '/mcp' ? request.clone() : null
    context.waitUntil((async () => {
      const mcp_tool = copy ? await mcpToolName(copy) : null
      await fetch(LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agent-Log-Key': secret },
        body: JSON.stringify({ ...hit, path: url.pathname, user_agent: request.headers.get('user-agent') ?? '', ...(mcp_tool && { mcp_tool }) }),
      })
    })().catch(() => {}))
  }
  if (url.pathname.endsWith('.md') && !url.pathname.startsWith('/reference/')) {
    const canonical = url.pathname === '/index.md' ? `${SITE}/` : `${SITE}${url.pathname.slice(0, -3)}`
    return next({ headers: { Link: `<${canonical}>; rel="canonical"`, 'Content-Type': 'text/markdown; charset=utf-8' } })
  }
  return next()
}
