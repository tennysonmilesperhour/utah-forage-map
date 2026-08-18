import { BarChart3 } from 'lucide-react'
import { useSeasonality } from '../hooks/useCompanion'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

export default function SeasonalChart({ taxonId, regionSlug, hemisphere = 'north', compact = false }) {
  const { data, isLoading, isError } = useSeasonality({ taxonId, regionSlug, hemisphere })
  const maximum = Math.max(...(data?.counts ?? [0]), 1)
  const peak = data?.counts?.indexOf(maximum) ?? -1

  return (
    <section className={`season-chart ${compact ? 'compact' : ''}`} aria-labelledby={`season-chart-${taxonId || regionSlug || hemisphere}`}>
      <div className="season-chart-heading">
        <div>
          <p className="eyebrow"><BarChart3 size={14} aria-hidden="true" /> Observation season</p>
          <h2 id={`season-chart-${taxonId || regionSlug || hemisphere}`}>When field records occur</h2>
        </div>
        {data && <span>{data.sample_size.toLocaleString()} records</span>}
      </div>
      {isLoading && <div className="season-chart-loading" role="status">Reading the seasonal archive...</div>}
      {isError && <p className="season-chart-error">Seasonal evidence is temporarily unavailable.</p>}
      {data && (
        <>
          <div className="season-bars" role="img" aria-label={`Monthly observations. Peak month is ${peak >= 0 ? MONTHS[peak] : 'not available'}.`}>
            {data.counts.map((count, index) => (
              <div className={index === peak ? 'peak' : ''} key={`${MONTHS[index]}-${index}`}>
                <span className="season-bar-value">{count.toLocaleString()}</span>
                <i style={{ '--bar-height': `${Math.max((count / maximum) * 100, count ? 5 : 0)}%` }} />
                <small>{MONTHS[index]}</small>
              </div>
            ))}
          </div>
          <p className="season-chart-source">All-time monthly pattern from research-grade iNaturalist observations. Use recent regional activity to judge current conditions.</p>
        </>
      )}
    </section>
  )
}
