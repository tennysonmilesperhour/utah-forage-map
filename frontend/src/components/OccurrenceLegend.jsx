import { BookOpen, Maximize2, X } from 'lucide-react'
import { occurrenceSnapshotLabel, speciesOccurrence } from '../data/occurrence'
import { monthRangeLabel, peakMonths } from '../lib/occurrenceGrid'

// Map key for the focused species' growing zone, plus the switch for iNaturalist-style
// hotspot squares. Hotspots stay off until switched on, so the map opens on the records.
export default function OccurrenceLegend({
  collection, focus = null, hemisphere = 'north', zone = null, zoneLoading = false,
  hotspots = false, hotspotsStatus = 'ready', onToggleHotspots,
  onFitZone, onClear, clearLabel = 'Show all species', guideHref, className = '',
}) {
  const summary = focus ? speciesOccurrence(collection, focus.slug) : null
  const months = summary?.months?.[hemisphere]
  const otherHemisphere = hemisphere === 'north' ? 'south' : 'north'
  const localTotal = months?.reduce((sum, value) => sum + value, 0) ?? 0
  const peak = peakMonths(localTotal >= 12 ? months : summary?.months?.[otherHemisphere] ?? [])
  const peakHemisphere = localTotal >= 12 ? hemisphere : otherHemisphere
  const people = collection === 'herbs' ? 'plants' : 'fungi'
  const showSquares = hotspots && hotspotsStatus === 'ready'
  const hotspotsHint = hotspots && hotspotsStatus === 'loading' ? 'Loading hotspots…'
    : hotspots && hotspotsStatus === 'error' ? 'Hotspots are unavailable right now'
    : focus ? 'Where the most people have found it' : `Where the most people find ${people}`

  return (
    <section className={`occurrence-legend ${collection} ${focus ? 'is-focused' : ''} ${!focus && !hotspots ? 'is-collapsed' : ''} ${className}`} aria-label="Map key">
      {focus && (
        <div className="occurrence-legend-heading">
          <div>
            <span>Tracked records and growing zone</span>
            <strong>{focus.name}</strong>
            <em>{focus.latin}</em>
          </div>
          {onClear && <button type="button" onClick={onClear} aria-label={clearLabel} title={clearLabel}><X size={15} /></button>}
        </div>
      )}
      {focus && <div className="occurrence-zone-key"><i aria-hidden="true" /><span>{zone ? 'Known growing zone' : zoneLoading ? 'Loading growing zone…' : 'Growing zone unavailable'}</span></div>}

      <label className="occurrence-hotspots">
        <input type="checkbox" role="switch" checked={hotspots} onChange={event => onToggleHotspots?.(event.target.checked)} />
        <span><strong>Hotspots</strong><small>{hotspotsHint}</small></span>
      </label>
      {showSquares && (
        <>
          <div className="occurrence-scale" aria-hidden="true"><i /><span>fewer people</span><span>most people</span></div>
          <p className="occurrence-scale-note">The busiest squares in view{focus ? '' : ' for every catalogue species'}, shaded by how many different people have verified records there. Squares get smaller as you zoom in.</p>
          <div className="occurrence-points-key"><i aria-hidden="true" /><span>{collection === 'herbs' ? 'Recent records from your search' : 'Recent reviewed finds'} appear as points when you zoom in</span></div>
        </>
      )}

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
      {(focus || showSquares) && <small className="occurrence-source">iNaturalist research-grade records · {occurrenceSnapshotLabel}.{showSquares ? ' A square is where people found it, not proof it grows there now.' : ''}</small>}
    </section>
  )
}
