import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowUpRight, Check, Crown, Gift, Heart, Users } from 'lucide-react'
import AppHeader from './components/AppHeader'
import HerbalHeader from './components/HerbalHeader'
import AuthDialog from './components/AuthDialog'
import MushroomFriend from './components/BotanicalMushroom'
import { getApiError, useCurrentUser, useLogout } from './hooks/useAuth'
import { herbHref } from './lib/navigation'
import { applyPageMetadata, pathForView } from './lib/seo'
import { useSupporterMotion } from './lib/supporterMotion'
import './mycelial.css'
import './herbal.css'
import './herbal-forest.css'
import './supporters-page.css'

function dateLabel(value) { return value ? new Date(value + (value.endsWith('Z') ? '' : 'Z')).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '' }
function goToStripe(url) {
  const target = new URL(url)
  if (target.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(target.hostname)) throw new Error('Invalid checkout address')
  window.location.assign(target.href)
}

async function publicSupporters(offset) {
  try { return (await axios.get('/api/supporters', { params: { offset } })).data }
  catch (error) {
    // A frontend preview can precede the backend release. No payment or member
    // status is inferred when the new route is not available yet.
    if (error.response?.status === 404) return { available: false, supporters: [], total: 0 }
    throw error
  }
}

export default function SupportersApp() {
  const [params] = useState(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search))
  const herbs = params.get('collection') === 'herbs'
  const [authMode, setAuthMode] = useState(null)
  const [listingChoice, setListingChoice] = useState(null)
  const [offset, setOffset] = useState(0)
  const currentUser = useCurrentUser()
  const user = currentUser.data
  const userId = user?.id
  const logout = useLogout()
  const cache = useQueryClient()
  const motion = useSupporterMotion()
  const publicList = useQuery({ queryKey: ['supporters', offset], queryFn: () => publicSupporters(offset) })
  const membership = useQuery({ queryKey: ['membership', user?.id], enabled: Boolean(user), queryFn: async () => {
    try { return (await axios.get('/api/billing/membership')).data }
    catch (error) { if (error.response?.status === 404) return { active: false, status: 'none', public_listing: false, can_manage: false }; throw error }
  } })
  const confirmation = useQuery({
    queryKey: ['supporter-confirmation', user?.id, params.get('session_id'), params.get('billing')],
    enabled: Boolean(user && ((params.get('checkout') === 'success' && params.get('session_id')) || params.get('billing') === 'returned')),
    retry: 1,
    queryFn: async () => (await axios.post(params.has('session_id') ? '/api/billing/confirm' : '/api/billing/refresh', params.has('session_id') ? { session_id: params.get('session_id') } : undefined)).data,
  })
  const status = membership.data
  const publicListing = listingChoice && listingChoice.userId === userId ? listingChoice.value : status?.public_listing ?? false
  const checkout = useMutation({ mutationFn: async () => goToStripe((await axios.post('/api/billing/checkout', { public_listing: publicListing })).data.url), onError: error => { if (error.response?.status === 409) { cache.invalidateQueries({ queryKey: ['membership', userId] }); cache.invalidateQueries({ queryKey: ['current-user'] }) } } })
  const portal = useMutation({ mutationFn: async () => goToStripe((await axios.post('/api/billing/portal')).data.url) })
  const preference = useMutation({
    mutationFn: async value => (await axios.patch('/api/billing/membership', { public_listing: value })).data,
    onError: () => setListingChoice(null),
    onSuccess: data => { cache.setQueryData(['membership', user.id], data); cache.invalidateQueries({ queryKey: ['supporters'] }) },
  })
  useEffect(() => { applyPageMetadata('supporters') }, [])
  useEffect(() => {
    if (!confirmation.data || !userId) return
    cache.setQueryData(['membership', userId], confirmation.data)
    cache.invalidateQueries({ queryKey: ['current-user'] })
    cache.invalidateQueries({ queryKey: ['supporters'] })
  }, [confirmation.data, userId, cache])

  const busy = checkout.isPending || portal.isPending
  const error = checkout.error || portal.error || preference.error || confirmation.error
  const navigateHerbs = view => window.location.assign(herbHref(view, true))
  return <div className={`supporters-shell ${herbs ? 'herbal-shell herbal-shell--forest' : 'mycelial-theme'}`}>
    {herbs ? <HerbalHeader forest view="supporters" user={user} authLoading={currentUser.isLoading} onNavigate={navigateHerbs} onAuth={setAuthMode} onLogout={() => logout.mutate()} />
      : <AppHeader user={user} authLoading={currentUser.isLoading} activeView="supporters" onCreateAccount={() => setAuthMode('register')} onSignIn={() => setAuthMode('login')} onSubmitFind={() => window.location.assign('/map?submit=1')} onNavigate={view => window.location.assign(pathForView(view))} onOpenAccount={() => window.location.assign('/account')} onLogout={() => logout.mutate()} />}
    <main className="supporters-main">
      <section className="supporters-intro" aria-labelledby="supporter-title">
        <div className="supporters-story"><p className="supporter-eyebrow">Optional support</p><h1 id="supporter-title">Field tools stay<br /><em>free for everyone.</em></h1><p className="supporter-lede">Support is appreciated, never necessary or expected. Supporters receive a few small thank-yous while every guide, map, and field tool stays open.</p><div className="supporter-friend-scene"><MushroomFriend /><span>we grow better together</span></div></div>
        <div className="supporter-card">
          <p className="supporter-eyebrow"><Heart size={14} /> The supporter circle</p>
          <div className="supporter-price"><strong>$10</strong><span>USD / year</span></div>
          <p className="supporter-price-note">Optional support. All field tools remain free.</p>
          <ul className="supporter-perks">
            <li><Crown /><div><strong>A little gold, just for you</strong><span>A gilded outline around your profile in fungi and herbs.</span></div></li>
            <li><Users /><div><strong>A place in the circle</strong><span>Your profile name on our supporter list, if you’d like.</span></div></li>
            <li><Gift /><div><strong>Forty pocket poems</strong><span>The little growing mushroom shares poems about fungi and herbs instead of asking for support.</span></div></li>
          </ul>
          {user && <div className={`supporter-profile-preview${status?.active ? ' supporter-gilded' : ''}`}><span className="supporter-avatar supporter-gilded" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span><div><strong>{user.username}</strong><small>{status?.active ? 'Project supporter' : 'Your gilded profile preview'}</small></div>{status?.active && <Check size={18} />}</div>}
          {currentUser.isError && <p className="supporter-notice" role="alert">Your account could not be loaded. <button onClick={() => currentUser.refetch()}>Try again</button></p>}
          {user && membership.isError && <p className="supporter-notice" role="alert">Your membership could not be loaded. <button onClick={() => membership.refetch()}>Try again</button></p>}
          {params.get('checkout') === 'canceled' && <p className="supporter-notice">Checkout was closed. You’re welcome here, with or without a contribution.</p>}
          {confirmation.isFetching && <p className="supporter-notice" role="status">Checking your membership with Stripe…</p>}
          {confirmation.data && !confirmation.data.active && params.get('checkout') === 'success' && <p className="supporter-notice" role="status">Your payment is still being confirmed. <button onClick={() => confirmation.refetch()}>Check again</button></p>}
          {status?.active && <p className="supporter-notice supporter-thanks"><Check size={16} /> Thank you for helping this project grow.{status.paid_until && <span>{status.cancel_at_period_end || status.status === 'canceled' ? 'Your membership continues until' : status.status === 'past_due' ? 'Please update your payment method. Your paid membership ends' : 'Your next annual renewal is'} {dateLabel(status.paid_until)}.</span>}</p>}
          {user && !membership.isError && <label className="supporter-listing-choice"><input type="checkbox" checked={publicListing} disabled={preference.isPending} onChange={event => { setListingChoice({ userId, value: event.target.checked }); if (status?.can_manage) preference.mutate(event.target.checked) }} /><span>Show <strong>{user.username}</strong> on the public supporter list.<small>Optional. You can change this here anytime.</small></span></label>}
          {error && <p className="supporter-notice" role="alert">{getApiError(error, 'We couldn’t open billing. Please try again.')}</p>}
          {publicList.data?.available === false && !status?.active ? <p className="supporter-notice">The supporter circle is getting ready. Checkout will open soon.</p>
            : status?.can_manage && (status.active || ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(status.status)) ? <button className="supporter-cta" disabled={busy} onClick={() => portal.mutate()}>{busy ? 'Opening Stripe…' : 'Manage membership'}<ArrowUpRight size={18} /></button>
              : <button className="supporter-cta" disabled={busy || currentUser.isLoading || currentUser.isError || (Boolean(user) && (membership.isLoading || membership.isError)) || !publicList.data?.available} onClick={() => user ? checkout.mutate() : setAuthMode('register')}>{busy ? 'Opening Stripe…' : 'Optional support · $10/year'}<ArrowUpRight size={18} /></button>}
          {status?.can_manage && !status.active && status.status === 'canceled' && <button className="supporter-secondary" onClick={() => portal.mutate()} disabled={busy}>View past payments</button>}
          {!user && !currentUser.isLoading && <p className="supporter-signin">Already have a profile? <button onClick={() => setAuthMode('login')}>Sign in</button></p>}
          <p className="supporter-terms">$10 USD, billed yearly and renewed automatically until canceled. Cancel anytime in Manage membership; your perks stay through your paid year. Secure checkout and receipts by Stripe.</p>
          <p className="supporter-smallprint">Surprises are occasional, with no fixed schedule. Membership supports the project; it isn’t a charitable donation.</p>
        </div>
      </section>
      <section className="supporter-wall" aria-labelledby="supporter-wall-title"><div className="supporter-wall-heading"><div><p className="supporter-eyebrow">Growing together</p><h2 id="supporter-wall-title">The people behind the possibility.</h2></div><span><Heart size={15} /> With our thanks</span></div><p>To everyone helping the fungi and herb collections take root: we’re glad you’re here.</p>
        {publicList.isLoading ? <p role="status" className="supporter-wall-empty">Loading the supporter circle…</p> : publicList.isError ? <p className="supporter-wall-empty">The supporter list is taking a moment. <button onClick={() => publicList.refetch()}>Try again</button></p>
          : publicList.data?.supporters.length ? <ul className="supporter-names">{publicList.data.supporters.map(person => <li key={person.name}><span className="supporter-avatar supporter-gilded" aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span><div><strong>{person.name}</strong><small>Supporter since {dateLabel(person.since)}</small></div></li>)}</ul> : <div className="supporter-wall-empty"><MushroomFriend /><p>A new circle, with room to grow.<br /><span>Supporters who choose to be listed will appear here.</span></p></div>}
        {publicList.data?.total > 60 && <div className="supporter-pagination"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 60))}>Previous</button><span>{offset + 1}–{Math.min(offset + 60, publicList.data.total)} of {publicList.data.total}</span><button disabled={offset + 60 >= publicList.data.total} onClick={() => setOffset(offset + 60)}>Next</button></div>}
      </section>
      <footer className="supporter-footer"><div><span>Made for curious people and a living world.</span><button className="supporter-motion-toggle" onClick={motion.toggle} aria-pressed={motion.paused}>{motion.paused ? 'Play mushroom animation' : 'Pause mushroom animation'}</button></div><nav aria-label="Supporter information"><a href="/privacy">Privacy</a><a href="mailto:morphiclabsdata@gmail.com">Membership help</a><a href={herbs ? '/herbs' : '/'}>Back to the collection <ArrowUpRight size={14} /></a></nav></footer>
    </main>
    {authMode && <AuthDialog mode={authMode} context={herbs ? 'herbs' : 'fungi'} onClose={() => setAuthMode(null)} onAuthenticated={() => setAuthMode(null)} />}
  </div>
}
