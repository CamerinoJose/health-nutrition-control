import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, TextInput, Alert, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import api from '../api'
import ScheduleScreen from './ScheduleScreen'

export default function CalendarScreen({ onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [appointments, setAppointments] = useState([])
  const [error, setError] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [proposing, setProposing] = useState(null)
  const [proposalDate, setProposalDate] = useState('')
  const [proposalDatePicker, setProposalDatePicker] = useState(false)
  const [proposalSlots, setProposalSlots] = useState(null)
  const [proposalSlot, setProposalSlot] = useState(null)
  const [proposalReason, setProposalReason] = useState('')
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalError, setProposalError] = useState('')
  const slotsRequest = useRef(0)

  const loadAppointments = async () => {
    setError('')
    try {
      setLoading(true)
      const res = await api.get('/nutritionist/appointments')
      const data = Array.isArray(res.data) ? res.data : []
      setAppointments(data)
    } catch (e) {
      setError('No se pudieron cargar las citas')
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments()
  }, [])

  useEffect(() => {
    if (!proposing || !proposalDate) return undefined
    const request = ++slotsRequest.current
    setProposalSlots(null)
    setProposalSlot(null)
    setProposalLoading(true)
    setProposalError('')
    api.get('/nutritionist/available-slots', { params: { date: proposalDate } })
      .then(response => {
        const data = response.data
        if (!Array.isArray(data) || data.some(slot => !slot || typeof slot.starts_at !== 'string' ||
            !Number.isFinite(Date.parse(slot.starts_at)) || typeof slot.start_time !== 'string' ||
            typeof slot.available !== 'boolean' || typeof slot.utc_offset !== 'string' || typeof slot.time_zone !== 'string')) {
          throw new Error('Invalid slots response')
        }
        if (request === slotsRequest.current) setProposalSlots(data.filter(slot => slot.available))
      })
      .catch(error => {
        if (request === slotsRequest.current) setProposalError(error?.response?.data?.code === 'legacy_zone_required'
          ? 'Resuelve primero las citas anteriores en Configurar agenda.'
          : 'No se pudieron consultar los horarios disponibles.')
      })
      .finally(() => { if (request === slotsRequest.current) setProposalLoading(false) })
    return () => { slotsRequest.current++ }
  }, [proposing, proposalDate])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadAppointments()
    setRefreshing(false)
  }

  const stats = useMemo(() => {
    const base = { total: 0, scheduled: 0, completed: 0, cancelled: 0 }
    return appointments.reduce((acc, a) => {
      acc.total += 1
      acc[a.status] = (acc[a.status] || 0) + 1
      return acc
    }, base)
  }, [appointments])

  const startProposal = appointment => {
    setProposing(appointment)
    setProposalDate(appointment.appointment_date || '')
    setProposalReason('')
    setProposalSlots(null)
    setProposalSlot(null)
  }

  const submitProposal = async () => {
    if (!proposing || !proposalSlot) return
    try {
      await api.post(`/nutritionist/appointments/${proposing.id}/propose-change`, {
        new_date: proposalDate,
        new_time: proposalSlot.start_time,
        new_starts_at: proposalSlot.starts_at,
        reason: proposalReason.trim(),
      })
      setProposing(null)
      await loadAppointments()
      Alert.alert('Propuesta enviada', 'El paciente recibirá una notificación para responder.')
    } catch (error) {
      Alert.alert('No se pudo proponer', error?.response?.status === 409
        ? 'El horario ya no está disponible. Selecciona otro horario.'
        : 'Comprueba tu conexión e inténtalo de nuevo.')
    }
  }

  if (showSchedule) return <ScheduleScreen onBack={() => { setShowSchedule(false); loadAppointments() }} />

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Citas</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />
        }
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" onPress={() => setShowSchedule(true)} style={{ paddingVertical: 12 }}>
          <Text>Configurar agenda y zona horaria</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Programadas</Text>
            <Text style={styles.statValue}>{stats.scheduled}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Completadas</Text>
            <Text style={styles.statValue}>{stats.completed}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Canceladas</Text>
            <Text style={styles.statValue}>{stats.cancelled}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" />
        ) : appointments.length === 0 && !error ? (
          <Text style={styles.emptyText}>Sin citas</Text>
        ) : (
          appointments
            .slice()
            .sort((a, b) => (a.appointment_date || '').localeCompare(b.appointment_date || ''))
            .map((appt) => (
              <View key={appt.id} style={styles.card}>
                <Text style={styles.cardTitle}>{appt.title || 'Cita'}</Text>
                <Text style={styles.cardMeta}>
                  {appt.appointment_date || 'Fecha'}
                  {appt.appointment_time ? ` · ${appt.appointment_time}` : ''}
                  {appt.time_zone ? ` · ${appt.time_zone}` : ' · Zona por confirmar'}
                </Text>
                {appt.patient_name && <Text style={styles.cardMeta}>Paciente: {appt.patient_name}</Text>}
                {appt.status && <Text style={styles.status}>{appt.status}</Text>}
                {appt.description && <Text style={styles.cardMeta}>{appt.description}</Text>}
                {appt.status === 'scheduled' && <TouchableOpacity accessibilityRole="button" onPress={() => startProposal(appt)} style={{ paddingVertical: 10 }}>
                  <Text style={{ color: '#2563eb', fontWeight: '700' }}>Proponer cambio de horario</Text>
                </TouchableOpacity>}
              </View>
            ))
        )}
      </ScrollView>
      <Modal visible={!!proposing} transparent animationType="slide" onRequestClose={() => setProposing(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
          <View style={{ backgroundColor: '#fff', padding: 18, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' }}>
            <Text style={styles.cardTitle}>Proponer cambio de cita</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.cardMeta} onPress={() => setProposalDatePicker(true)}>
              <Text>Fecha: {proposalDate || 'Seleccionar fecha'}</Text>
            </TouchableOpacity>
            {proposalDatePicker && <DateTimePicker mode="date" value={proposalDate ? new Date(`${proposalDate}T00:00:00`) : new Date()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, chosen) => {
                if (Platform.OS !== 'ios') setProposalDatePicker(false)
                if (event.type !== 'dismissed' && chosen) setProposalDate(formatDate(chosen))
              }} />}
            {Platform.OS === 'ios' && proposalDatePicker && <TouchableOpacity onPress={() => setProposalDatePicker(false)}><Text>Listo</Text></TouchableOpacity>}
            {proposalLoading && <ActivityIndicator />}
            {!!proposalError && <Text accessibilityRole="alert" style={styles.errorText}>{proposalError}</Text>}
            {proposalSlots?.length === 0 && <Text>No hay horarios disponibles.</Text>}
            <ScrollView style={{ maxHeight: 230 }}>
              {proposalSlots?.map(slot => <TouchableOpacity key={slot.starts_at} accessibilityRole="button"
                accessibilityState={{ selected: proposalSlot?.starts_at === slot.starts_at }} style={styles.slotButton}
                onPress={() => setProposalSlot(slot)}>
                <Text>{proposalSlot?.starts_at === slot.starts_at ? '✓ ' : ''}{slot.start_time} (UTC{slot.utc_offset})</Text>
              </TouchableOpacity>)}
            </ScrollView>
            <TextInput style={styles.reasonInput} value={proposalReason} onChangeText={setProposalReason} placeholder="Motivo (opcional)" multiline />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <TouchableOpacity onPress={() => setProposing(null)}><Text>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity disabled={!proposalSlot || proposalLoading} onPress={submitProposal}><Text style={{ color: proposalSlot ? '#2563eb' : '#94a3b8', fontWeight: '700' }}>Enviar propuesta</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e5e7eb'
  },
  backText: {
    fontSize: 18,
    color: '#0f172a'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 12
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827'
  },
  cardMeta: {
    color: '#4b5563',
    marginTop: 4,
    fontSize: 13
  },
  status: {
    marginTop: 6,
    color: '#2563eb',
    fontWeight: '700'
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 8
  },
  emptyText: {
    color: '#6b7280'
  },
  slotButton: { padding: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginVertical: 4 },
  reasonInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, minHeight: 48, marginTop: 8 },
})
