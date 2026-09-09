import { MapPinned } from 'lucide-react'
import MyceliumMark from './MyceliumMark'
import CollectionNavigation, { CollectionSwitch } from './CollectionNavigation'
import { FUNGI_HOME } from '../lib/navigation'

export default function GuideHeader({ section = 'archive' }) {
  return (
    <header className="guide-site-header collection-header">
      <a className="brand-lockup" href={FUNGI_HOME} aria-label="Mushroom Forage Map home">
        <div className="brand-mark"><MyceliumMark /></div>
        <div className="brand-copy">
          <strong><span className="brand-name-full">The Living Fungi Archive</span><span className="brand-name-short">Fungi Archive</span></strong>
          <span>Mushroom Forage Map</span>
        </div>
      </a>

      <CollectionSwitch collection="fungi" />
      <CollectionNavigation collection="fungi" active={section} className="guide-global-nav" />

      <a className="button button-primary guide-map-link" href="/">
        <MapPinned size={17} aria-hidden="true" /> Open field map
      </a>
    </header>
  )
}
