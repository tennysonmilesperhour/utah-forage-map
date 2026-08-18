import { BookOpen, Globe2, Library, Map, MapPinned, Users } from 'lucide-react'

export default function GuideHeader({ section = 'archive' }) {
  return (
    <header className="guide-site-header">
      <a className="brand-lockup" href="/" aria-label="Mushroom Forage Map home">
        <div className="brand-mark"><Library size={21} strokeWidth={1.8} aria-hidden="true" /></div>
        <div className="brand-copy">
          <strong><span className="brand-name-full">The Living Fungi Archive</span><span className="brand-name-short">Fungi Archive</span></strong>
          <span>Mushroom Forage Map</span>
        </div>
      </a>

      <nav className="guide-global-nav" aria-label="Primary navigation">
        <a href="/"><Map size={17} aria-hidden="true" /> Field map</a>
        <a href="/community"><Users size={17} aria-hidden="true" /> Community</a>
        <a className={section === 'regions' ? 'active' : ''} href="/regions" aria-current={section === 'regions' ? 'page' : undefined}><Globe2 size={17} aria-hidden="true" /> Regions</a>
        <a className={section === 'archive' ? 'active' : ''} href="/learn" aria-current={section === 'archive' ? 'page' : undefined}><BookOpen size={17} aria-hidden="true" /> Species archive</a>
      </nav>

      <a className="button button-primary guide-map-link" href="/">
        <MapPinned size={17} aria-hidden="true" /> Open field map
      </a>
    </header>
  )
}
