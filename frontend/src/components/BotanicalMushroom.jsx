import { useEffect, useRef, useState } from 'react'
import { createSpecimenRenderer, loadSpecimenArtwork } from '../lib/mushroomRenderer'

export default function BotanicalMushroom({ className = '', phase = 'still', onReady }) {
  const container = useRef(null)
  const canvas = useRef(null)
  const renderer = useRef(null)
  const phaseRef = useRef(phase)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    phaseRef.current = phase
    renderer.current?.setPhase(phase)
  }, [phase])

  useEffect(() => {
    let canceled = false
    const resize = () => {
      const bounds = container.current?.getBoundingClientRect()
      if (bounds) renderer.current?.resize(bounds.width, bounds.height)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container.current)
    loadSpecimenArtwork().then(artwork => {
      if (canceled) return
      renderer.current = createSpecimenRenderer(canvas.current, artwork)
      if (renderer.current) {
        resize()
        renderer.current.setPhase(phaseRef.current)
        setRendered(true)
      }
      onReady?.(true)
    }).catch(() => { if (!canceled) onReady?.(true) })
    return () => { canceled = true; observer.disconnect(); renderer.current?.destroy(); renderer.current = null }
  }, [onReady])

  return <span ref={container} className={`mushroom-friend ${className}`} data-phase={phase} data-rendered={rendered} aria-hidden="true">
    <img className="mushroom-fallback" src="/images/fungi/oyster-specimen.webp" alt="" decoding="async" />
    <canvas ref={canvas} className="mushroom-canvas" />
  </span>
}
