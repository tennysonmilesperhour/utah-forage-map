import { useId } from 'react'

// North-up phase illustration. The projected terminator is an ellipse whose
// horizontal radius shrinks to zero at a quarter and expands at new/full moon.
function illuminatedPath(illumination, waxing) {
  const amount = Math.max(0, Math.min(1, illumination))
  if (amount === 0) return ''
  const terminator = (1 - 2 * amount) * 46
  const outerSweep = waxing ? 1 : 0
  const innerSweep = terminator >= 0 ? 1 - outerSweep : outerSweep
  const edge = Math.abs(terminator) < 0.001
    ? 'L 100 54'
    : `A ${Math.abs(terminator)} 46 0 0 ${innerSweep} 100 54`
  return `M 100 54 A 46 46 0 0 ${outerSweep} 100 146 ${edge} Z`
}

export default function HerbMoonVisual({ moon }) {
  const id = useId()
  const phase = ((moon.angle % 360) + 360) % 360
  const light = illuminatedPath(moon.illumination, phase < 180)
  const ref = name => `url(#${id}-${name})`

  return (
    <div className="herb-moon-visual" aria-hidden="true">
      <svg viewBox="0 0 200 200" focusable="false">
        <defs>
          <radialGradient id={`${id}-halo`}>
            <stop offset="0.5" stopColor="#eff0da" stopOpacity="0.12" />
            <stop offset="1" stopColor="#eff0da" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-earthshine`} cx="34%" cy="28%" r="75%">
            <stop stopColor="#435045" />
            <stop offset="0.6" stopColor="#202d23" />
            <stop offset="1" stopColor="#0c1710" />
          </radialGradient>
          <radialGradient id={`${id}-silver`} cx="36%" cy="28%" r="80%">
            <stop stopColor="#f4f1df" />
            <stop offset="0.52" stopColor="#d9dac7" />
            <stop offset="1" stopColor="#a7b09b" />
          </radialGradient>
          <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.075" numOctaves="4" seed="12" />
            <feColorMatrix type="saturate" values="0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <clipPath id={`${id}-disc`}><circle cx="100" cy="100" r="46" /></clipPath>
          <clipPath id={`${id}-light`}><path d={light} /></clipPath>
        </defs>

        <circle cx="100" cy="100" r="76" fill={ref('halo')} />
        <circle className="herb-moon-orbit-track" cx="100" cy="100" r="78" />
        <path className="herb-moon-orbit-arc" d="M 40.25 150.14 A 78 78 0 0 1 150.14 40.25" />
        <g className="herb-moon-orbit-ticks">
          <path d="M100 19v6 M100 175v6 M19 100h6 M175 100h6" />
        </g>
        <circle className="herb-moon-phase-marker" cx="100" cy="22" r="1.5" transform={`rotate(${phase} 100 100)`} />

        <g clipPath={ref('disc')}>
          <circle cx="100" cy="100" r="46" fill={ref('earthshine')} />
          <circle cx="100" cy="100" r="46" fill="#dce4d4" filter={ref('grain')} opacity="0.1" />
          <g clipPath={ref('light')}>
            <circle cx="100" cy="100" r="46" fill={ref('silver')} />
            <circle cx="100" cy="100" r="46" fill="#fff" filter={ref('grain')} opacity="0.24" />
            <g fill="#536550" opacity="0.1">
              <ellipse cx="87" cy="80" rx="15" ry="10" transform="rotate(-24 87 80)" />
              <ellipse cx="112" cy="92" rx="10" ry="15" transform="rotate(20 112 92)" />
              <ellipse cx="91" cy="119" rx="11" ry="8" />
            </g>
          </g>
        </g>
        <circle className="herb-moon-limb" cx="100" cy="100" r="46" />
      </svg>
    </div>
  )
}
