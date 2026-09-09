import { useState } from 'react'
import { Archive, BellRing, Compass, Flower2, Leaf, LogIn, LogOut, Menu, UserPlus } from 'lucide-react'

function HerbModeSwitch({ forest }) {
  return (
    <div className="world-switch" aria-label="Foraging collection">
      <a href="/"><span aria-hidden="true">F</span> Fungi</a>
      <a className="active" href={forest ? '/herbs' : '/herbs?design=classic'} aria-current="page"><Leaf size={14} aria-hidden="true" /> Herbs</a>
    </div>
  )
}

export default function HerbalHeader({ view, forest, user, authLoading, onNavigate, onAuth, onLogout, className = '' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const links = [
    ['today', <Compass size={17} aria-hidden="true" />, 'Today'],
    ['plants', <Flower2 size={17} aria-hidden="true" />, 'Plant atlas'],
    ['watches', <BellRing size={17} aria-hidden="true" />, 'Watch zones'],
    ['pantry', <Archive size={17} aria-hidden="true" />, 'Pantry'],
  ]
  function choose(next) {
    setMenuOpen(false)
    onNavigate(next)
  }
  return (
    <header className={`herbal-header ${className}`}>
      <a className="herbal-brand" href="/herbs" onClick={event => { event.preventDefault(); choose('today') }}>
        <span className="herbal-sigil" aria-hidden="true"><Leaf size={22} /></span>
        <span><strong>The Verdant Hours</strong><small>Herbal gathering almanac</small></span>
      </a>
      <HerbModeSwitch forest={forest} />
      <nav className={menuOpen ? 'open' : ''} aria-label="Herbal navigation">
        {links.map(([value, icon, label]) => <button className={view === value ? 'active' : ''} aria-current={view === value ? 'page' : undefined} type="button" key={value} onClick={() => choose(value)}>{icon}{label}</button>)}
      </nav>
      <div className="herbal-account-actions">
        <button className="herbal-menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open herbal navigation"><Menu size={20} /></button>
        {!authLoading && !user && <><button className="herb-text-button" type="button" onClick={() => onAuth('login')}><LogIn size={16} /> Sign in</button><button className="herb-solid-button" type="button" onClick={() => onAuth('register')}><UserPlus size={16} /> Join</button></>}
        {!authLoading && user && <><button className="herb-user-button" type="button" onClick={() => choose('pantry')}><span>{user.username.slice(0, 1).toUpperCase()}</span>{user.username}</button><button className="herb-icon-button" type="button" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button></>}
      </div>
    </header>
  )
}

