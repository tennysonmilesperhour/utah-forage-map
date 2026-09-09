// Stable destinations and order shared by app, reference and map headers.
export const FUNGI_HOME = '/learn'
export const fungiNavigation = [
  { key: 'archive', label: 'Archive', href: FUNGI_HOME, icon: 'book' },
  { key: 'map', label: 'Field map', href: '/', icon: 'map' },
  { key: 'regions', label: 'Regions', href: '/regions', icon: 'globe' },
  { key: 'skills', label: 'Field skills', href: '/learn/foraging', icon: 'compass' },
  { key: 'community', label: 'Community', href: '/community', icon: 'users' },
]
export function herbHref(view, forest = true) {
  if (view === 'map') return '/herbs/map'
  if (view === 'plants' && forest) return '/herbs/atlas'
  const params = new URLSearchParams()
  if (!forest) params.set('design', 'classic')
  if (view !== 'today') params.set('view', view)
  return `/herbs${params.size ? `?${params}` : ''}`
}
export const herbNavigation = [
  { key: 'today', label: 'Today', icon: 'compass' },
  { key: 'map', label: 'Field map', icon: 'map' },
  { key: 'plants', label: 'Plant atlas', icon: 'flower' },
  { key: 'practice', label: 'Gathering ways', icon: 'book' },
  { key: 'watches', label: 'Watch zones', icon: 'bell' },
  { key: 'pantry', label: 'Pantry', icon: 'archive' },
]
export function isPlainClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}
