import { BookOpen, Leaf, Map, MapPinned, Users } from 'lucide-react'

export default function GuideHeader() {
  return (
    <header className="guide-site-header">
      <a className="brand-lockup" href="/" aria-label="Mushroom Forage Map home">
        <div className="brand-mark"><Leaf size={21} strokeWidth={2.2} aria-hidden="true" /></div>
        <div className="brand-copy">
          <strong>Mushroom Forage Map</strong>
          <span>Worldwide field knowledge</span>
        </div>
      </a>

      <nav className="guide-global-nav" aria-label="Primary navigation">
        <a href="/"><Map size={17} aria-hidden="true" /> Map</a>
        <a href="/community"><Users size={17} aria-hidden="true" /> Community</a>
        <a className="active" href="/learn" aria-current="page"><BookOpen size={17} aria-hidden="true" /> Guide</a>
      </nav>

      <a className="button button-primary guide-map-link" href="/">
        <MapPinned size={17} aria-hidden="true" /> Explore map
      </a>
    </header>
  )
}
