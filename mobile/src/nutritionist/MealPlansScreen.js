import React, { useState, useEffect, useRef } from 'react'
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  ActivityIndicator, StyleSheet, Alert, RefreshControl, Modal 
} from 'react-native'
import api from '../api'

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MEAL_TYPES = ['Desayuno', 'Colación AM', 'Almuerzo', 'Colación PM', 'Cena']

export default function MealPlansScreen({ onNavigate }) {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [currentPlan, setCurrentPlan] = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [planName, setPlanName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [snacks, setSnacks] = useState('')
  const [meals, setMeals] = useState({})
  const [error, setError] = useState('')
  const planRequest = useRef(0)

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
      console.error('[MealPlans] Could not load patients')
    } finally {
      setLoading(false)
    }
  }

  const selectPatient = async (patient) => {
    const request = ++planRequest.current
    setSelectedPatient(patient)
    setCurrentPlan(null)
    setError('')
    setLoadingPlan(true)
    
    try {
      const res = await api.get(`/nutritionist/patients/${patient.id}/meal-plan`)
      if (request !== planRequest.current) return
      if (!res.data?.plan || !Array.isArray(res.data.meals)) {
        throw new Error('Invalid meal plan response')
      }
      setCurrentPlan({ ...res.data.plan, meals: res.data.meals })
    } catch (e) {
      if (request !== planRequest.current) return
      if (e.response?.status !== 404 || e.response?.data?.error !== 'no meal plan found') {
        setError('No se pudo cargar el plan de comidas')
        console.error('[MealPlans] Could not load meal plan')
      }
    } finally {
      if (request === planRequest.current) setLoadingPlan(false)
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
    
    const today = new Date().toISOString().split('T')[0]
    setPlanName('')
    setStartDate(today)
    setSnacks('')
    setMeals({})
    setShowModal(true)
  }

  const updateMeal = (day, mealType, field, value) => {
    const key = `${day}_${mealType}`
    setMeals(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value
      }
    }))
  }

  const handleSave = async () => {
    if (!planName.trim()) {
      Alert.alert('Error', 'El nombre del plan es requerido')
      return
    }

    try {
      const mealsList = []
      DAYS.forEach(day => {
        MEAL_TYPES.forEach(mealType => {
          const key = `${day}_${mealType}`
          const mealData = meals[key]
          if (mealData && (mealData.name || mealData.ingredients)) {
            mealsList.push({
              day_of_week: day,
              meal_type: mealType,
              name: mealData.name || mealType,
              ingredients: mealData.ingredients || '',
              preparation: mealData.preparation || ''
            })
          }
        })
      })

      if (mealsList.length === 0) {
        Alert.alert('Aviso', 'Agrega al menos una comida')
        return
      }

      const payload = {
        name: planName.trim(),
        start_date: startDate,
        snacks: snacks.trim(),
        meals: mealsList
      }

      await api.post(`/nutritionist/patients/${selectedPatient.id}/meal-plan`, payload)
      Alert.alert('Éxito', 'Plan de comidas creado y notificado al paciente')
      setShowModal(false)
      
      if (selectedPatient) {
        selectPatient(selectedPatient)
      }
    } catch (e) {
      console.error('[MealPlans] Could not create meal plan')
      Alert.alert('Error', 'No se pudo crear el plan')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Planes de Comida</Text>
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

        {/* Current Plan Display */}
        <ScrollView
          style={styles.planDisplay}
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

          {!loading && !loadingPlan && !error && selectedPatient && !currentPlan && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>📋 {selectedPatient.name} no tiene un plan activo</Text>
              <TouchableOpacity onPress={openCreateModal} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Crear plan de comidas</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && currentPlan && (
            <View style={styles.planCard}>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>{currentPlan.name}</Text>
                  <Text style={styles.planDate}>
                    Inicio: {new Date(currentPlan.start_date).toLocaleDateString('es-ES')}
                  </Text>
                </View>
              </View>

              {currentPlan.snacks && (
                <View style={styles.snacksSection}>
                  <Text style={styles.sectionTitle}>🍎 Snacks permitidos:</Text>
                  <Text style={styles.sectionText}>{currentPlan.snacks}</Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>Comidas de la semana:</Text>
              
              {DAYS.map(day => {
                const dayMeals = currentPlan.meals?.filter(m => m.day_of_week === day) || []
                
                if (dayMeals.length === 0) return null

                return (
                  <View key={day} style={styles.daySection}>
                    <Text style={styles.dayTitle}>{day}</Text>
                    {dayMeals.map((meal, idx) => (
                      <View key={idx} style={styles.mealItem}>
                        <Text style={styles.mealType}>{meal.meal_type}</Text>
                        <Text style={styles.mealName}>{meal.name}</Text>
                        {meal.ingredients && (
                          <Text style={styles.mealIngredients}>
                            Ingredientes: {meal.ingredients}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )
              })}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nuevo Plan</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Crear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.modalInfo}>
              <Text style={styles.modalInfoText}>
                Para: <Text style={styles.modalInfoBold}>{selectedPatient?.name || selectedPatient?.email}</Text>
              </Text>
            </View>

            <Text style={styles.label}>Nombre del Plan *</Text>
            <TextInput
              style={styles.input}
              value={planName}
              onChangeText={setPlanName}
              placeholder="Ej: Plan Enero 2026"
            />

            <Text style={styles.label}>Fecha de Inicio</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.label}>Snacks Permitidos (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={snacks}
              onChangeText={setSnacks}
              placeholder="Frutas, nueces, yogurt..."
              multiline
              numberOfLines={2}
            />

            <Text style={styles.sectionTitle}>Comidas por Día</Text>
            <Text style={styles.helpText}>
              Llena las comidas que desees incluir. Deja vacío lo que no aplique.
            </Text>

            {DAYS.map(day => (
              <View key={day} style={styles.dayForm}>
                <Text style={styles.dayFormTitle}>{day}</Text>
                {MEAL_TYPES.map(mealType => {
                  const key = `${day}_${mealType}`
                  const mealData = meals[key] || {}
                  
                  return (
                    <View key={mealType} style={styles.mealForm}>
                      <Text style={styles.mealFormLabel}>{mealType}</Text>
                      
                      <TextInput
                        style={[styles.input, styles.smallInput]}
                        value={mealData.name || ''}
                        onChangeText={val => updateMeal(day, mealType, 'name', val)}
                        placeholder="Nombre del platillo"
                      />
                      
                      <TextInput
                        style={[styles.input, styles.smallInput]}
                        value={mealData.ingredients || ''}
                        onChangeText={val => updateMeal(day, mealType, 'ingredients', val)}
                        placeholder="Ingredientes"
                      />
                    </View>
                  )
                })}
              </View>
            ))}

            <View style={{ height: 60 }} />
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
  planDisplay: {
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
    textAlign: 'center',
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
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  planHeader: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  planDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  snacksSection: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  sectionText: {
    fontSize: 14,
    color: '#065f46',
    lineHeight: 20,
  },
  daySection: {
    marginBottom: 16,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  mealItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  mealType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  mealIngredients: {
    fontSize: 13,
    color: '#6b7280',
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
  smallInput: {
    marginBottom: 8,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  dayForm: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dayFormTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  mealForm: {
    marginBottom: 12,
  },
  mealFormLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
})
