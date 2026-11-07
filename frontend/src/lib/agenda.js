export function appointmentReason(value) {
  if (typeof value !== 'string' || !value.trim() || /^(null|undefined)$/i.test(value.trim())) return ''
  return value.trim()
}
