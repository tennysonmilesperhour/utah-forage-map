import { useEffect, useRef } from 'react'
import { ADSENSE_CLIENT, isAdSenseEnabled, pushAdSlot } from '../lib/adsense'

// A single manual AdSense unit. Renders nothing until AdSense is configured
// (VITE_ADSENSE_CLIENT) and a `slot` ID from the AdSense dashboard is provided,
// so it is safe to place in the layout ahead of activation.
//
// Usage once configured:
//   <AdSlot slot="1234567890" />
//   <AdSlot slot="1234567890" format="rectangle" responsive={false} />
export default function AdSlot({
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  style,
}) {
  const insRef = useRef(null)

  useEffect(() => {
    if (!isAdSenseEnabled || !slot) return
    // Only request a fill for a unit that has not been filled yet, so React
    // re-renders (e.g. Strict Mode double-invoke) do not double-push.
    if (insRef.current?.dataset.adsbygoogleStatus) return
    pushAdSlot()
  }, [slot])

  if (!isAdSenseEnabled || !slot) return null

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`.trim()}
      style={{ display: 'block', ...style }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  )
}
