import { useEffect, useId, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useSupporterMotion } from '../lib/supporterMotion'
import { BANNER_FADE_MS, initialSupporterLife, supporterLife, supporterPhaseDuration } from '../lib/supporterLifecycle'
import BotanicalSpecimen from './BotanicalSpecimen'
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
  const [life, dispatch] = useReducer(supporterLife, initialSupporterLife)
  const [hovered, setHovered] = useState(false)
  const [artworkReady, setArtworkReady] = useState(false)
  const [focused, setFocused] = useState(false)
  const [poemIndex, setPoemIndex] = useState(0)
  const trigger = useRef(null)
  const sprout = useRef(null)
  const [placement, setPlacement] = useState({ side: 'left', width: supporter ? 270 : 246, offset: 0 })
  const skipFocus = useRef(false)
  const popupId = useId()
  const { paused } = useSupporterMotion()
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false)
  const motionDisabled = paused || reducedMotion
  const { phase, cycle, banner } = life
  const showing = banner !== 'hidden'
  const fading = banner === 'fading' && !motionDisabled
  const holding = motionDisabled || (phase === 'dormant' && !artworkReady) || (showing && ['dormant', 'fading'].includes(phase) && (hovered || focused))
  const poem = SUPPORTER_POEMS[poemIndex]

  useEffect(() => {
    const slot = sprout.current
    const header = slot.closest('header')
    if (!header) return
    function place() {
      const box = slot.getBoundingClientRect()
      // Use the approved herb-side placement in both collections. Account
      // controls must not flip the invitation to the other side of the sprout.
      const next = { side: 'left', width: Math.max(140, Math.min(supporter ? 270 : 246, box.left - 24)), offset: header.getBoundingClientRect().bottom - box.top + 24 }
      setPlacement(current => current.side === next.side && current.width === next.width && current.offset === next.offset ? current : next)
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(header)
    observer.observe(slot.parentElement)
    for (const action of slot.parentElement.children) observer.observe(action)
    window.addEventListener('resize', place)
    return () => { observer.disconnect(); window.removeEventListener('resize', place) }
  }, [supporter])

  useEffect(() => {
    try {
      const saved = Number.parseInt(localStorage.getItem(POEM_KEY), 10)
      if (Number.isInteger(saved) && saved >= 0) queueMicrotask(() => setPoemIndex(saved % SUPPORTER_POEMS.length))
    } catch { /* The poems still rotate when storage is unavailable. */ }
  }, [])

  useEffect(() => {
    // The invitation outlives the specimen. Only its pre-growth fade waits
    // for readers; the mushroom can wilt while the invitation remains open.
    if (holding) return
    const timer = window.setTimeout(() => dispatch('tick'), supporterPhaseDuration({ phase, cycle }))
    return () => window.clearTimeout(timer)
  }, [phase, cycle, holding])

  function start() {
    if (motionDisabled) { dispatch('open'); return }
    if (phase !== 'dormant') return
    if (supporter) advancePoem()
    dispatch('start')
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
    dispatch('dismiss')
  }

  return <div ref={sprout} className="supporter-sprout" data-side={placement.side} data-phase={phase} data-banner={fading ? 'fading' : showing ? 'visible' : 'hidden'} style={{ '--sprout-fade-duration': `${BANNER_FADE_MS}ms`, '--sprout-bubble-width': `${placement.width}px`, '--sprout-offset': `${placement.offset}px` }} data-motion={motionDisabled ? 'still' : 'animated'} onKeyDown={event => { if (event.key === 'Escape' && showing) { event.preventDefault(); dismiss() } }}>
    <div className="sprout-anchor">
      <button ref={trigger} className="sprout-trigger" type="button" aria-label={supporter ? 'Open a pocket mushroom or herb poem' : 'Optional project support for 10 US dollars per year'} aria-expanded={showing} aria-controls={popupId}
        onMouseEnter={() => { if (!motionDisabled) start() }} onFocus={() => { if (!skipFocus.current && !motionDisabled) start() }} onClick={() => showing ? dismiss() : start()}>
        <BotanicalSpecimen key={collection} collection={collection} phase={motionDisabled ? 'still' : phase === 'fading' ? 'dormant' : phase} onReady={setArtworkReady} />
      </button>
      {showing && <div className={`sprout-bubble${supporter ? ' sprout-bubble--poem' : ''}`} id={popupId} inert={fading} aria-hidden={fading || undefined} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
        {supporter ? <div className="sprout-poem"><span>Pocket poem · {poemIndex + 1} of {SUPPORTER_POEMS.length}</span><strong>{poem.title}</strong><p>{poem.lines.map(line => <span key={line}>{line}</span>)}</p><button type="button" onClick={advancePoem}>Another poem <ArrowRight size={12} aria-hidden="true" /></button></div>
          : <a className="sprout-invitation" href={`/supporters${collection === 'herbs' ? '?collection=herbs' : ''}`}><span>All field tools are free. Optional support unlocks small thank-yous and is never expected.</span><strong>Optional support · $10/year ↗</strong></a>}
        <button className="sprout-close" type="button" aria-label={supporter ? 'Close pocket poem' : 'Close supporter invitation'} onClick={dismiss}><X size={13} aria-hidden="true" /></button>
      </div>}
    </div>
  </div>
}
