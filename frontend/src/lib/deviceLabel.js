// A short "Browser on system" label; the raw user agent stays in the tooltip.
export function deviceLabel(agent = '') {
  const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\/|Opera/.test(agent) ? 'Opera' : /Firefox\/|FxiOS\//.test(agent) ? 'Firefox' : /Chrome\/|CriOS\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : ''
  const system = /iPhone|iPad|iPod/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Windows/.test(agent) ? 'Windows' : /CrOS/.test(agent) ? 'ChromeOS' : /Mac OS X|Macintosh/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : ''
  return browser && system ? `${browser} on ${system}` : browser || system || 'Unknown browser'
}
