export const DEFAULT_FILTERS = Object.freeze({ recent_days: 90 })

function isSet(value) {
  return value !== undefined && value !== null && value !== ''
}

export function countActiveFilters(filters = {}) {
  let count = 0
  if (isSet(filters.species_id) || isSet(filters.taxon_id)) count += 1
  if (isSet(filters.place)) count += 1
  if (isSet(filters.recent_days) && filters.recent_days !== DEFAULT_FILTERS.recent_days) count += 1
  if (isSet(filters.month_min) || isSet(filters.month_max)) count += 1
  if (isSet(filters.elev_min_m) || isSet(filters.elev_max_m)) count += 1
  if (isSet(filters.habitat_type)) count += 1
  if (isSet(filters.source)) count += 1
  if (isSet(filters.edibility_group)) count += 1
  return count
}

export function countAdvancedFilters(filters = {}, currentMonth = new Date().getMonth() + 1) {
  let count = 0
  const quickRecency = filters.recent_days === 14
  const quickMonth = filters.month_min === currentMonth && filters.month_max === currentMonth
  if (isSet(filters.recent_days) && filters.recent_days !== 90 && !quickRecency) count += 1
  if ((isSet(filters.month_min) || isSet(filters.month_max)) && !quickMonth) count += 1
  if (isSet(filters.elev_min_m) || isSet(filters.elev_max_m)) count += 1
  if (isSet(filters.habitat_type)) count += 1
  if (isSet(filters.source)) count += 1
  return count
}
