import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { useSupporterMotion } from '../lib/supporterMotion'
import { MUSHROOM_TIMING, mushroomShapes, nextMushroomPhase, wiltShapes } from '../lib/mushroomShapes'
import '../supporter.css'

function Tween({ attributeName, values, duration, type }) {
  const timing = {
    begin: 'indefinite', dur: `${duration}ms`, fill: 'freeze',
    values: values.join(';'), keyTimes: values.map((_, i) => i / (values.length - 1)).join(';'),
    calcMode: 'spline', keySplines: values.slice(1).map(() => '.4 0 .2 1').join(';'),
  }
  return type ? <animateTransform attributeName="transform" type={type} {...timing} /> : <animate attributeName={attributeName} {...timing} />
}

export function MushroomFriend({ className = '', phase = 'still' }) {
  const svg = useRef(null)
  const id = useId().replaceAll(':', '')
  const moving = phase === 'forming' || phase === 'wilting'
  const forming = phase === 'forming'
  const contours = forming ? mushroomShapes : wiltShapes
  const duration = MUSHROOM_TIMING[phase]
  const visible = phase !== 'dormant' && !forming
  const contour = part => moving ? contours[part][0] : mushroomShapes[part].at(-1)

  useEffect(() => {
    // Start newly inserted SMIL contours at the current SVG time, including on
    // later cycles. A document-relative begin="0s" would only work once.
    svg.current?.querySelectorAll('animate, animateTransform').forEach(animation => animation.beginElement())
  }, [phase])

  return <svg ref={svg} className={`mushroom-friend ${className}`} data-mushroom-phase={phase} viewBox="-2 0 84 86" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-cap`} x1="23" y1="16" x2="54" y2="48" gradientUnits="userSpaceOnUse"><stop stopColor="#99543d" /><stop offset=".45" stopColor="#623330" /><stop offset="1" stopColor="#271d26" /></linearGradient>
      <linearGradient id={`${id}-stem`} x1="33" y1="41" x2="48" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#59452f" /><stop offset=".3" stopColor="#d0bd89" /><stop offset=".66" stopColor="#9c8558" /><stop offset="1" stopColor="#334a32" /></linearGradient>
      <radialGradient id={`${id}-hood`}><stop stopColor="#151c18" /><stop offset="1" stopColor="#785239" /></radialGradient>
    </defs>
    <ellipse cx="40" cy="79" rx="28" ry="4" fill="#020b07" opacity=".7" />
    <g className="mushroom-mycelium" stroke="#a4b579" strokeWidth=".9" strokeLinecap="round" opacity="0">
      <path d="M40 80 Q30 77 20 80 M31 79 26 74 M40 80 Q48 78 62 80 M49 79 55 74 M40 80 40 84" />
      {moving && <Tween key={phase} attributeName="opacity" duration={duration} values={forming ? [0, .7, .3, .08, 0] : [0, .15, .65, .4, 0]} />}
    </g>
    <g className="mushroom-body" opacity={visible ? 1 : 0}>
      {moving && <Tween key={`body-${phase}`} attributeName="opacity" duration={duration} values={forming ? [0, 1, 1, 1, 1] : [1, 1, 1, .8, 0]} />}
      <path className="mushroom-cap" d={contour('cap')} fill={`url(#${id}-cap)`} stroke="#c49362" strokeWidth="1.1" strokeLinejoin="round">
        {moving && <Tween key={phase} attributeName="d" values={contours.cap} duration={duration} />}
      </path>
      <path className="mushroom-hood" d={contour('hood')} fill={`url(#${id}-hood)`} stroke="#b18b5c" strokeWidth=".7">
        {moving && <Tween key={phase} attributeName="d" values={contours.hood} duration={duration} />}
      </path>
      <g className="mushroom-gills" stroke="#c29b65" strokeWidth=".7" opacity={moving ? 0 : .55}>
        <path d="m19 42 14 2m-7 3 10-5m25 0-14 2m7 3-10-5" />
        {moving && <Tween key={phase} attributeName="opacity" duration={duration} values={forming ? [0, 0, 0, .3, .55] : [.55, 0, 0, 0, 0]} />}
      </g>
      {/* The stem is drawn over the gills and reaches into the hood at y=37. */}
      <path className="mushroom-stem" d={contour('stem')} fill={`url(#${id}-stem)`} stroke="#baa16a" strokeWidth=".8">
        {moving && <Tween key={phase} attributeName="d" values={contours.stem} duration={duration} />}
      </path>
      <g className="mushroom-cap-details" opacity={moving ? 0 : 1}>
        <path d="M18 31 C23 22 30 17 37 15" stroke="#dfa96b" strokeWidth="1.3" strokeLinecap="round" opacity=".8" />
        <ellipse cx="28" cy="26" rx="3.2" ry="1.8" transform="rotate(-24 28 26)" fill="#d2b17a" />
        <ellipse cx="50" cy="26" rx="2.5" ry="1.5" transform="rotate(22 50 26)" fill="#b8935e" />
        <ellipse cx="60" cy="36" rx="2.6" ry="1.5" fill="#bea16b" />
        {moving && <Tween key={phase} attributeName="opacity" duration={duration} values={forming ? [0, 0, 0, .25, 1] : [1, 0, 0, 0, 0]} />}
      </g>
      <g className="mushroom-face" opacity={moving ? 0 : 1}>
        {moving && <Tween key={`face-${phase}`} attributeName="opacity" duration={duration} values={forming ? [0, 0, 0, .3, 1] : [1, .6, 0, 0, 0]} />}
        {moving && <Tween key={`face-position-${phase}`} type="translate" duration={duration} values={forming ? ['0 24', '0 18', '0 7', '0 0', '0 0'] : ['0 0', '8 10', '11 19', '5 24', '0 26']} />}
        <path d="M36 54v2m8-2v2" stroke="#172019" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M37 61q3 3 6 0" stroke="#3c3424" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </g>
    <g className="mushroom-grass" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 80q-1-7-5-9 7 2 9 9m2 0q0-10-4-15 7 5 8 15m6 0q-2-7-5-10 7 4 8 10m7 0q-2-6-5-8 7 1 9 8m5 0q2-7 6-10-2 6-1 10m6 0q2-11 8-15-4 8-3 15m7 0q2-7 7-9-4 5-3 9" fill="#294b36" stroke="#58744c" strokeWidth=".9" />
      <path d="M7 81q17-4 32 0 15-4 34 0" stroke="#87925b" strokeWidth="1.1" />
      {moving && <Tween key={phase} attributeName="opacity" duration={duration} values={forming ? [.65, 1, .75, .8, .8] : [.8, .8, 1, .9, .65]} />}
    </g>
  </svg>
}

function subscribeReducedMotion(callback) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
function reducedMotionSnapshot() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }

export default function SupporterSprout({ collection = 'fungi', supporter = false }) {
  const [life, setLife] = useState({ phase: 'dormant', cycle: 0 })
  const [hovered, setHovered] = useState(false)
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
    if (phase === 'dormant' && motionDisabled) return
    const duration = motionDisabled ? 0 : phase === 'dormant' ? (cycle ? MUSHROOM_TIMING.resting : MUSHROOM_TIMING.initial) : MUSHROOM_TIMING[phase]
    const timer = window.setTimeout(() => setLife(current => current.phase === phase ? {
      phase: nextMushroomPhase(phase), cycle: current.cycle + (phase === 'wilting' ? 1 : 0),
    } : current), duration)
    return () => window.clearTimeout(timer)
  }, [phase, cycle, hovered, focused, motionDisabled])

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
      <MushroomFriend phase={motionDisabled ? 'still' : phase} />
    </button>
    {showing && <div className="sprout-bubble" id={popupId} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <a className="sprout-invitation" href={`/supporters${collection === 'herbs' ? '?collection=herbs' : ''}`}><span>{supporter ? 'You help this forest grow.' : 'Help this little world grow.'}</span><strong>{supporter ? 'Your supporter membership ↗' : 'Support the project · $10/year ↗'}</strong></a>
      <button className="sprout-close" type="button" aria-label="Close supporter invitation" onClick={dismiss}><X size={13} aria-hidden="true" /></button>
    </div>}
  </div>
}
