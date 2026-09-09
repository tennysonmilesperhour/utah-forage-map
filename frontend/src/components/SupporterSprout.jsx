import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useSupporterMotion } from '../lib/supporterMotion'
import { MUSHROOM_TIMING, nextMushroomPhase } from '../lib/mushroomMotion'
import MushroomFriend from './BotanicalMushroom'
import { nextSupporterPoem, SUPPORTER_POEMS } from '../data/supporter-poems'
import '../supporter.css'

function subscribeReducedMotion(callback) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
function reducedMotionSnapshot() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }
const POEM_KEY = 'forage-supporter-poem'

export default function SupporterSprout({ collection = 'fungi', supporter = false }) {
  const [life, setLife] = useState({ phase: 'dormant', cycle: 0 })
  const [hovered, setHovered] = useState(false)
  const [artworkReady, setArtworkReady] = useState(false)
  const [focused, setFocused] = useState(false)
  const [poemIndex, setPoemIndex] = useState(0)
  const trigger = useRef(null)
  const skipFocus = useRef(false)
  const popupId = useId()
  const { paused } = useSupporterMotion()
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false)
  const motionDisabled = paused || reducedMotion
  const { phase, cycle } = life
  const showing = phase === 'offering'
  const poem = SUPPORTER_POEMS[poemIndex]

  useEffect(() => {
    try {
      const saved = Number.parseInt(localStorage.getItem(POEM_KEY), 10)
      if (Number.isInteger(saved) && saved >= 0) queueMicrotask(() => setPoemIndex(saved % SUPPORTER_POEMS.length))
    } catch { /* The poems still rotate when storage is unavailable. */ }
  }, [])

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
    if (phase !== 'dormant') return
    if (supporter) advancePoem()
    setLife(current => ({ ...current, phase: motionDisabled ? 'offering' : 'forming' }))
  }
  function advancePoem() {
    setPoemIndex(current => {
      const next = nextSupporterPoem(current)
      try { localStorage.setItem(POEM_KEY, String(next)) } catch { /* Keep rotating in memory. */ }
      return next
    })
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
    <button ref={trigger} className="sprout-trigger" type="button" aria-label={supporter ? 'Open a pocket mushroom or herb poem' : 'Optional project support for 10 US dollars per year'} aria-expanded={showing} aria-controls={popupId}
      onMouseEnter={() => { if (!motionDisabled) start() }} onFocus={() => { if (!skipFocus.current && !motionDisabled) start() }} onClick={() => showing ? dismiss() : start()}>
      <MushroomFriend phase={motionDisabled ? 'still' : phase} onReady={setArtworkReady} />
    </button>
    {showing && <div className={`sprout-bubble${supporter ? ' sprout-bubble--poem' : ''}`} id={popupId} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      {supporter ? <div className="sprout-poem"><span>Pocket poem · {poemIndex + 1} of {SUPPORTER_POEMS.length}</span><strong>{poem.title}</strong><p>{poem.lines.map(line => <span key={line}>{line}</span>)}</p><button type="button" onClick={advancePoem}>Another poem <ArrowRight size={12} aria-hidden="true" /></button></div>
        : <a className="sprout-invitation" href={`/supporters${collection === 'herbs' ? '?collection=herbs' : ''}`}><span>All field tools are free. Optional support unlocks small thank-yous and is never expected.</span><strong>Optional support · $10/year ↗</strong></a>}
      <button className="sprout-close" type="button" aria-label={supporter ? 'Close pocket poem' : 'Close supporter invitation'} onClick={dismiss}><X size={13} aria-hidden="true" /></button>
    </div>}
  </div>
}
