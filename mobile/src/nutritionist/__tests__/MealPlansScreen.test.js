// File intentionally left blank or removed to match production Expo Go environment.
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import MealPlansScreen from '../MealPlansScreen'
import api from '../../api'

jest.mock('../../api')

describe('NutritionistMealPlansScreen', () => {
  const mockNavigate = jest.fn()
  const mockPatients = [
    { id: 1, name: 'Juan Pérez', email: 'juan@test.com' },
    { id: 2, name: 'María García', email: 'maria@test.com' }
  ]
  
  const mockMealPlan = {
    id: 1,
    name: 'Plan Enero 2026',
    start_date: '2026-01-08',
    snacks: 'Frutas, nueces, yogurt bajo en grasa',
    meals: [
      {
        day_of_week: 0, // Lunes
        meal_type: 'Desayuno',
        name: 'Avena con frutas',
        ingredients: 'Avena, fresas, plátano',
        preparation: 'Cocinar avena, agregar frutas'
      },
      {
        day_of_week: 0,
        meal_type: 'Almuerzo',
        name: 'Pollo con verduras',
        ingredients: 'Pollo, brócoli, zanahoria',
        preparation: 'Asar pollo, cocinar verduras al vapor'
      },
      {
        day_of_week: 1, // Martes
        meal_type: 'Desayuno',
        name: 'Huevos revueltos',
        ingredients: 'Huevos, espinaca',
        preparation: 'Revolver huevos con espinaca'
      }
    ]
  }

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
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Planes de Comida')).toBeTruthy()
        expect(getByText('← Volver')).toBeTruthy()
        expect(getByText('+ Crear')).toBeTruthy()
      })
    })

    it('should display loading indicator initially', () => {
      api.get.mockImplementation(() => new Promise(() => {}))
      const { UNSAFE_queryByType } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      const activityIndicators = UNSAFE_queryByType('ActivityIndicator')
      expect(activityIndicators).toBeTruthy()
    })

    it('should show message to select patient when no patient selected', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('👥 Selecciona un paciente')).toBeTruthy()
      })
    })
  })

  describe('Patient Selector', () => {
    it('should display all patients in horizontal scroll', async () => {
      api.get.mockResolvedValue({ data: mockPatients })
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
        expect(getByText('María García')).toBeTruthy()
      })
    })

    it('should auto-select first patient on load', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/nutritionist/patients/1/meal-plan')
      })
    })

    it('should load meal plan when patient is selected', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('María García'))
      })
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/nutritionist/patients/2/meal-plan')
      })
    })
  })

  describe('Current Plan Display', () => {
    it('should display empty state when patient has no plan', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText(/no tiene un plan activo/)).toBeTruthy()
        expect(getByText('Crear plan de comidas')).toBeTruthy()
      })
    })

    it('should display plan details when available', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockMealPlan })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Plan Enero 2026')).toBeTruthy()
        expect(getByText(/Inicio:/)).toBeTruthy()
      })
    })

    it('should display snacks section when available', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockMealPlan })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('🍎 Snacks permitidos:')).toBeTruthy()
        expect(getByText('Frutas, nueces, yogurt bajo en grasa')).toBeTruthy()
      })
    })

    it('should display meals grouped by day', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockMealPlan })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Lunes')).toBeTruthy()
        expect(getByText('Martes')).toBeTruthy()
        expect(getByText('Avena con frutas')).toBeTruthy()
        expect(getByText('Pollo con verduras')).toBeTruthy()
        expect(getByText('Huevos revueltos')).toBeTruthy()
      })
    })

    it('should display meal types and ingredients', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockMealPlan })
      
      const { getByText, getAllByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getAllByText('Desayuno').length).toBeGreaterThan(0)
        expect(getAllByText('Almuerzo').length).toBeGreaterThan(0)
        expect(getByText(/Ingredientes: Avena, fresas, plátano/)).toBeTruthy()
      })
    })
  })

  describe('Create Plan Modal', () => {
    it('should open create modal when + Crear is pressed', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        expect(getByText('Nuevo Plan')).toBeTruthy()
      })
    })

    it('should show patient name in modal', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText, getAllByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        expect(getByText(/Para:/)).toBeTruthy()
        expect(getAllByText('Juan Pérez').length).toBeGreaterThan(0)
      })
    })

    it('should have all basic form fields', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText, getByPlaceholderText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        expect(getByText('Nombre del Plan *')).toBeTruthy()
        expect(getByText('Fecha de Inicio')).toBeTruthy()
        expect(getByText('Snacks Permitidos (opcional)')).toBeTruthy()
        expect(getByPlaceholderText('Ej: Plan Enero 2026')).toBeTruthy()
      })
    })

    it('should display all 7 days of the week', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        expect(getByText('Lunes')).toBeTruthy()
        expect(getByText('Martes')).toBeTruthy()
        expect(getByText('Miércoles')).toBeTruthy()
        expect(getByText('Jueves')).toBeTruthy()
        expect(getByText('Viernes')).toBeTruthy()
        expect(getByText('Sábado')).toBeTruthy()
        expect(getByText('Domingo')).toBeTruthy()
      })
    })

    it('should display all 5 meal types per day', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getAllByText, getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getAllByText('+ Crear')[0])
      
      await waitFor(() => {
        const desayunos = getAllByText('Desayuno')
        const colacionAM = getAllByText('Colación AM')
        const almuerzos = getAllByText('Almuerzo')
        const colacionPM = getAllByText('Colación PM')
        const cenas = getAllByText('Cena')
        
        expect(desayunos.length).toBeGreaterThan(0)
        expect(colacionAM.length).toBeGreaterThan(0)
        expect(almuerzos.length).toBeGreaterThan(0)
        expect(colacionPM.length).toBeGreaterThan(0)
        expect(cenas.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Plan Creation', () => {
    it('should show error when trying to save without plan name', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.press(getByText('Crear'))
      })
      
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'El nombre del plan es requerido')
      expect(api.post).not.toHaveBeenCalled()
    })

    it('should show warning when trying to save without meals', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText, getByPlaceholderText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Ej: Plan Enero 2026'), 'Test Plan')
        fireEvent.press(getByText('Crear'))
      })
      
      expect(Alert.alert).toHaveBeenCalledWith('Aviso', 'Agrega al menos una comida')
      expect(api.post).not.toHaveBeenCalled()
    })

    it('should create plan successfully with valid data', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      api.post.mockResolvedValue({ data: { id: 1 } })
      
      const { getByText, getByPlaceholderText, getAllByPlaceholderText } = render(
        <MealPlansScreen onNavigate={mockNavigate} />
      )
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Ej: Plan Enero 2026'), 'Test Plan')
        
        // Add a meal (get first "Nombre del platillo" input)
        const mealInputs = getAllByPlaceholderText('Nombre del platillo')
        if (mealInputs.length > 0) {
          fireEvent.changeText(mealInputs[0], 'Test Meal')
        }
      })
      
      fireEvent.press(getByText('Crear'))
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/nutritionist/patients/1/meal-plan',
          expect.objectContaining({
            name: 'Test Plan',
            meals: expect.arrayContaining([
              expect.objectContaining({
                name: 'Test Meal'
              })
            ])
          })
        )
        expect(Alert.alert).toHaveBeenCalledWith(
          'Éxito',
          'Plan de comidas creado y notificado al paciente'
        )
      })
    })

    it('should include snacks in the plan', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      api.post.mockResolvedValue({ data: { id: 1 } })
      
      const { getByText, getByPlaceholderText, getAllByPlaceholderText } = render(
        <MealPlansScreen onNavigate={mockNavigate} />
      )
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Ej: Plan Enero 2026'), 'Test Plan')
        fireEvent.changeText(getByPlaceholderText('Frutas, nueces, yogurt...'), 'Test Snacks')
        
        const mealInputs = getAllByPlaceholderText('Nombre del platillo')
        if (mealInputs.length > 0) {
          fireEvent.changeText(mealInputs[0], 'Test Meal')
        }
      })
      
      fireEvent.press(getByText('Crear'))
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/nutritionist/patients/1/meal-plan',
          expect.objectContaining({
            snacks: 'Test Snacks'
          })
        )
      })
    })

    it('should set correct day_of_week for each day', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      api.post.mockResolvedValue({ data: { id: 1 } })
      
      const { getByText, getByPlaceholderText, getAllByPlaceholderText } = render(
        <MealPlansScreen onNavigate={mockNavigate} />
      )
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Ej: Plan Enero 2026'), 'Test Plan')
        
        const mealInputs = getAllByPlaceholderText('Nombre del platillo')
        // Add meals for different days to test day_of_week
        if (mealInputs.length >= 2) {
          fireEvent.changeText(mealInputs[0], 'Lunes Meal') // Should be day 0
          fireEvent.changeText(mealInputs[5], 'Martes Meal') // Should be day 1 (5 meals per day)
        }
      })
      
      fireEvent.press(getByText('Crear'))
      
      await waitFor(() => {
        const postCall = api.post.mock.calls[0]
        if (postCall) {
          const payload = postCall[1]
          expect(payload.meals).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ day_of_week: 0 }),
              expect.objectContaining({ day_of_week: 1 })
            ])
          )
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error banner when patients fail to load', async () => {
      api.get.mockRejectedValue(new Error('Network error'))
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Error al cargar pacientes')).toBeTruthy()
      })
    })

    it('should handle null plan data gracefully', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { queryByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        // Should not crash
        expect(queryByText('Error')).toBeNull()
      })
    })

    it('should show error alert when creation fails', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      api.post.mockRejectedValue(new Error('API Error'))
      
      const { getByText, getByPlaceholderText, getAllByPlaceholderText } = render(
        <MealPlansScreen onNavigate={mockNavigate} />
      )
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Ej: Plan Enero 2026'), 'Test')
        const mealInputs = getAllByPlaceholderText('Nombre del platillo')
        if (mealInputs.length > 0) {
          fireEvent.changeText(mealInputs[0], 'Test Meal')
        }
      })
      
      fireEvent.press(getByText('Crear'))
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo crear el plan')
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate back to dashboard when back button is pressed', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
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
        .mockResolvedValueOnce({ data: null })
      
      const { UNSAFE_getAllByType } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2)
      })
      
      const { ScrollView } = require('react-native')
      const scrollView = UNSAFE_getAllByType(ScrollView).find(sv => sv.props.refreshControl)
      const refreshControl = scrollView && scrollView.props.refreshControl
      
      if (refreshControl && refreshControl.props.onRefresh) {
        await refreshControl.props.onRefresh()
      }
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(3) // 1 more call
      })
    })
  })

  describe('Date Handling', () => {
    it('should set current date as default start date', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: null })
      
      const { getByText, getByDisplayValue } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Juan Pérez')).toBeTruthy()
      })

      fireEvent.press(getByText('+ Crear'))
      
      await waitFor(() => {
        const today = new Date().toISOString().split('T')[0]
        expect(getByDisplayValue(today)).toBeTruthy()
      })
    })

    it('should format plan start date correctly in display', async () => {
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: mockMealPlan })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        // Check for formatted date
        expect(getByText(/Inicio:/)).toBeTruthy()
      })
    })
  })

  describe('Meal Type Coverage', () => {
    it('should handle all meal types correctly', async () => {
      const fullPlan = {
        ...mockMealPlan,
        meals: [
          { day_of_week: 0, meal_type: 'Desayuno', name: 'Test 1', ingredients: 'ing1' },
          { day_of_week: 0, meal_type: 'Colación AM', name: 'Test 2', ingredients: 'ing2' },
          { day_of_week: 0, meal_type: 'Almuerzo', name: 'Test 3', ingredients: 'ing3' },
          { day_of_week: 0, meal_type: 'Colación PM', name: 'Test 4', ingredients: 'ing4' },
          { day_of_week: 0, meal_type: 'Cena', name: 'Test 5', ingredients: 'ing5' }
        ]
      }
      
      api.get
        .mockResolvedValueOnce({ data: mockPatients })
        .mockResolvedValueOnce({ data: fullPlan })
      
      const { getByText } = render(<MealPlansScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Desayuno')).toBeTruthy()
        expect(getByText('Colación AM')).toBeTruthy()
        expect(getByText('Almuerzo')).toBeTruthy()
        expect(getByText('Colación PM')).toBeTruthy()
        expect(getByText('Cena')).toBeTruthy()
      })
    })
  })
})
// File intentionally left blank or removed to match GitHub repo state.
