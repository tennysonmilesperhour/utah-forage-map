import { useState } from 'react'
import { Crosshair, MapPin, ShieldCheck, X } from 'lucide-react'
import { getApiError } from '../hooks/useAuth'
import { useUnitSystem } from '../hooks/useUnits'
import { approximateOffsetLabel, displayToMetres, elevationUnit, metresToDisplay } from '../lib/units'

const HABITAT_TYPES = ['forest', 'meadow', 'riparian', 'alpine', 'desert', 'scrubland', 'wetland']
const EMPTY_FORM = {
  species_id: '', found_on: '', habitat_type: '', elevation_m: '',
  place_name: '', substrate: '', weather_notes: '', photo_links: '', notes: '', location_privacy: 'approximate',
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
        substrate: form.substrate.trim() || undefined,
        weather_notes: form.weather_notes.trim() || undefined,
        elevation_ft: form.elevation_m === '' ? undefined : Number(form.elevation_m) * 3.28084,
        place_name: form.place_name.trim() || undefined,
        photo_urls: form.photo_links.split('\n').map(value => value.trim()).filter(Boolean).slice(0, 6),
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
            Elevation ({elevationUnit(unitSystem)})
            <input
              type="number"
              inputMode="numeric"
              placeholder={unitSystem === 'imperial' ? 'Feet' : 'Meters'}
              value={form.elevation_m === '' ? '' : Math.round(metresToDisplay(form.elevation_m, unitSystem))}
              onChange={event => setForm({
                ...form,
                elevation_m: event.target.value === '' ? '' : displayToMetres(event.target.value, unitSystem),
              })}
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
              <option key={habitat} value={habitat}>{habitat.charAt(0).toUpperCase() + habitat.slice(1)}</option>
            ))}
          </select>
        </label>

        <label>
          Substrate
          <input
            type="text"
            maxLength={120}
            placeholder="Soil, buried wood, hardwood log, conifer duff"
            value={form.substrate}
            onChange={event => setForm({ ...form, substrate: event.target.value })}
          />
        </label>

        <label>
          Recent weather
          <input
            type="text"
            maxLength={240}
            placeholder="Rainfall, temperature shift, or snowmelt"
            value={form.weather_notes}
            onChange={event => setForm({ ...form, weather_notes: event.target.value })}
          />
        </label>

        <label>
          Photo links
          <textarea
            rows="3"
            maxLength={6000}
            placeholder="One public image URL per line, up to six views"
            value={form.photo_links}
            onChange={event => setForm({ ...form, photo_links: event.target.value })}
          />
        </label>

        <label>
          Field notes
          <textarea
            rows="4"
            maxLength={1000}
            placeholder="Nearby trees, scent, bruising, size, and visible field marks"
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
