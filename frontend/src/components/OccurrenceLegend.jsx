import { BookOpen, Maximize2, X } from 'lucide-react'
import { occurrenceSnapshotLabel, speciesOccurrence } from '../data/occurrence'
import { monthRangeLabel, peakMonths } from '../lib/occurrenceGrid'

// Map key for the iNaturalist-style squares, plus the focused species' growing zone.
export default function OccurrenceLegend({
  collection, focus = null, hemisphere = 'north', zone = null, zoneLoading = false,
  onFitZone, onClear, clearLabel = 'Show all species', guideHref, className = '',
}) {
  const summary = focus ? speciesOccurrence(collection, focus.slug) : null
  const months = summary?.months?.[hemisphere]
  const otherHemisphere = hemisphere === 'north' ? 'south' : 'north'
  const localTotal = months?.reduce((sum, value) => sum + value, 0) ?? 0
  const peak = peakMonths(localTotal >= 12 ? months : summary?.months?.[otherHemisphere] ?? [])
  const peakHemisphere = localTotal >= 12 ? hemisphere : otherHemisphere
  const people = collection === 'herbs' ? 'plants' : 'fungi'

  return (
    <section className={`occurrence-legend ${collection} ${focus ? 'is-focused' : ''} ${className}`} aria-label="Map key">
      {focus ? (
        <div className="occurrence-legend-heading">
          <div>
            <span>Tracked records and growing zone</span>
            <strong>{focus.name}</strong>
            <em>{focus.latin}</em>
          </div>
          {onClear && <button type="button" onClick={onClear} aria-label={clearLabel} title={clearLabel}><X size={15} /></button>}
        </div>
      ) : (
        <div className="occurrence-legend-heading">
          <div><span>Where people report {people}</span><strong>Every catalogue species</strong></div>
        </div>
      )}

      <div className="occurrence-scale" aria-hidden="true"><i /><span>1 person</span><span>many people</span></div>
      <p className="occurrence-scale-note">Each square counts the different people with verified records there. Squares get smaller as you zoom in.</p>
      {focus && <div className="occurrence-zone-key"><i aria-hidden="true" /><span>{zone ? 'Known growing zone' : zoneLoading ? 'Loading growing zone…' : 'Growing zone unavailable'}</span></div>}
      <div className="occurrence-points-key"><i aria-hidden="true" /><span>{collection === 'herbs' ? 'Recent records from your search' : 'Recent reviewed finds'} appear as points when you zoom in</span></div>

      {summary && (
        <dl className="occurrence-stats">
          <div><dt>Verified records</dt><dd>{summary.total.toLocaleString()}</dd></div>
          <div><dt>People</dt><dd>{summary.observers.toLocaleString()}</dd></div>
          <div><dt>Most records ({peakHemisphere === 'north' ? 'N' : 'S'}. hemisphere)</dt><dd>{monthRangeLabel(peak)}</dd></div>
        </dl>
      )}
      {focus && (
        <div className="occurrence-actions">
          {zone && onFitZone && <button type="button" onClick={onFitZone}><Maximize2 size={14} />Show whole zone</button>}
          {guideHref && <a href={guideHref}><BookOpen size={14} />Species guide</a>}
        </div>
      )}
      <small className="occurrence-source">iNaturalist research-grade records · {occurrenceSnapshotLabel}. A square is where people found it, not proof it grows there now.</small>
    </section>
  )
}
