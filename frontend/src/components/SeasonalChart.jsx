import { BarChart3 } from 'lucide-react'
import { useSeasonality } from '../hooks/useCompanion'
import { useId, useState } from 'react'
import { useVisitorCountry } from '../hooks/useVisitorCountry'
import { hemisphereForBounds } from '../lib/seasonScope'
import { regionBySlug } from '../data/regions'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function SeasonalChart({ taxonId, regionSlug, hemisphere, compact = false }) {
  const id = useId()
  const [selection, setSelection] = useState(null)
  const country = useVisitorCountry(!regionSlug && !hemisphere && !selection)
  const scope = selection || hemisphere || hemisphereForBounds(country.data?.bbox)
  const label = regionSlug ? regionBySlug[regionSlug]?.name || regionSlug : scope === 'south' ? 'Southern hemisphere' : scope === 'north' ? 'Northern hemisphere' : 'Choose a hemisphere'
  const { data, isLoading, isError } = useSeasonality({ taxonId, regionSlug, hemisphere: scope })
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
      <p className="season-chart-source"><strong>{label}</strong> · All recorded years; not a current forecast.</p>
      {!regionSlug && <label className="season-scope" htmlFor={id}>Geographic scope <select id={id} value={scope || ''} onChange={event => setSelection(event.target.value)}><option value="" disabled>Choose a hemisphere</option><option value="north">Northern hemisphere</option><option value="south">Southern hemisphere</option></select></label>}
      {!regionSlug && !scope && <p>Choose the hemisphere you want to study. Country detection is approximate and some countries span the equator.</p>}
      {isLoading && <div className="season-chart-loading" role="status">Reading the seasonal archive...</div>}
      {isError && <p className="season-chart-error">Seasonal evidence is temporarily unavailable.</p>}
      {data && (
        <>
          <div className="season-bars" role="img" aria-label={`${label}. ${data.counts.map((count, index) => `${MONTH_NAMES[index]}: ${count}`).join('; ')}. Peak month is ${peak >= 0 ? MONTH_NAMES[peak] : 'not available'}.`}>
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
