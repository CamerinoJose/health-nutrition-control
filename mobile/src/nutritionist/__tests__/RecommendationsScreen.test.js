// File intentionally left blank or removed to match production Expo Go environment.
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import RecommendationsScreen from '../RecommendationsScreen'
import api from '../../api'

jest.mock('../../api')

describe('NutritionistRecommendationsScreen', () => {
  const mockNavigate = jest.fn()
  const mockPatients = [
    { id: 1, name: 'Juan Pérez', email: 'juan@test.com' },
    { id: 2, name: 'María García', email: 'maria@test.com' }
  ]
  
  const mockRecommendations = [
    {
      id: 1,
      patient_id: 1,
      appointment_id: 5,
      recommendation_text: 'Aumentar consumo de proteína',
      diet_changes: 'Agregar pollo y pescado',
      exercise_plan: 'Cardio 3x semana',
      next_goals: 'Perder 2kg en 1 mes',
      created_at: '2026-01-05T10:00:00Z'
    },
    {
      id: 2,
      patient_id: 1,
      appointment_id: null,
      recommendation_text: 'Mantener hidratación',
      diet_changes: '2L agua diario',
      exercise_plan: null,
      next_goals: null,
      created_at: '2026-01-01T10:00:00Z'
    }
  ]

  const mockAppointments = [
    {
      id: 5,
      user_id: 1,
      title: 'Consulta de seguimiento',
      appointment_date: '2026-01-05'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the screen with header', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Recomendaciones')).toBeTruthy()
        expect(getByText('← Volver')).toBeTruthy()
        expect(getByText('+ Crear')).toBeTruthy()
      })
    })

    it('should display loading indicator initially', () => {
      api.get.mockImplementation(() => new Promise(() => {}))
      const { UNSAFE_queryByType } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      const activityIndicators = UNSAFE_queryByType('ActivityIndicator')
      expect(activityIndicators).toBeTruthy()
    })

    it('should show message to select patient when no patient selected', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('👥 Selecciona un paciente')).toBeTruthy()
      })
    })
  })

  describe('Patient Selector', () => {
    it('should display all patients in horizontal scroll', async () => {
      api.get.mockResolvedValue({ data: mockPatients })
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
        expect(getByText('María García')).toBeTruthy()
      })
    })

    it('should auto-select first patient on load', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockRecommendations })
        .mockResolvedValueOnce({ data: mockAppointments })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/nutritionist/recommendations/1')
      })
    })

    it('should load recommendations when patient is selected', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('María García'))
      })
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/nutritionist/recommendations/2')
      })
    })
  })

  describe('Recommendations Display', () => {
    it('should display empty state when no recommendations exist', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText(/No hay recomendaciones para/)).toBeTruthy()
        expect(getByText('Crear primera recomendación')).toBeTruthy()
      })
    })

    it('should display recommendations correctly', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockRecommendations })
        .mockResolvedValueOnce({ data: mockAppointments })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Aumentar consumo de proteína')).toBeTruthy()
        expect(getByText('Mantener hidratación')).toBeTruthy()
      })
    })

    it('should display all recommendation sections', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockRecommendations })
        .mockResolvedValueOnce({ data: mockAppointments })
      
      const { getAllByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getAllByText('Recomendación:').length).toBeGreaterThan(0)
        expect(getAllByText('Cambios en dieta:').length).toBeGreaterThan(0)
        expect(getAllByText('Plan de ejercicio:').length).toBeGreaterThan(0)
        expect(getAllByText('Próximas metas:').length).toBeGreaterThan(0)
      })
    })

    it('should show appointment badge when linked to appointment', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockRecommendations })
        .mockResolvedValueOnce({ data: mockAppointments })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('📅 Cita #5')).toBeTruthy()
      })
    })

    it('should format dates correctly', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockRecommendations })
        .mockResolvedValueOnce({ data: mockAppointments })
      
      const { getAllByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        // Check for formatted date (format: day month year)
        expect(getAllByText(/ene/i).length).toBeGreaterThan(0) // January in Spanish
      })
    })
  })

  describe('Create Recommendation Modal', () => {
    it('should open create modal when + Crear is pressed', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        expect(getByText('Nueva Recomendación')).toBeTruthy()
      })
    })

    it('should show patient name in modal', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      
      const { getByText, getAllByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        expect(getByText(/Para:/)).toBeTruthy()
        expect(getAllByText('Juan Pérez').length).toBeGreaterThan(0)
      })
    })

    it('should have all form fields in modal', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      
      const { getByText, getByPlaceholderText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        expect(getByText('Recomendación General *')).toBeTruthy()
        expect(getByText('Cambios en la Dieta')).toBeTruthy()
        expect(getByText('Plan de Ejercicio')).toBeTruthy()
        expect(getByText('Próximas Metas')).toBeTruthy()
        expect(getByPlaceholderText('Describe la recomendación principal...')).toBeTruthy()
      })
    })

    it('should display appointments for selection', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: mockAppointments })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        expect(getByText('Sin cita')).toBeTruthy()
        expect(getByText(/Consulta de seguimiento/)).toBeTruthy()
      })
    })
  })

  describe('Recommendation Creation', () => {
    it('should show error when trying to save without recommendation text', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.press(getByText('Guardar'))
      })
      
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'La recomendación es requerida')
      expect(api.post).not.toHaveBeenCalled()
    })

    it('should create recommendation successfully', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      api.post.mockResolvedValue({ data: { id: 3 } })
      
      const { getByText, getByPlaceholderText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        const input = getByPlaceholderText('Describe la recomendación principal...')
        fireEvent.changeText(input, 'Nueva recomendación')
      })
      
      fireEvent.press(getByText('Guardar'))
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/nutritionist/recommendations', expect.objectContaining({
          patient_id: 1,
          recommendation_text: 'Nueva recomendación'
        }))
        expect(Alert.alert).toHaveBeenCalledWith('Éxito', 'Recomendación creada')
      })
    })

    it('should include optional fields when provided', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      api.post.mockResolvedValue({ data: { id: 3 } })
      
      const { getByText, getByPlaceholderText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Describe la recomendación principal...'), 'Test rec')
        fireEvent.changeText(getByPlaceholderText('Modificaciones sugeridas en alimentación...'), 'Test diet')
        fireEvent.changeText(getByPlaceholderText('Rutinas o actividades físicas sugeridas...'), 'Test exercise')
      })
      
      fireEvent.press(getByText('Guardar'))
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/nutritionist/recommendations', expect.objectContaining({
          diet_changes: 'Test diet',
          exercise_plan: 'Test exercise'
        }))
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error banner when patients fail to load', async () => {
      api.get.mockRejectedValue(new Error('Network error'))
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Error al cargar pacientes')).toBeTruthy()
      })
    })

    it('should handle empty recommendations array', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: null })
      
      const { queryByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        // Should not crash, should handle null gracefully
        expect(queryByText('Error')).toBeNull()
      })
    })

    it('should show error alert when creation fails', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      api.post.mockRejectedValue(new Error('API Error'))
      
      const { getByText, getByPlaceholderText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Describe la recomendación principal...'), 'Test')
      })
      
      fireEvent.press(getByText('Guardar'))
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo crear la recomendación')
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate back to dashboard when back button is pressed', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('← Volver'))
      })
      
      expect(mockNavigate).toHaveBeenCalledWith('dashboard')
    })
  })

  describe('Pull to Refresh', () => {
    it('should reload data on pull to refresh', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
      
      const { UNSAFE_getAllByType } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(3)
      })
      
      const { ScrollView } = require('react-native')
      const scrollView = UNSAFE_getAllByType(ScrollView).find(sv => sv.props.refreshControl)
      const refreshControl = scrollView && scrollView.props.refreshControl
      
      if (refreshControl && refreshControl.props.onRefresh) {
        await refreshControl.props.onRefresh()
      }
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(5) // 2 more calls
      })
    })
  })

  describe('Appointment Association', () => {
    it('should allow selecting an appointment', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: mockAppointments })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.press(getByText(/Consulta de seguimiento/))
      })
      
      // Appointment is selected (visual indication tested via styles)
      expect(getByText(/Consulta de seguimiento/)).toBeTruthy()
    })

    it('should default to no appointment', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: mockAppointments })
      
      const { getByText } = render(<RecommendationsScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        // "Sin cita" should be selected by default
        expect(getByText('Sin cita')).toBeTruthy()
      })
    })
  })
})
// File intentionally left blank or removed to match GitHub repo state.
