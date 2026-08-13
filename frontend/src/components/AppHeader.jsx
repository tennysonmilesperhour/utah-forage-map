import { useState } from 'react'
import { BookOpen, ChevronDown, Leaf, LogIn, LogOut, Map, NotebookPen, UserPlus, Users } from 'lucide-react'

export default function AppHeader({
  user,
  authLoading,
  onCreateAccount,
  onSignIn,
  onSubmitFind,
  onOpenCommunity,
  onOpenAccount,
  onLogout,
}) {
  const [accountOpen, setAccountOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark"><Leaf size={21} strokeWidth={2.2} aria-hidden="true" /></div>
        <div className="brand-copy">
          <h1>Forage Map</h1>
          <p>Community field knowledge worldwide</p>
        </div>
      </div>

      <nav className="primary-nav" aria-label="Primary navigation">
        <button className="nav-item active" type="button"><Map size={17} aria-hidden="true" /> Map</button>
        <button className="nav-item" type="button" onClick={onOpenCommunity}><Users size={17} aria-hidden="true" /> Community</button>
        <button className="nav-item" type="button" onClick={onOpenCommunity}><BookOpen size={17} aria-hidden="true" /> Field guide</button>
      </nav>

      <div className="header-actions">
        <button className="icon-button mobile-filter-button" type="button" onClick={onOpenCommunity} aria-label="Open community field desk" title="Community">
          <Users size={20} aria-hidden="true" />
        </button>

        {!authLoading && !user && (
          <>
            <button className="button button-ghost sign-in-button" type="button" onClick={onSignIn} aria-label="Sign in" title="Sign in">
              <LogIn size={17} aria-hidden="true" />
              <span>Sign in</span>
            </button>
            <button className="button button-primary" type="button" onClick={onCreateAccount} aria-label="Create account" title="Create account">
              <UserPlus size={17} aria-hidden="true" />
              <span className="create-label-full">Create account</span>
              <span className="create-label-short">Join</span>
            </button>
          </>
        )}

        {!authLoading && user && (
          <>
            <button className="button button-primary submit-header-button" type="button" onClick={onSubmitFind} aria-label="Add a find" title="Add a find">
              <NotebookPen size={17} aria-hidden="true" />
              <span>Add a find</span>
            </button>
            <div className="account-menu-wrap">
              <button
                className="account-trigger"
                type="button"
                onClick={() => setAccountOpen(!accountOpen)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                aria-label={`Account menu for ${user.username}`}
                title="Account menu"
              >
                <span className="avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span>
                <span className="account-name">{user.username}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {accountOpen && (
                <div className="account-menu" role="menu">
                  <div className="account-summary">
                    <strong>{user.username}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className="account-stat">
                    <NotebookPen size={17} aria-hidden="true" />
                    <span><strong>{user.total_finds}</strong> logbook finds</span>
                  </div>
                  <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); onOpenAccount() }}>
                    <NotebookPen size={17} aria-hidden="true" /> Open field desk
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); onLogout() }}>
                    <LogOut size={17} aria-hidden="true" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
