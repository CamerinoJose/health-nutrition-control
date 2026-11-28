export function availableSlots(slots) {
  if (!Array.isArray(slots) || slots.some(slot =>
    !slot || typeof slot.start_time !== 'string' ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.start_time) ||
    typeof slot.available !== 'boolean' ||
    typeof slot.starts_at !== 'string' || Number.isNaN(Date.parse(slot.starts_at)) ||
    typeof slot.time_zone !== 'string' || !slot.time_zone ||
    typeof slot.utc_offset !== 'string' || !/^[+-]\d{2}:\d{2}$/.test(slot.utc_offset)
  )) {
    throw new Error('Invalid appointment slots response')
  }
  return slots.filter(slot => slot.available)
}

export function slotLabel(slot) {
  return `${slot.start_time} (UTC${slot.utc_offset})`
}

export function localDateInput(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function localMonthInput(date = new Date()) {
  return localDateInput(date).slice(0, 7)
}

export function slotErrorMessage(error) {
  const code = error?.response?.data?.code
  if (code === 'schedule_not_configured' || code === 'legacy_zone_required') {
    return 'El profesional debe configurar su agenda y confirmar su zona horaria.'
  }
  if (code === 'ambiguous_time') {
    return 'Selecciona una de las opciones de horario disponibles.'
  }
  if (error?.response?.status === 409) {
    return 'El horario ya no está disponible. Consulta los horarios de nuevo.'
  }
  return 'No pudimos cargar horarios disponibles'
}
