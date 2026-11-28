import React, { useEffect, useState } from 'react'
import api from './api'

const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const emptySchedule = { time_zone: '', weekly: [], exceptions: [], legacy_count: 0 }
const fieldStyle = { padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }

export default function NutritionistSchedule() {
  const [schedule, setSchedule] = useState(null)
  const [legacyZone, setLegacyZone] = useState('')
  const [legacyItems, setLegacyItems] = useState([])
  const [choices, setChoices] = useState({})
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/nutritionist/schedule')
      if (!data || typeof data.time_zone !== 'string' || !Array.isArray(data.weekly) ||
          !Array.isArray(data.exceptions) || !Number.isInteger(data.legacy_count)) {
        throw new Error('Invalid schedule response')
      }
      setSchedule(data)
    } catch {
      setError('No se pudo cargar la configuración de agenda.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const previewLegacy = async () => {
    if (!legacyZone.trim()) {
      setError('Indica primero la zona horaria en que se registraron las citas antiguas.')
      return
    }
    setPreviewLoading(true)
    setError('')
    setLegacyItems([])
    setChoices({})
    try {
      const { data } = await api.get('/nutritionist/schedule/legacy-times', { params: { time_zone: legacyZone.trim() } })
      if (!Array.isArray(data?.items)) throw new Error('Invalid legacy preview')
      setLegacyItems(data.items)
    } catch {
      setError('No se pudieron revisar las citas antiguas. Confirma la zona y vuelve a intentarlo.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const setWeekly = (index, key, value) => setSchedule(current => ({
    ...current, weekly: current.weekly.map((item, i) => i === index ? { ...item, [key]: value } : item),
  }))
  const setException = (index, patch) => setSchedule(current => ({
    ...current, exceptions: current.exceptions.map((item, i) => i === index ? { ...item, ...patch } : item),
  }))

  const save = async () => {
    if (!schedule.time_zone.trim()) {
      setError('Indica la zona horaria del profesional.')
      return
    }
    const unresolved = legacyItems.filter(item => item.status !== 'unambiguous' && !choices[`${item.kind}:${item.id}`])
    if (schedule.legacy_count > 0 && (legacyItems.length !== schedule.legacy_count || unresolved.length)) {
      setError('Revisa todas las citas antiguas y selecciona la ocurrencia correcta o captura el instante confirmado antes de guardar.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.put('/nutritionist/schedule', {
        time_zone: schedule.time_zone.trim(),
        legacy_time_zone: legacyZone.trim(),
        legacy_instants: choices,
        weekly: schedule.weekly,
        exceptions: schedule.exceptions,
      })
      setNotice('Agenda guardada. Las citas conservan su instante; al cambiar de zona puede cambiar la hora mostrada.')
      setLegacyItems([])
      setChoices({})
      await load()
    } catch (e) {
      const code = e?.response?.data?.code
      setError(code === 'legacy_time_needs_review'
        ? 'Una cita necesita una resolución explícita. Revisa la zona y vuelve a cargar la vista previa.'
        : code === 'legacy_zone_required'
          ? 'Confirma la zona horaria de las citas anteriores.'
          : e?.response?.status === 400
            ? 'Revisa las fechas y horarios; usa intervalos válidos que no se superpongan.'
            : 'No se pudo guardar la agenda. Comprueba tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p role="status">Cargando agenda…</p>
  if (!schedule) return <section><p role="alert">{error}</p><button onClick={load}>Reintentar</button></section>

  const buttonStyle = { padding: '8px 12px', margin: '6px 4px 6px 0' }
  return (
    <section aria-label="Configuración de agenda profesional" style={{ display: 'grid', gap: 12, maxWidth: 900 }}>
      <h2>Configurar agenda</h2>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <label style={{ display: 'grid', gap: 6 }}>
        Zona horaria del profesional (por ejemplo, America/Mexico_City)
        <input aria-label="Zona horaria profesional" style={fieldStyle} value={schedule.time_zone}
          onChange={e => setSchedule(current => ({ ...current, time_zone: e.target.value }))} />
      </label>

      <fieldset>
        <legend>Horario semanal</legend>
        {schedule.weekly.map((interval, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, margin: '8px 0', flexWrap: 'wrap' }}>
            <label>Día <select aria-label={`Día semanal ${index + 1}`} value={interval.day_of_week}
              onChange={e => setWeekly(index, 'day_of_week', Number(e.target.value))}>
              {days.map((day, value) => <option key={day} value={value}>{day}</option>)}
            </select></label>
            <label>Inicio <input aria-label={`Inicio semanal ${index + 1}`} style={fieldStyle} type="time" value={interval.start_time}
              onChange={e => setWeekly(index, 'start_time', e.target.value)} /></label>
            <label>Fin <input aria-label={`Fin semanal ${index + 1}`} style={fieldStyle} type="time" value={interval.end_time}
              onChange={e => setWeekly(index, 'end_time', e.target.value)} /></label>
            <button type="button" onClick={() => setSchedule(current => ({ ...current, weekly: current.weekly.filter((_, i) => i !== index) }))}>Eliminar</button>
          </div>
        ))}
        <button type="button" style={buttonStyle} onClick={() => setSchedule(current => ({ ...current, weekly: [...current.weekly, { day_of_week: 1, start_time: '09:00', end_time: '17:00' }] }))}>Agregar horario</button>
      </fieldset>

      <fieldset>
        <legend>Excepciones por fecha</legend>
        <p>Una excepción sin intervalos cierra ese día. Las citas existentes no se mueven.</p>
        {schedule.exceptions.map((exception, index) => (
          <div key={index} style={{ border: '1px solid #cbd5e1', padding: 10, margin: '8px 0' }}>
            <label>Fecha <input aria-label={`Fecha excepción ${index + 1}`} style={fieldStyle} type="date" value={exception.date}
              onChange={e => setException(index, { date: e.target.value })} /></label>
            {exception.intervals.map((interval, intervalIndex) => (
              <div key={intervalIndex} style={{ display: 'flex', gap: 8, margin: 8, flexWrap: 'wrap' }}>
                <label>Inicio <input aria-label={`Inicio excepción ${index + 1}-${intervalIndex + 1}`} style={fieldStyle} type="time" value={interval.start_time}
                  onChange={e => setException(index, { intervals: exception.intervals.map((item, i) => i === intervalIndex ? { ...item, start_time: e.target.value } : item) })} /></label>
                <label>Fin <input aria-label={`Fin excepción ${index + 1}-${intervalIndex + 1}`} style={fieldStyle} type="time" value={interval.end_time}
                  onChange={e => setException(index, { intervals: exception.intervals.map((item, i) => i === intervalIndex ? { ...item, end_time: e.target.value } : item) })} /></label>
                <button type="button" onClick={() => setException(index, { intervals: exception.intervals.filter((_, i) => i !== intervalIndex) })}>Eliminar intervalo</button>
              </div>
            ))}
            <button type="button" onClick={() => setException(index, { intervals: [...exception.intervals, { start_time: '09:00', end_time: '17:00' }] })}>Agregar intervalo</button>
            <button type="button" onClick={() => setSchedule(current => ({ ...current, exceptions: current.exceptions.filter((_, i) => i !== index) }))}>Eliminar excepción</button>
          </div>
        ))}
        <button type="button" onClick={() => setSchedule(current => ({ ...current, exceptions: [...current.exceptions, { date: '', intervals: [] }] }))}>Agregar excepción</button>
      </fieldset>

      {schedule.legacy_count > 0 && <fieldset>
        <legend>Revisar {schedule.legacy_count} cita(s) o propuesta(s) antigua(s)</legend>
        <p>Confirma la zona en que se registraron. Las horas repetidas requieren elegir una ocurrencia. Para horas inválidas o inexistentes, confirma el instante real con el paciente antes de capturarlo.</p>
        <label>Zona horaria anterior <input aria-label="Zona horaria anterior" style={fieldStyle} value={legacyZone}
          onChange={e => { setLegacyZone(e.target.value); setLegacyItems([]); setChoices({}) }} placeholder="America/Mexico_City" /></label>
        <button type="button" disabled={previewLoading} onClick={previewLegacy}>{previewLoading ? 'Revisando…' : 'Revisar citas antiguas'}</button>
        {legacyItems.map(item => {
          const key = `${item.kind}:${item.id}`
          return <div key={key} style={{ borderTop: '1px solid #cbd5e1', padding: 10 }}>
            <strong>{item.kind === 'appointment' ? 'Cita' : 'Propuesta'} #{item.id}</strong> — {item.date || 'sin fecha'} {item.time || 'sin hora'} · {item.status}
            {item.status === 'unambiguous' && <p>Instante interpretado: {item.instants[0]}</p>}
            {item.status === 'ambiguous' && <label>Elige la ocurrencia
              <select aria-label={`Ocurrencia ${key}`} value={choices[key] || ''} onChange={e => setChoices(current => ({ ...current, [key]: e.target.value }))}>
                <option value="">Seleccionar…</option>
                {item.instants.map(instant => <option key={instant} value={instant}>{instant} (UTC)</option>)}
              </select>
            </label>}
            {['invalid', 'nonexistent', 'missing'].includes(item.status) && <label>Instante confirmado (RFC3339 con offset)
              <input aria-label={`Instante confirmado ${key}`} style={fieldStyle} placeholder="2026-11-01T01:30:00-06:00" value={choices[key] || ''}
                onChange={e => setChoices(current => ({ ...current, [key]: e.target.value }))} />
            </label>}
          </div>
        })}
      </fieldset>}
      <button type="button" disabled={saving} style={buttonStyle} onClick={save}>{saving ? 'Guardando…' : 'Guardar agenda'}</button>
    </section>
  )
}
