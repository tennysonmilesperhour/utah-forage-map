import { useState } from 'react'
import { Crosshair, MapPin, ShieldCheck, X } from 'lucide-react'
import { getApiError } from '../hooks/useAuth'
import { HABITAT_TYPES, habitatLabel } from '../lib/habitats'
import { useUnitSystem } from '../hooks/useUnits'
import { approximateOffsetLabel, displayToFeet, elevationLabel } from '../lib/units'

const EMPTY_FORM = {
  species_id: '', found_on: '', habitat_type: '', elevation: '',
  place_name: '', notes: '', location_privacy: 'approximate',
}

export default function SubmitDrawer({ species = [], location, onSubmit, onClose, creating }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const { system: unitSystem } = useUnitSystem()

  async function submit(event) {
    event.preventDefault()
    if (!location || !form.species_id) return
    setError('')

    try {
      await onSubmit({
        species_id: form.species_id,
        latitude: location.latitude,
        longitude: location.longitude,
        found_on: form.found_on || undefined,
        month: form.found_on ? Number(form.found_on.slice(5, 7)) : undefined,
        habitat_type: form.habitat_type || undefined,
        elevation_ft: displayToFeet(form.elevation, unitSystem),
        place_name: form.place_name.trim() || undefined,
        notes: form.notes || undefined,
        location_privacy: form.location_privacy,
      })
      setForm(EMPTY_FORM)
    } catch (requestError) {
      setError(getApiError(requestError, 'Your observation could not be submitted.'))
    }
  }

  return (
    <aside className="submit-drawer" role="dialog" aria-label="Add a field observation">
      <div className="drawer-heading">
        <div>
          <p>Private account action</p>
          <h2>Add a field observation</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close submission form">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <form className="submit-form" onSubmit={submit}>
        <div className={`location-picker-status ${location ? 'chosen' : ''}`}>
          {location ? <MapPin size={20} aria-hidden="true" /> : <Crosshair size={20} aria-hidden="true" />}
          <div>
            <strong>{location ? 'Location selected' : 'Choose a location on the map'}</strong>
            <span>
              {location
                ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                : 'The map remains active while this form is open.'}
            </span>
          </div>
        </div>

        <label>
          Species
          <select value={form.species_id} onChange={event => setForm({ ...form, species_id: event.target.value })} required>
            <option value="">Choose a mushroom</option>
            {species.map(item => <option key={item.id} value={item.id}>{item.common_name}</option>)}
          </select>
        </label>

        <div className="paired-fields">
          <label>
            Date found
            <input type="date" value={form.found_on} onChange={event => setForm({ ...form, found_on: event.target.value })} />
          </label>
          <label>
            Elevation
            <input
              type="number"
              inputMode="numeric"
              placeholder={elevationLabel(unitSystem) === 'm' ? 'Metres' : 'Feet'}
              value={form.elevation}
              onChange={event => setForm({ ...form, elevation: event.target.value })}
            />
          </label>
        </div>

        <label>
          Nearest place
          <input
            type="text"
            maxLength={160}
            placeholder="Region and country, for example Bavaria, Germany"
            value={form.place_name}
            onChange={event => setForm({ ...form, place_name: event.target.value })}
          />
        </label>

        <label>
          Habitat
          <select value={form.habitat_type} onChange={event => setForm({ ...form, habitat_type: event.target.value })}>
            <option value="">Choose a habitat</option>
            {HABITAT_TYPES.map(habitat => (
              <option key={habitat} value={habitat}>{habitatLabel(habitat)}</option>
            ))}
          </select>
        </label>

        <label>
          Field notes
          <textarea
            rows="4"
            maxLength={1000}
            placeholder="Substrate, nearby trees, recent weather, and visible field marks"
            value={form.notes}
            onChange={event => setForm({ ...form, notes: event.target.value })}
          />
        </label>

        <label>
          Public location
          <select value={form.location_privacy} onChange={event => setForm({ ...form, location_privacy: event.target.value })}>
            <option value="approximate">Approximate within {approximateOffsetLabel(unitSystem)}</option>
            <option value="private">Private, logbook only</option>
            <option value="exact">Exact point</option>
          </select>
        </label>

        <div className="privacy-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>The exact point stays in your logbook. Approximate is the safest public default, and private finds never appear on the map.</p>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="submit-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button button-primary" disabled={!location || !form.species_id || creating}>
            {creating ? 'Submitting...' : 'Submit for review'}
          </button>
        </div>
      </form>
    </aside>
  )
}
