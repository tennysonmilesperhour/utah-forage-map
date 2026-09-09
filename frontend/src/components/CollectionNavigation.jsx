import { Archive, BellRing, BookOpen, Compass, Flower2, Globe2, Leaf, Map, Users } from 'lucide-react'
import { FUNGI_HOME, fungiNavigation, herbNavigation, herbHref, isPlainClick } from '../lib/navigation'
import '../collection-navigation.css'
import MyceliumMark from './MyceliumMark'

const icons = { archive: Archive, bell: BellRing, book: BookOpen, compass: Compass, flower: Flower2, globe: Globe2, map: Map, users: Users }

export function CollectionSwitch({ collection, forest = true }) {
  return <div className="world-switch collection-switch" aria-label="Foraging collection">
    <a href={FUNGI_HOME} className={collection === 'fungi' ? 'active' : ''} aria-current={collection === 'fungi' ? 'true' : undefined}><MyceliumMark />Fungi</a>
    <a href={herbHref('today', forest)} className={collection === 'herbs' ? 'active' : ''} aria-current={collection === 'herbs' ? 'true' : undefined}><Leaf size={14} aria-hidden="true" />Herbs</a>
  </div>
}

export default function CollectionNavigation({ collection, active, forest = true, onNavigate, className = '' }) {
  const links = collection === 'herbs' ? herbNavigation : fungiNavigation
  return <nav className={`collection-nav ${className}`} aria-label={collection === 'herbs' ? 'Herbal navigation' : 'Primary navigation'}>
    {links.map(link => {
      const Icon = icons[link.icon]
      return <a key={link.key} className={`nav-item ${active === link.key ? 'active' : ''}`} href={link.href || herbHref(link.key, forest)} aria-current={active === link.key ? 'page' : undefined} onClick={event => {
        if (onNavigate && isPlainClick(event) && (collection === 'herbs' || ['map', 'community'].includes(link.key))) {
          event.preventDefault()
          onNavigate(link.key)
        }
      }}><Icon size={17} aria-hidden="true" /><span>{link.label}</span></a>
    })}
  </nav>
}
