import { BookOpen, Library, Map, MapPinned, Users } from 'lucide-react'

export default function GuideHeader() {
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
        <a className="active" href="/learn" aria-current="page"><BookOpen size={17} aria-hidden="true" /> Species archive</a>
      </nav>

      <a className="button button-primary guide-map-link" href="/">
        <MapPinned size={17} aria-hidden="true" /> Open field map
      </a>
    </header>
  )
}
