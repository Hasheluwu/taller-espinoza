// datetime-local expects the user's local wall-clock time, not UTC.
export function localDateTime(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

// Compare calendar dates, without shifting a DATE value through UTC.
export function isExpired(value, today = localDateTime().slice(0, 10)) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && value.slice(0, 10) < today
}
