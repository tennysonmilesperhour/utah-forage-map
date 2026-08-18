import { useState } from 'react'
import {
  Bookmark, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink,
  FlaskConical, ShieldCheck, UserPlus, X,
} from 'lucide-react'
import { useObservationRecord, useVerifyObservation } from '../hooks/useCompanion'
import { getApiError } from '../hooks/useAuth'
import { speciesPathForTaxon } from '../content/species.generated'
import { formatElevation } from '../lib/units'

const FIELD_MARKS = [
  ['cap_checked', 'Cap'],
  ['underside_checked', 'Underside'],
  ['stem_checked', 'Stem'],
  ['base_checked', 'Base'],
  ['interior_checked', 'Interior'],
  ['substrate_checked', 'Substrate'],
  ['lookalikes_checked', 'Lookalikes'],
]

function foundDateLabel(value) {
  if (!value) return 'Unknown'
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function photoUrl(value) {
  if (!value) return ''
  return value.replace(/\/(square|small|thumb)(\.[^./]+)$/i, '/medium$2')
}

export default function ObservationRecord({
  sighting, user, unitSystem, onClose, onSave, saving, onCreateAccount, onOpenAccount, onToast,
}) {
  const { data } = useObservationRecord(sighting.id)
  const record = data ?? sighting
  const photos = data?.photos?.length ? data.photos : record.photo_url ? [{ url: record.photo_url, position: 0 }] : []
  const [photoIndex, setPhotoIndex] = useState(0)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const verify = useVerifyObservation()
  const [review, setReview] = useState({
    conclusion: 'uncertain', confidence: 'likely', notes: '',
    ...Object.fromEntries(FIELD_MARKS.map(([key]) => [key, false])),
  })
  const guidePath = speciesPathForTaxon(record.species?.inaturalist_taxon_id)

  async function submitReview(event) {
    event.preventDefault()
    setError('')
    try {
      await verify.mutateAsync({ id: record.id, ...review, notes: review.notes || null })
      setReviewing(false)
      onToast?.('Your field-mark review is now part of this record.')
    } catch (requestError) {
      setError(getApiError(requestError, 'Your review could not be saved.'))
    }
  }

  const currentPhoto = photos[Math.min(photoIndex, photos.length - 1)]
  const summary = data?.verification

  return (
    <article className="sighting-detail observation-record" aria-label="Selected observation">
      <button className="icon-button sighting-close" type="button" onClick={onClose} aria-label="Close observation details">
        <X size={18} aria-hidden="true" />
      </button>

      {currentPhoto && (
        <figure className="sighting-photo observation-plate">
          <img src={photoUrl(currentPhoto.url)} alt={`${record.species?.common_name ?? 'Mushroom'} field observation, view ${photoIndex + 1}`} />
          <figcaption>
            <span>Plate {photoIndex + 1} of {photos.length}{currentPhoto.attribution ? ` · ${currentPhoto.attribution}` : ''}</span>
            {photos.length > 1 && (
              <span className="plate-controls">
                <button type="button" onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)} aria-label="Previous photograph"><ChevronLeft size={17} /></button>
                <button type="button" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)} aria-label="Next photograph"><ChevronRight size={17} /></button>
              </span>
            )}
          </figcaption>
        </figure>
      )}

      <div className="sighting-heading">
        <div>
          <span className="sighting-accession">Field record {String(record.id).slice(0, 8).toUpperCase()}</span>
          <span className={record.verified ? 'status-reviewed' : 'status-pending'}>{record.verified ? 'Reviewed source' : 'Pending review'}</span>
          <h2>{record.species?.common_name ?? 'Unknown species'}</h2>
          {record.species?.latin_name && <p>{record.species.latin_name}</p>}
        </div>
      </div>

      {record.notes && <p className="sighting-notes">{record.notes}</p>}
      <dl>
        <div><dt>Observed</dt><dd>{foundDateLabel(record.found_on)}</dd></div>
        <div><dt>Place</dt><dd>{record.place_name ?? 'Not recorded'}</dd></div>
        <div><dt>Elevation</dt><dd>{formatElevation(record.elevation_ft, unitSystem)}</dd></div>
        <div><dt>Habitat</dt><dd>{record.habitat_type ?? 'Unknown'}</dd></div>
        <div><dt>Substrate</dt><dd>{record.substrate ?? 'Not recorded'}</dd></div>
        <div><dt>Recent weather</dt><dd>{record.weather_notes ?? 'Not recorded'}</dd></div>
      </dl>

      <section className="record-provenance">
        <FlaskConical size={17} aria-hidden="true" />
        <div><strong>{record.source}</strong><span>Public coordinates are {record.location_privacy}.</span></div>
        {data?.source_url && <a href={data.source_url} target="_blank" rel="noreferrer" aria-label="Open original source"><ExternalLink size={16} /></a>}
      </section>

      {summary && (
        <section className="verification-summary">
          <div className="verification-heading"><ShieldCheck size={18} aria-hidden="true" /><div><strong>Community field-mark review</strong><span>{summary.total} {summary.total === 1 ? 'review' : 'reviews'} · {summary.supports} support the proposed ID</span></div></div>
          {summary.total > 0 && <div className="field-mark-coverage">{FIELD_MARKS.map(([key, label]) => <span key={key} className={summary.field_mark_coverage[key.replace('_checked', '')] ? 'checked' : ''}>{label}</span>)}</div>}
        </section>
      )}

      <div className="record-actions">
        <button className="button button-secondary" type="button" onClick={() => onSave(record)} disabled={saving || !data}><Bookmark size={17} /> {saving ? 'Saving...' : 'Save place'}</button>
        {guidePath && <a className="button button-secondary" href={guidePath}><BookOpen size={17} /> Identification guide</a>}
        {!user && <button className="button button-secondary" type="button" onClick={() => onCreateAccount('verify')}><UserPlus size={17} /> Review field marks</button>}
        {user && !user.email_verified && <button className="button button-secondary" type="button" onClick={onOpenAccount}><ShieldCheck size={17} /> Verify email to review</button>}
        {user?.email_verified && <button className="button button-secondary" type="button" onClick={() => setReviewing(!reviewing)}><CheckCircle2 size={17} /> {reviewing ? 'Close review' : 'Review field marks'}</button>}
      </div>

      {reviewing && user?.email_verified && (
        <form className="verification-form" onSubmit={submitReview}>
          <h3>Compare the visible evidence</h3>
          <div className="verification-fields">
            {FIELD_MARKS.map(([key, label]) => (
              <label key={key}><input type="checkbox" checked={review[key]} onChange={event => setReview({ ...review, [key]: event.target.checked })} /> {label}</label>
            ))}
          </div>
          <div className="paired-fields">
            <label>Conclusion<select value={review.conclusion} onChange={event => setReview({ ...review, conclusion: event.target.value })}><option value="supports">Supports proposed ID</option><option value="uncertain">Not enough evidence</option><option value="disagrees">Suggests another ID</option></select></label>
            <label>Confidence<select value={review.confidence} onChange={event => setReview({ ...review, confidence: event.target.value })}><option value="uncertain">Uncertain</option><option value="likely">Likely</option><option value="confident">Confident</option></select></label>
          </div>
          <label>Review note<textarea rows="3" maxLength="1200" value={review.notes} onChange={event => setReview({ ...review, notes: event.target.value })} placeholder="Name the evidence you could and could not evaluate" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary" disabled={verify.isPending}>{verify.isPending ? 'Saving review...' : 'Add review to record'}</button>
        </form>
      )}
    </article>
  )
}
