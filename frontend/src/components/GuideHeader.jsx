import SupporterSprout from './SupporterSprout'
import { MapPinned } from 'lucide-react'
import MyceliumMark from './MyceliumMark'
import CollectionNavigation, { CollectionSwitch } from './CollectionNavigation'
import { FUNGI_HOME, FUNGI_MAP } from '../lib/navigation'

export default function GuideHeader({ section = 'library' }) {
  return (
    <header className="guide-site-header collection-header">
      <a className="brand-lockup" href={FUNGI_HOME} aria-label="Mushroom Forage Map home">
        <div className="brand-mark"><MyceliumMark /></div>
        <div className="brand-copy">
          <strong><span className="brand-name-full">The Living Fungi Library</span><span className="brand-name-short">Fungi Library</span></strong>
          <span>Mushroom Forage Map</span>
        </div>
      </a>

      <CollectionSwitch collection="fungi" />
      <CollectionNavigation collection="fungi" active={section} className="guide-global-nav" />

      <div className="header-actions">
        <SupporterSprout />
        <a className="button button-primary guide-map-link" href={FUNGI_MAP} aria-label="Open field map">
          <MapPinned size={17} aria-hidden="true" /> Open field map
        </a>
      </div>
    </header>
  )
}
