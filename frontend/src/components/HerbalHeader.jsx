import SupporterSprout from './SupporterSprout'
import { Leaf, LogIn, LogOut, UserPlus } from 'lucide-react'
import CollectionNavigation, { CollectionSwitch } from './CollectionNavigation'
import { herbHref, isPlainClick } from '../lib/navigation'

export default function HerbalHeader({ view, forest, user, authLoading, onNavigate, onAuth, onLogout, className = '' }) {
  return (
    <header className={`herbal-header collection-header ${className}`}>
      <a className="herbal-brand" href={herbHref('today', forest)} onClick={event => { if (isPlainClick(event)) { event.preventDefault(); onNavigate('today') } }}>
        <span className="herbal-sigil" aria-hidden="true"><Leaf size={22} /></span>
        <span><strong>The Verdant Hours</strong><small>Herbal gathering almanac</small></span>
      </a>
      <CollectionSwitch collection="herbs" forest={forest} />
      <CollectionNavigation collection="herbs" active={view} forest={forest} onNavigate={onNavigate} />
      <div className="herbal-account-actions">
        <SupporterSprout collection="herbs" supporter={user?.is_supporter} />
        {!authLoading && !user && <><button className="herb-text-button" type="button" onClick={() => onAuth('login')}><LogIn size={16} /> Sign in</button><button className="herb-solid-button" type="button" aria-label="Create account" onClick={() => onAuth('register')}><UserPlus size={16} /> Join</button></>}
        {!authLoading && user && <><button className="herb-user-button" type="button" onClick={() => onNavigate('pantry')}><span className={user.is_supporter ? 'supporter-gilded' : undefined}>{user.username.slice(0, 1).toUpperCase()}</span>{user.username}</button><button className="herb-icon-button" type="button" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button></>}
      </div>
    </header>
  )
}

