import { BookHeart } from 'lucide-react'
import { plantReflections } from '../data/herbWisdom'
import HerbWisdomSources from './HerbWisdomSources'

export default function HerbPlantReflection({ herb }) {
  const reflection = plantReflections[herb.slug]
  if (!reflection) return null
  return (
    <section className="herb-plant-reflection" aria-label={`${herb.name} reflection`}>
      <p className="herb-kicker"><BookHeart size={16} aria-hidden="true" /> A moment with {herb.name.toLowerCase()}</p>
      <h3>{reflection.title}</h3>
      <dl><div><dt>Notice</dt><dd>{reflection.notice}</dd></div><div><dt>Listen inward</dt><dd>{reflection.feel}</dd></div><div><dt>Carry forward</dt><dd>{reflection.carry}</dd></div></dl>
      <p className="herb-reflection-note">An optional personal reflection. No gathering or use of the plant is needed.</p>
      <HerbWisdomSources />
    </section>
  )
}
