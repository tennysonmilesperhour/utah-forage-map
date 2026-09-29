import { ArrowRight, MapPinned } from 'lucide-react'
import { useGrowingZone, useOccurrence } from '../hooks/useOccurrence'
import { occurrenceSnapshotLabel, speciesOccurrence } from '../data/occurrence'
import { cellBounds, intensityScale, MONTH_NAMES, monthRangeLabel, peakMonths } from '../lib/occurrenceGrid'

const VIEW = { west: -180, north: 84, width: 360, height: 144 }
// Prerendered in Node, so a fixed locale keeps hydration identical in every browser.
const formatCount = new Intl.NumberFormat('en-US').format

function ringPath(ring) {
  return `M${ring.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L')}Z`
}

function zonePath(geometry) {
  if (!geometry) return ''
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.flatMap(polygon => polygon.map(ringPath)).join('')
}

// A coarse level keeps the preview light; the field map shows the fine squares.
function previewLevel(dataset) {
  if (!dataset?.levels) return null
  const byRes = Object.fromEntries(dataset.levels.map(level => [level.res, level]))
  const two = byRes[2]
  return two && two.decoded.length >= 25 ? two : byRes[1] ?? two ?? null
}

function MonthBars({ months, hemisphere, name }) {
  const max = Math.max(...months, 1)
  const total = months.reduce((sum, value) => sum + value, 0)
  const label = hemisphere === 'north' ? 'Northern hemisphere' : 'Southern hemisphere'
  return (
    <figure className="distribution-months">
      <figcaption>{label} · {formatCount(total)} dated records</figcaption>
      <div className="distribution-month-bars" aria-hidden="true">
        {months.map((value, index) => (
          <span key={MONTH_NAMES[index]} title={`${MONTH_NAMES[index]}: ${formatCount(value)} records`}>
            <i style={{ height: `${Math.max(value ? 4 : 0, (value / max) * 100)}%` }} />
            <b>{MONTH_NAMES[index][0]}</b>
          </span>
        ))}
      </div>
      {/* A table ignores its 1px width and grows to fit its caption, so the wrapper does the clipping. */}
      <div className="sr-only">
        <table>
          <caption>{name} verified records by month, {label.toLowerCase()}</caption>
          <tbody>{months.map((value, index) => <tr key={MONTH_NAMES[index]}><th scope="row">{MONTH_NAMES[index]}</th><td>{value}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  )
}

export default function SpeciesDistribution({ collection, slug, name, mapHref, showMonths = false }) {
  const summary = speciesOccurrence(collection, slug)
  const occurrence = useOccurrence(collection, slug)
  const zone = useGrowingZone(collection, slug)
  if (!summary) return null
  const level = previewLevel(occurrence.data)
  const scale = intensityScale(level?.decoded ?? [])
  const path = zonePath(zone.data?.geometry)
  const hemispheres = ['north', 'south'].filter(side => summary.months[side].reduce((sum, value) => sum + value, 0) >= Math.max(10, summary.total * 0.05))
  const mainHemisphere = hemispheres[0] ?? 'north'
  const peak = peakMonths(summary.months[mainHemisphere])
  const sources = zone.data?.properties?.sources ?? []

  return (
    <section className={`species-distribution ${collection}`} aria-labelledby={`distribution-${slug}`}>
      <div className="distribution-heading">
        <div>
          <p>Where it grows</p>
          <h2 id={`distribution-${slug}`}>Tracked records and known growing zone</h2>
        </div>
        <a href={mapHref}><MapPinned size={16} aria-hidden="true" />Explore on the field map<ArrowRight size={15} aria-hidden="true" /></a>
      </div>
      <div className="distribution-body">
        <figure className="distribution-map">
          <div className="distribution-land" aria-hidden="true" />
          <svg viewBox={`${VIEW.west} ${-VIEW.north} ${VIEW.width} ${VIEW.height}`} preserveAspectRatio="none" role="img" aria-label={`World map of ${name}: squares show where people recorded it, the dashed outline shows its known growing zone.`}>
            {path && <path className="distribution-zone-fill" d={path} fillRule="evenodd" />}
            {level?.decoded.map(cell => {
              const [west, south, east, north] = cellBounds(cell, level.res)
              if (north < -60) return null
              return <rect key={`${cell.x}-${cell.y}`} x={west} y={-north} width={east - west} height={north - south} style={{ opacity: 0.35 + scale(cell.observers) * 0.65 }}><title>{`${formatCount(cell.observers)} ${cell.observers === 1 ? 'person' : 'people'}, ${formatCount(cell.count)} records`}</title></rect>
            })}
            {path && <path className="distribution-zone-line" d={path} fillRule="evenodd" vectorEffect="non-scaling-stroke" />}
          </svg>
          {(occurrence.isLoading || zone.isLoading) && <span className="distribution-loading">Loading map…</span>}
          <figcaption>
            <span><i className="distribution-key-squares" aria-hidden="true" />Squares: where people recorded it, brighter where more people did</span>
            {path && <span><i className="distribution-key-zone" aria-hidden="true" />Known growing zone</span>}
          </figcaption>
        </figure>
        <div className="distribution-facts">
          <dl>
            <div><dt>Verified records</dt><dd>{formatCount(summary.total)}</dd></div>
            <div><dt>People who recorded it</dt><dd>{formatCount(summary.observers)}</dd></div>
            <div><dt>Most records ({mainHemisphere === 'north' ? 'northern' : 'southern'} hemisphere)</dt><dd>{monthRangeLabel(peak)}</dd></div>
            {summary.firstYear && <div><dt>Records span</dt><dd>{summary.firstYear}–{summary.lastMonth?.slice(0, 4)}</dd></div>}
          </dl>
          {showMonths && hemispheres.map(side => <MonthBars key={side} months={summary.months[side]} hemisphere={side} name={name} />)}
          <p className="distribution-note">
            Research-grade iNaturalist records, {occurrenceSnapshotLabel}. The growing zone combines {sources.includes('geomodel') ? 'iNaturalist\'s Geomodel expected range with ' : ''}areas where different people have repeatedly verified it. Records show where people looked and found it, not current abundance or permission to gather.
          </p>
        </div>
      </div>
    </section>
  )
}
