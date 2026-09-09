import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { useSupporterMotion } from '../lib/supporterMotion'
import { MUSHROOM_TIMING, nextMushroomPhase } from '../lib/mushroomMotion'
import MushroomFriend from './BotanicalMushroom'
import '../supporter.css'

function subscribeReducedMotion(callback) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
function reducedMotionSnapshot() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }

export default function SupporterSprout({ collection = 'fungi', supporter = false }) {
  const [life, setLife] = useState({ phase: 'dormant', cycle: 0 })
  const [hovered, setHovered] = useState(false)
  const [artworkReady, setArtworkReady] = useState(false)
  const [focused, setFocused] = useState(false)
  const trigger = useRef(null)
  const skipFocus = useRef(false)
  const popupId = useId()
  const { paused } = useSupporterMotion()
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false)
  const motionDisabled = paused || reducedMotion
  const { phase, cycle } = life
  const showing = phase === 'offering'

  useEffect(() => {
    // Keep the invitation still while someone reads or keyboards through it.
    if (phase === 'offering' && (hovered || focused || motionDisabled)) return
    if (phase === 'dormant' && (motionDisabled || !artworkReady)) return
    const duration = motionDisabled ? 0 : phase === 'dormant' ? (cycle ? MUSHROOM_TIMING.resting : MUSHROOM_TIMING.initial) : MUSHROOM_TIMING[phase]
    const timer = window.setTimeout(() => setLife(current => current.phase === phase ? {
      phase: nextMushroomPhase(phase), cycle: current.cycle + (phase === 'wilting' ? 1 : 0),
    } : current), duration)
    return () => window.clearTimeout(timer)
  }, [phase, cycle, hovered, focused, motionDisabled, artworkReady])

  function start() {
    setLife(current => current.phase === 'dormant' ? { ...current, phase: motionDisabled ? 'offering' : 'forming' } : current)
  }
  function dismiss() {
    if (!showing) return
    // Move keyboard focus out before removing the close button; don't interpret
    // that focus restoration as a request to sprout again.
    skipFocus.current = true
    trigger.current?.focus({ preventScroll: true })
    skipFocus.current = false
    setHovered(false)
    setFocused(false)
    setLife(current => ({ ...current, phase: 'wilting' }))
  }

  return <div className="supporter-sprout" data-phase={phase} data-motion={motionDisabled ? 'still' : 'animated'} onKeyDown={event => { if (event.key === 'Escape' && showing) { event.preventDefault(); dismiss() } }}>
    <button ref={trigger} className="sprout-trigger" type="button" aria-label={supporter ? 'Your supporter membership' : 'Support the project for 10 US dollars per year'} aria-expanded={showing} aria-controls={popupId}
      onMouseEnter={() => { if (!motionDisabled) start() }} onFocus={() => { if (!skipFocus.current && !motionDisabled) start() }} onClick={() => showing ? dismiss() : start()}>
      <MushroomFriend phase={motionDisabled ? 'still' : phase} onReady={setArtworkReady} />
    </button>
    {showing && <div className="sprout-bubble" id={popupId} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <a className="sprout-invitation" href={`/supporters${collection === 'herbs' ? '?collection=herbs' : ''}`}><span>{supporter ? 'You help this forest grow.' : 'Help this little world grow.'}</span><strong>{supporter ? 'Your supporter membership ↗' : 'Support the project · $10/year ↗'}</strong></a>
      <button className="sprout-close" type="button" aria-label="Close supporter invitation" onClick={dismiss}><X size={13} aria-hidden="true" /></button>
    </div>}
  </div>
}
