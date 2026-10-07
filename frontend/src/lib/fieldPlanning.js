// Field planning uses public observations; private coordinates never enter share links.
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dateLabel(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date not recorded'
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function observationResults(items, { query = '', sort = 'recent', savedOnly = false, savedIds = new Set() } = {}) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return items.filter(item => {
    if (savedOnly && !savedIds.has(item.id)) return false
    const text = [item.species?.common_name, item.species?.latin_name, item.place_name, item.habitat_type, item.substrate].filter(Boolean).join(' ').toLocaleLowerCase()
    return words.every(word => text.includes(word))
  }).sort((a, b) => {
    const recent = (b.found_on || '').localeCompare(a.found_on || '')
    return (sort === 'species' ? (a.species?.common_name || '').localeCompare(b.species?.common_name || '') || recent : recent) || String(a.id).localeCompare(String(b.id))
  })
}

export function plannedPlaces(items) {
  return [...items].sort((a, b) => (a.revisit_on || '9999').localeCompare(b.revisit_on || '9999') || a.title.localeCompare(b.title))
}

export function revisitStatus(value, today = localDateKey()) {
  if (!value) return 'Choose a return date'
  if (value < today) return 'Ready to revisit'
  if (value === today) return 'Planned for today'
  return `Planned for ${dateLabel(value)}`
}

export function observationPath(id) {
  return `/map?observation=${encodeURIComponent(id)}`
}

const calendarText = value => String(value).replaceAll('\\', '\\\\').replace(/\r?\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,')
// RFC 5545 folds at 75 octets without splitting a UTF-8 character.
function foldLine(line) {
  const encoder = new TextEncoder()
  const chunks = []
  let chunk = '', bytes = 0
  for (const character of line) {
    const size = encoder.encode(character).length
    if (bytes + size > 75) { chunks.push(chunk); chunk = ' '; bytes = 1 }
    chunk += character; bytes += size
  }
  return [...chunks, chunk].join('\r\n')
}
export function revisitCalendar(item, now = new Date()) {
  if (!item.revisit_on || !/^\d{4}-\d{2}-\d{2}$/.test(item.revisit_on)) throw new Error('Choose a revisit date first.')
  const start = new Date(`${item.revisit_on}T12:00:00Z`)
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== item.revisit_on) throw new Error('Choose a valid revisit date.')
  start.setUTCDate(start.getUTCDate() + 1)
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//World Mushroom Foraging//Field Plans//EN',
    'BEGIN:VEVENT', `UID:${calendarText(item.id)}@worldmushroomforaging.org`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${item.revisit_on.replaceAll('-', '')}`,
    `DTEND;VALUE=DATE:${start.toISOString().slice(0, 10).replaceAll('-', '')}`,
    `SUMMARY:${calendarText(`Field visit: ${item.title}`)}`,
    `DESCRIPTION:${calendarText('Review your saved place in your field desk. Check current access and conditions before leaving. Map points may be approximate and do not confirm identification or permission to collect.')}`,
    'URL:https://worldmushroomforaging.org/account?tab=saved',
    'CLASS:PRIVATE', 'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR', '',
  ].map(foldLine).join('\r\n')
}

export function downloadRevisit(item) {
  const url = URL.createObjectURL(new Blob([revisitCalendar(item)], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url; link.download = 'field-visit.ics'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// A list can select its scope without downloading or constructing a WebGL map.
export function viewportForTarget(target) {
  if (target?.bbox?.length === 4 && target.bbox.every(Number.isFinite)) {
    const [west, south, east, north] = target.bbox
    return { west, south, east, north }
  }
  if (target?.center?.length === 2 && target.center.every(Number.isFinite)) {
    const [lng, lat] = target.center
    const wrap = value => ((value + 180) % 360 + 360) % 360 - 180
    return { west: wrap(lng - 1), east: wrap(lng + 1), south: Math.max(-85, lat - 1), north: Math.min(85, lat + 1) }
  }
  return null
}

export function observationCoverage(items, today = localDateKey()) {
  const dates = items.map(item => item.found_on).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && value <= today).sort()
  const cutoff = new Date(`${today}T12:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - 14)
  const recent = dates.filter(value => value >= cutoff.toISOString().slice(0, 10)).length
  return { count: items.length, latest: dates.at(-1) ?? null, recent, limited: items.length < 5, capped: items.length >= 4000 }
}
