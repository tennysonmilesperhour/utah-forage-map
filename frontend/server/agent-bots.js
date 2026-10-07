// Classifies requests from known AI crawlers, assistants, search and SEO bots and generic HTTP
// tools. People's browsers are never classified, so they are never logged.
export const KNOWN_BOTS = [
  ['GPTBot', 'training', /GPTBot/i], ['OAI-SearchBot', 'search', /OAI-SearchBot/i], ['ChatGPT-User', 'assistant', /ChatGPT-User/i],
  ['ClaudeBot', 'training', /ClaudeBot/i], ['Claude-SearchBot', 'search', /Claude-SearchBot/i], ['Claude-User', 'assistant', /Claude-User/i],
  ['anthropic-ai', 'training', /anthropic-ai/i], ['PerplexityBot', 'search', /PerplexityBot/i], ['Perplexity-User', 'assistant', /Perplexity-User/i],
  ['Googlebot', 'search', /Googlebot|Google-InspectionTool|Storebot-Google/i], ['GoogleOther', 'training', /GoogleOther|Google-Extended|Google-CloudVertexBot/i],
  ['Gemini-Deep-Research', 'assistant', /Gemini-Deep-Research/i], ['Bingbot', 'search', /bingbot|BingPreview/i],
  ['Applebot', 'search', /Applebot/i], ['CCBot', 'training', /CCBot/i], ['Meta-ExternalAgent', 'training', /meta-externalagent|FacebookBot/i],
  ['Meta-ExternalFetcher', 'assistant', /meta-externalfetcher/i], ['Bytespider', 'training', /Bytespider/i], ['Amazonbot', 'search', /Amazonbot/i],
  ['DuckAssistBot', 'assistant', /DuckAssistBot/i], ['DuckDuckBot', 'search', /DuckDuckBot/i], ['YouBot', 'assistant', /YouBot/i],
  ['MistralAI-User', 'assistant', /MistralAI-User/i], ['Diffbot', 'training', /Diffbot/i], ['cohere-ai', 'training', /cohere-(ai|training-data-crawler)/i],
  ['ImagesiftBot', 'training', /ImagesiftBot/i], ['PetalBot', 'search', /PetalBot/i], ['YandexBot', 'search', /YandexBot/i], ['Baiduspider', 'search', /Baiduspider/i],
  ['SemrushBot', 'seo', /SemrushBot/i], ['AhrefsBot', 'seo', /AhrefsBot/i], ['MJ12bot', 'seo', /MJ12bot/i], ['DotBot', 'seo', /DotBot/i],
  ['Screaming Frog', 'seo', /Screaming Frog/i], ['SiteAuditBot', 'seo', /SiteAuditBot/i],
]

// Generic HTTP clients that agents and scripts use. Logged only on agent-facing paths.
export const KNOWN_TOOLS = [
  ['python-requests', /python-requests/i], ['python-httpx', /python-httpx/i], ['aiohttp', /aiohttp/i], ['curl', /^curl\//i], ['wget', /^wget\//i],
  ['node-fetch', /node-fetch|^node$|undici/i], ['axios', /^axios/i], ['Go-http-client', /Go-http-client/i], ['okhttp', /okhttp/i],
  ['Java', /^Java\//i], ['libwww-perl', /libwww-perl/i], ['Claude-Code', /claude-code|claude-cli/i], ['mcp-client', /\bmcp\b|modelcontextprotocol/i],
]

const BROWSER = /Mozilla\/\d/i
const ASSET = /^\/(assets|images|icons)\/|\.(?:js|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|mp4|webm)$/i

export function isAgentPath(pathname) {
  return pathname === '/llms.txt' || pathname === '/llms-full.txt' || pathname.startsWith('/llms/') || pathname.startsWith('/data/')
    || pathname === '/mcp' || pathname.startsWith('/.well-known/') || pathname.endsWith('.md') || pathname === '/robots.txt'
}

// Returns { agent, kind } for requests worth logging, or null.
export function classify(userAgent, pathname) {
  if (ASSET.test(pathname)) return null
  const ua = userAgent ?? ''
  for (const [agent, kind, pattern] of KNOWN_BOTS) if (pattern.test(ua)) return { agent, kind }
  if (!isAgentPath(pathname)) return null
  for (const [agent, pattern] of KNOWN_TOOLS) if (pattern.test(ua)) return { agent, kind: 'tool' }
  if (pathname === '/mcp') return { agent: 'unknown', kind: 'tool' }
  // An ordinary browser reading an agent file is a person, not automation.
  if (BROWSER.test(ua)) return null
  return { agent: 'unknown', kind: 'tool' }
}
