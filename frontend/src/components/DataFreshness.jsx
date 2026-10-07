import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

function timestamp(value) {
  if (!value) return 'not yet available'
  return new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function DataFreshness({ compact = false }) {
  const { data, isError } = useQuery({
    queryKey: ['data-status'],
    queryFn: async ({ signal }) => (await axios.get('/api/data-status', { signal })).data,
    staleTime: 60000,
  })
  if (compact) return <p className="field-small" role="status">{isError ? 'Import status unavailable. Check observation dates.' : !data ? 'Checking observation imports…' : data.status === 'stale' || data.incremental_backlog ? `Imports are catching up. Records checked through ${timestamp(data.covered_through)}; recent records may be missing.` : `Imports checked through ${timestamp(data.covered_through)}. Import freshness and observation dates are different.`}</p>
  return <aside className={`data-freshness${data?.status === 'stale' ? ' is-stale' : ''}`} aria-label="Observation update status">
    <strong>{isError ? 'Update status unavailable' : data?.status === 'stale' ? 'Observation updates are catching up' : data ? 'Observation update status' : 'Dated field evidence'}</strong>
    {data ? <span>Changed records checked through: {timestamp(data.covered_through)}. Last import batch: {timestamp(data.last_batch_at)}.{data.incremental_backlog ? ' More records are waiting to be processed.' : ''} Full reconciliation: {timestamp(data.last_reconciled_at)}. Daily updates; observation dates are shown separately.</span> : <span>{isError ? 'Try again later; check each record’s observation date.' : 'Update status loads when connected. An observation does not establish current abundance or permission to gather.'}</span>}
  </aside>
}
