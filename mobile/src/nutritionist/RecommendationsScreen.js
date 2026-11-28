import React, { useState, useEffect, useRef } from 'react'
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  ActivityIndicator, StyleSheet, Alert, RefreshControl, Modal 
} from 'react-native'
import api from '../api'

export default function RecommendationsScreen({ onNavigate }) {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [appointments, setAppointments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    patient_id: '',
    appointment_id: '',
    recommendation_text: '',
    diet_changes: '',
    exercise_plan: '',
    next_goals: ''
  })
  const [error, setError] = useState('')
  const patientRequest = useRef(0)

  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    setError('')
    try {
      setLoading(true)
      const res = await api.get('/nutritionist/patients')
      const data = Array.isArray(res.data) ? res.data : []
      setPatients(data)
      if (data.length > 0 && !selectedPatient) {
        selectPatient(data[0])
      }
    } catch (e) {
      setError('Error al cargar pacientes')
      console.error('[Recommendations] Could not load patients')
    } finally {
      setLoading(false)
    }
  }

  const selectPatient = async (patient) => {
    const request = ++patientRequest.current
    setSelectedPatient(patient)
    setRecommendations([])
    setAppointments([])
    setError('')
    
    try {
      const [recRes, apptRes] = await Promise.all([
        api.get(`/nutritionist/recommendations/${patient.id}`),
        api.get('/nutritionist/appointments')
      ])
      if (request !== patientRequest.current) return
      
      setRecommendations(Array.isArray(recRes.data) ? recRes.data : [])
      
      const allAppts = Array.isArray(apptRes.data) ? apptRes.data : []
      const patientAppts = allAppts.filter(a => a.user_id === patient.id)
      setAppointments(patientAppts)
    } catch (e) {
      if (request !== patientRequest.current) return
      setError('No se pudieron cargar las recomendaciones')
      console.error('[Recommendations] Could not load recommendations')
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    if (selectedPatient) {
      await selectPatient(selectedPatient)
    } else {
      await loadPatients()
    }
    setRefreshing(false)
  }

  const openCreateModal = () => {
    if (!selectedPatient) {
      Alert.alert('Aviso', 'Selecciona un paciente primero')
      return
    }
    
    setForm({
      patient_id: String(selectedPatient.id),
      appointment_id: '',
      recommendation_text: '',
      diet_changes: '',
      exercise_plan: '',
      next_goals: ''
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.recommendation_text.trim()) {
      Alert.alert('Error', 'La recomendación es requerida')
      return
    }

    try {
      const payload = {
        patient_id: parseInt(form.patient_id),
        appointment_id: form.appointment_id ? parseInt(form.appointment_id) : undefined,
        recommendation_text: form.recommendation_text.trim(),
        diet_changes: form.diet_changes.trim(),
        exercise_plan: form.exercise_plan.trim(),
        next_goals: form.next_goals.trim()
      }

      await api.post('/nutritionist/recommendations', payload)
      Alert.alert('Éxito', 'Recomendación creada')
      setShowModal(false)
      
      if (selectedPatient) {
        selectPatient(selectedPatient)
      }
    } catch (e) {
      console.error('[Recommendations] Could not create recommendation')
      Alert.alert('Error', 'No se pudo crear la recomendación')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Recomendaciones</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Crear</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Patient Selector */}
        <View style={styles.patientSelector}>
          <Text style={styles.selectorLabel}>Paciente:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientScroll}>
            {patients.map(patient => (
              <TouchableOpacity
                key={patient.id}
                style={[
                  styles.patientChip,
                  selectedPatient?.id === patient.id && styles.patientChipActive
                ]}
                onPress={() => selectPatient(patient)}
              >
                <Text style={[
                  styles.patientChipText,
                  selectedPatient?.id === patient.id && styles.patientChipTextActive
                ]}>
                  {patient.name || patient.email}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recommendations List */}
        <ScrollView
          style={styles.recommendationsList}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loading && <ActivityIndicator size="large" color="#10b981" style={styles.loader} />}

          {!loading && !selectedPatient && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>👥 Selecciona un paciente</Text>
            </View>
          )}

          {!loading && selectedPatient && recommendations.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>📋 No hay recomendaciones para {selectedPatient.name}</Text>
              <TouchableOpacity onPress={openCreateModal} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Crear primera recomendación</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && recommendations.map(rec => (
            <View key={rec.id} style={styles.recommendationCard}>
              <View style={styles.recHeader}>
                <Text style={styles.recDate}>
                  {new Date(rec.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
                {rec.appointment_id && (
                  <View style={styles.apptBadge}>
                    <Text style={styles.apptBadgeText}>📅 Cita #{rec.appointment_id}</Text>
                  </View>
                )}
              </View>

              <View style={styles.recSection}>
                <Text style={styles.recLabel}>Recomendación:</Text>
                <Text style={styles.recText}>{rec.recommendation_text}</Text>
              </View>

              {rec.diet_changes && (
                <View style={styles.recSection}>
                  <Text style={styles.recLabel}>Cambios en dieta:</Text>
                  <Text style={styles.recText}>{rec.diet_changes}</Text>
                </View>
              )}

              {rec.exercise_plan && (
                <View style={styles.recSection}>
                  <Text style={styles.recLabel}>Plan de ejercicio:</Text>
                  <Text style={styles.recText}>{rec.exercise_plan}</Text>
                </View>
              )}

              {rec.next_goals && (
                <View style={styles.recSection}>
                  <Text style={styles.recLabel}>Próximas metas:</Text>
                  <Text style={styles.recText}>{rec.next_goals}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nueva Recomendación</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.modalInfo}>
              <Text style={styles.modalInfoText}>
                Para: <Text style={styles.modalInfoBold}>{selectedPatient?.name || selectedPatient?.email}</Text>
              </Text>
            </View>

            <Text style={styles.label}>Asociar con cita (opcional)</Text>
            <View style={styles.appointmentPicker}>
              <TouchableOpacity
                style={[styles.appointmentOption, !form.appointment_id && styles.appointmentOptionActive]}
                onPress={() => setForm({ ...form, appointment_id: '' })}
              >
                <Text style={[styles.appointmentOptionText, !form.appointment_id && styles.appointmentOptionTextActive]}>
                  Sin cita
                </Text>
              </TouchableOpacity>
              {appointments.map(appt => (
                <TouchableOpacity
                  key={appt.id}
                  style={[
                    styles.appointmentOption,
                    form.appointment_id === String(appt.id) && styles.appointmentOptionActive
                  ]}
                  onPress={() => setForm({ ...form, appointment_id: String(appt.id) })}
                >
                  <Text style={[
                    styles.appointmentOptionText,
                    form.appointment_id === String(appt.id) && styles.appointmentOptionTextActive
                  ]}>
                    {appt.title} - {new Date(appt.appointment_date).toLocaleDateString('es-ES')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Recomendación General *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.recommendation_text}
              onChangeText={val => setForm({ ...form, recommendation_text: val })}
              placeholder="Describe la recomendación principal..."
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Cambios en la Dieta</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.diet_changes}
              onChangeText={val => setForm({ ...form, diet_changes: val })}
              placeholder="Modificaciones sugeridas en alimentación..."
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Plan de Ejercicio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.exercise_plan}
              onChangeText={val => setForm({ ...form, exercise_plan: val })}
              placeholder="Rutinas o actividades físicas sugeridas..."
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Próximas Metas</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.next_goals}
              onChangeText={val => setForm({ ...form, next_goals: val })}
              placeholder="Objetivos a alcanzar..."
              multiline
              numberOfLines={3}
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  patientSelector: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  patientScroll: {
    paddingHorizontal: 16,
  },
  patientChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  patientChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  patientChipText: {
    fontSize: 13,
    color: '#6b7280',
  },
  patientChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  recommendationsList: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  recommendationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  recDate: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  apptBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  apptBadgeText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '600',
  },
  recSection: {
    marginBottom: 12,
  },
  recLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  recText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalClose: {
    fontSize: 24,
    color: '#6b7280',
    paddingHorizontal: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalInfo: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#065f46',
  },
  modalInfoBold: {
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  appointmentPicker: {
    gap: 8,
  },
  appointmentOption: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  appointmentOptionActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  appointmentOptionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  appointmentOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
})
