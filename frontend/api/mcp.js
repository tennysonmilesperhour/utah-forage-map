import { createServer, description } from '../server/mcp.js'

const server = createServer()
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, accept, mcp-protocol-version, mcp-session-id',
}

export default async function handler(request, response) {
  for (const [key, value] of Object.entries(CORS)) response.setHeader(key, value)
  response.setHeader('Cache-Control', 'no-store')
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method === 'GET') return response.status(200).json(description)
  if (request.method !== 'POST') return response.status(405).setHeader('Allow', 'GET, POST, OPTIONS').json({ error: 'Use POST with a JSON-RPC message.' })
  let payload = request.body
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload) } catch { payload = undefined }
  }
  if (payload === undefined || payload === null || typeof payload !== 'object') {
    return response.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
  }
  const { status, body } = await server.handleBody(payload)
  if (body === null) return response.status(status).end()
  return response.status(status).json(body)
}
