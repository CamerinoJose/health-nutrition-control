import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import api from '../api'

const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const inputStyle = { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 8, marginVertical: 4, backgroundColor: '#fff' }
const isInterval = interval => interval && typeof interval.start_time === 'string' && typeof interval.end_time === 'string'

export default function ScheduleScreen({ onBack }) {
  const [schedule, setSchedule] = useState(null)
  const [legacyZone, setLegacyZone] = useState('')
  const [legacyItems, setLegacyItems] = useState([])
  const [legacyInstants, setLegacyInstants] = useState({})
  const [previewingLegacy, setPreviewingLegacy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/nutritionist/schedule')
      if (!data || typeof data.time_zone !== 'string' || !Array.isArray(data.weekly) ||
          !data.weekly.every(item => isInterval(item) && Number.isInteger(item.day_of_week) && item.day_of_week >= 0 && item.day_of_week <= 6) ||
          !Array.isArray(data.exceptions) || !data.exceptions.every(item => item && typeof item.date === 'string' &&
            Array.isArray(item.intervals) && item.intervals.every(isInterval)) ||
          !Number.isInteger(data.legacy_count) || data.legacy_count < 0) {
        throw new Error('Invalid schedule response')
      }
      setSchedule(data)
    } catch (e) {
      setError('No se pudo cargar la configuración de agenda.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const updateWeekly = (index, key, value) => {
    setSchedule(current => ({
      ...current,
      weekly: current.weekly.map((item, i) => i === index ? { ...item, [key]: value } : item),
    }))
  }
  const updateException = (index, update) => {
    setSchedule(current => ({
      ...current,
      exceptions: current.exceptions.map((item, i) => i === index ? { ...item, ...update } : item),
    }))
  }
  const save = async () => {
    if (savingRef.current) return
    if (!schedule.time_zone.trim() || (schedule.legacy_count > 0 && !legacyZone.trim())) {
      Alert.alert('Falta información', 'Indica la zona horaria y confirma la zona de las citas anteriores cuando corresponda.')
      return
    }
    if (schedule.legacy_count > 0 && (legacyItems.length !== schedule.legacy_count ||
        legacyItems.some(item => item.status !== 'unambiguous' && !legacyInstants[`${item.kind}:${item.id}`]))) {
      Alert.alert('RevisiÃ³n pendiente', 'Revisa todas las citas anteriores y confirma cada hora ambigua, invÃ¡lida o inexistente antes de guardar.')
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      await api.put('/nutritionist/schedule', {
        time_zone: schedule.time_zone.trim(),
        legacy_time_zone: legacyZone.trim(),
        legacy_instants: legacyInstants,
        weekly: schedule.weekly,
        exceptions: schedule.exceptions,
      })
      Alert.alert('Agenda guardada', 'Las citas conservan su instante. Si cambió la zona, la hora mostrada puede cambiar.')
      await load()
      setLegacyZone('')
    } catch (e) {
      const code = e?.response?.data?.code
      Alert.alert('No se pudo guardar', code === 'legacy_time_needs_review'
        ? 'Una cita anterior tiene una hora inválida o repetida y necesita revisión. Contacta a soporte antes de continuar.'
        : code === 'legacy_zone_required'
          ? 'Confirma la zona horaria de las citas anteriores.'
          : e?.response?.status === 400
            ? 'Revisa la zona, las fechas y los horarios. Usa el formato indicado y evita intervalos superpuestos.'
            : 'No se pudo actualizar la agenda. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const previewLegacy = async () => {
    if (!legacyZone.trim()) {
      Alert.alert('Falta la zona anterior', 'Indica la zona horaria en que se registraron las citas.')
      return
    }
    setPreviewingLegacy(true)
    setLegacyItems([])
    setLegacyInstants({})
    try {
      const { data } = await api.get('/nutritionist/schedule/legacy-times', { params: { time_zone: legacyZone.trim() } })
      if (!Array.isArray(data?.items)) throw new Error('Invalid legacy preview')
      setLegacyItems(data.items)
    } catch {
      Alert.alert('No se pudo revisar', 'Confirma la zona horaria anterior e intÃ©ntalo de nuevo.')
    } finally {
      setPreviewingLegacy(false)
    }
  }

  if (loading) return <ActivityIndicator accessibilityLabel="Cargando agenda" />
  if (!schedule) return (
    <View style={{ padding: 16 }}>
      <Text accessibilityRole="alert">{error}</Text>
      <TouchableOpacity onPress={load}><Text>Reintentar</Text></TouchableOpacity>
      <TouchableOpacity onPress={onBack}><Text>Volver</Text></TouchableOpacity>
    </View>
  )

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity onPress={onBack}><Text>← Volver a citas</Text></TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginVertical: 12 }}>Configurar agenda</Text>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Text>Zona horaria del profesional (ejemplo: America/Mexico_City)</Text>
      <TextInput accessibilityLabel="Zona horaria" style={inputStyle} value={schedule.time_zone} autoCapitalize="none"
        onChangeText={value => setSchedule(current => ({ ...current, time_zone: value }))} />
      {schedule.legacy_count > 0 && (
        <View>
          <Text>Hay {schedule.legacy_count} citas o propuestas anteriores sin zona confirmada. Indica la zona en que se registraron.</Text>
          <TextInput accessibilityLabel="Zona de citas anteriores" style={inputStyle} value={legacyZone} autoCapitalize="none" onChangeText={value => { setLegacyZone(value); setLegacyItems([]); setLegacyInstants({}) }} />
          <TouchableOpacity accessibilityRole="button" disabled={previewingLegacy} onPress={previewLegacy}>
            <Text>{previewingLegacy ? 'Revisando…' : 'Revisar citas anteriores'}</Text>
          </TouchableOpacity>
          {legacyItems.map(item => {
            const key = `${item.kind}:${item.id}`
            return (
              <View key={key} style={{ padding: 10, borderTopWidth: 1, borderTopColor: '#cbd5e1' }}>
                <Text>{item.kind === 'appointment' ? 'Cita' : 'Propuesta'} #{item.id}: {item.date || 'sin fecha'} {item.time || 'sin hora'} · {item.status}</Text>
                {item.status === 'unambiguous' && <Text>Instante interpretado: {item.instants[0]}</Text>}
                {item.status === 'ambiguous' && item.instants.map(instant => (
                  <TouchableOpacity key={instant} accessibilityRole="button" accessibilityState={{ selected: legacyInstants[key] === instant }}
                    onPress={() => setLegacyInstants(current => ({ ...current, [key]: instant }))}>
                    <Text>{legacyInstants[key] === instant ? '✓ ' : ''}Elegir {instant} (UTC)</Text>
                  </TouchableOpacity>
                ))}
                {['invalid', 'nonexistent', 'missing'].includes(item.status) && (
                  <TextInput accessibilityLabel={`Instante confirmado ${key}`} style={inputStyle} autoCapitalize="none"
                    placeholder="2026-11-01T01:30:00-06:00" value={legacyInstants[key] || ''}
                    onChangeText={value => setLegacyInstants(current => ({ ...current, [key]: value }))} />
                )}
              </View>
            )
          })}
        </View>
      )}
      <Text style={{ fontWeight: 'bold', marginTop: 16 }}>Horario semanal (HH:MM)</Text>
      {schedule.weekly.map((interval, index) => (
        <View key={index} style={{ marginVertical: 8 }}>
          <Text>{days[interval.day_of_week] || 'Día inválido'}</Text>
          <TextInput accessibilityLabel={`Inicio semanal ${index + 1}`} style={inputStyle} value={interval.start_time}
            onChangeText={value => updateWeekly(index, 'start_time', value)} />
          <TextInput accessibilityLabel={`Fin semanal ${index + 1}`} style={inputStyle} value={interval.end_time}
            onChangeText={value => updateWeekly(index, 'end_time', value)} />
          <TouchableOpacity onPress={() => setSchedule(current => ({ ...current, weekly: current.weekly.filter((_, i) => i !== index) }))}>
            <Text>Eliminar horario {index + 1}</Text>
          </TouchableOpacity>
        </View>
      ))}
      <Text>Agregar horario para:</Text>
      {days.map((day, dayOfWeek) => (
        <TouchableOpacity key={day} onPress={() => setSchedule(current => ({
          ...current, weekly: [...current.weekly, { day_of_week: dayOfWeek, start_time: '09:00', end_time: '17:00' }],
        }))}><Text style={{ paddingVertical: 5 }}>+ {day}</Text></TouchableOpacity>
      ))}
      <Text style={{ fontWeight: 'bold', marginTop: 16 }}>Excepciones por fecha</Text>
      <Text>Una excepción sin intervalos cierra el día. No modifica las citas existentes.</Text>
      {schedule.exceptions.map((exception, index) => (
        <View key={index} style={{ marginVertical: 8 }}>
          <TextInput accessibilityLabel={`Fecha excepción ${index + 1}`} placeholder="AAAA-MM-DD" style={inputStyle} value={exception.date}
            onChangeText={value => updateException(index, { date: value })} />
          {exception.intervals.map((interval, intervalIndex) => (
            <View key={intervalIndex}>
              <TextInput accessibilityLabel={`Inicio excepción ${index + 1}-${intervalIndex + 1}`} style={inputStyle} value={interval.start_time}
                onChangeText={value => updateException(index, { intervals: exception.intervals.map((item, i) => i === intervalIndex ? { ...item, start_time: value } : item) })} />
              <TextInput accessibilityLabel={`Fin excepción ${index + 1}-${intervalIndex + 1}`} style={inputStyle} value={interval.end_time}
                onChangeText={value => updateException(index, { intervals: exception.intervals.map((item, i) => i === intervalIndex ? { ...item, end_time: value } : item) })} />
              <TouchableOpacity onPress={() => updateException(index, { intervals: exception.intervals.filter((_, i) => i !== intervalIndex) })}>
                <Text>Eliminar intervalo {index + 1}-{intervalIndex + 1}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => updateException(index, { intervals: [...exception.intervals, { start_time: '09:00', end_time: '17:00' }] })}>
            <Text>+ Intervalo para excepción {index + 1}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSchedule(current => ({ ...current, exceptions: current.exceptions.filter((_, i) => i !== index) }))}>
            <Text>Eliminar excepción {index + 1}</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={() => setSchedule(current => ({ ...current, exceptions: [...current.exceptions, { date: '', intervals: [] }] }))}>
        <Text>+ Excepción</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={save} style={{ paddingVertical: 20 }}>
        <Text>{saving ? 'Guardando...' : 'Guardar agenda'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
