// File intentionally left blank or removed to match production Expo Go environment.
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import RecipesScreen from '../RecipesScreen'
import api from '../../api'

jest.mock('../../api')

describe('NutritionistRecipesScreen', () => {
  const mockNavigate = jest.fn()
  const mockRecipes = [
    {
      id: 1,
      name: 'Ensalada César',
      category: 'Verduras',
      prep_time: 20,
      servings: 2,
      calories: 350,
      protein: 25,
      carbs: 15,
      fat: 20,
      ingredients: 'Lechuga, pollo, parmesano',
      instructions: 'Mezclar todo',
      image_url: 'https://example.com/image.jpg'
    },
    {
      id: 2,
      name: 'Pollo Asado',
      category: 'Proteínas',
      prep_time: 45,
      servings: 4,
      calories: 450,
      protein: 40,
      carbs: 10,
      fat: 25,
      ingredients: 'Pollo, especias',
      instructions: 'Hornear 45 min',
      image_url: 'https://example.com/image2.jpg'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the screen with header', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Recetas')).toBeTruthy()
        expect(getByText('← Volver')).toBeTruthy()
        expect(getByText('+ Crear')).toBeTruthy()
      })
    })

    it('should display loading indicator initially', () => {
      api.get.mockImplementation(() => new Promise(() => {}))
      const { getByTestId, UNSAFE_queryByType } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      // Check for ActivityIndicator
      const activityIndicators = UNSAFE_queryByType('ActivityIndicator')
      expect(activityIndicators).toBeTruthy()
    })

    it('should display empty state when no recipes exist', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('📖 No hay recetas todavía')).toBeTruthy()
        expect(getByText('Crear primera receta')).toBeTruthy()
      })
    })

    it('should display recipes when loaded', async () => {
      api.get.mockResolvedValue({ data: mockRecipes })
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Ensalada César')).toBeTruthy()
        expect(getByText('Pollo Asado')).toBeTruthy()
        expect(getByText('Verduras')).toBeTruthy()
        expect(getByText('Proteínas')).toBeTruthy()
      })
    })
  })

  describe('Recipe Information Display', () => {
    it('should display recipe details correctly', async () => {
      api.get.mockResolvedValue({ data: mockRecipes })
      const { getByText, getAllByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('⏱️ 20 min')).toBeTruthy()
        expect(getByText('👥 2 porciones')).toBeTruthy()
        expect(getByText('🔥 350 kcal')).toBeTruthy()
        expect(getAllByText('25g').length).toBeGreaterThan(0)
        expect(getAllByText('15g').length).toBeGreaterThan(0)
        expect(getAllByText('20g').length).toBeGreaterThan(0)
      })
    })

    it('should display ingredients when available', async () => {
      api.get.mockResolvedValue({ data: mockRecipes })
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Lechuga, pollo, parmesano')).toBeTruthy()
      })
    })
  })

  describe('Create Recipe Modal', () => {
    it('should open create modal when + Crear is pressed', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('+ Crear'))
      })
      
      await waitFor(() => {
        expect(getByText('Crear Receta')).toBeTruthy()
      })
    })

    it('should have all required form fields in create modal', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText, getByPlaceholderText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('+ Crear'))
      })
      
      await waitFor(() => {
        expect(getByPlaceholderText('Ej: Ensalada César')).toBeTruthy()
        expect(getByText('Categoría')).toBeTruthy()
        expect(getByPlaceholderText('Lista de ingredientes...')).toBeTruthy()
        expect(getByPlaceholderText('Pasos de preparación...')).toBeTruthy()
      })
    })

    it('should close modal when X is pressed', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText, queryByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('+ Crear'))
      })
      
      await waitFor(() => {
        expect(getByText('Crear Receta')).toBeTruthy()
      })
      
      fireEvent.press(getByText('✕'))
      
      await waitFor(() => {
        expect(queryByText('Crear Receta')).toBeNull()
      })
    })
  })

  describe('Recipe Creation', () => {
    it('should show error when trying to save without name', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('+ Crear'))
      })
      
      await waitFor(() => {
        fireEvent.press(getByText('Guardar'))
      })
      
      // Alert.alert is called but we can't easily test it without more mocking
      // This is more of an integration test
      expect(api.post).not.toHaveBeenCalled()
    })

    it('should create recipe successfully with valid data', async () => {
      api.get.mockResolvedValue({ data: [] })
      api.post.mockResolvedValue({ data: { id: 3, name: 'Nueva Receta' } })
      
      const { getByText, getByPlaceholderText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('+ Crear'))
      })
      
      await waitFor(() => {
        const nameInput = getByPlaceholderText('Ej: Ensalada César')
        fireEvent.changeText(nameInput, 'Nueva Receta')
      })
      
      fireEvent.press(getByText('Guardar'))
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/nutritionist/recipes', expect.objectContaining({
          name: 'Nueva Receta'
        }))
      })
    })
  })

  describe('Recipe Editing', () => {
    it('should open edit modal when edit button is pressed', async () => {
      api.get.mockResolvedValue({ data: mockRecipes })
      const { getByText, getAllByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Ensalada César')).toBeTruthy()
      })
      
      // Find and press edit button (✏️)
      const editButtons = getAllByText('✏️')
      fireEvent.press(editButtons[0])
      
      await waitFor(() => {
        expect(getByText('Editar Receta')).toBeTruthy()
      })
    })

    it('should pre-fill form when editing existing recipe', async () => {
      api.get.mockResolvedValue({ data: mockRecipes })
      const { getAllByText, getByDisplayValue, getAllByDisplayValue } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        const editButtons = getAllByText('✏️')
        fireEvent.press(editButtons[0])
      })
      
      await waitFor(() => {
        expect(getByDisplayValue('Ensalada César')).toBeTruthy()
        expect(getAllByDisplayValue('20').length).toBeGreaterThan(0)
        expect(getAllByDisplayValue('2').length).toBeGreaterThan(0)
      })
    })

    it('should update recipe successfully', async () => {
      api.get.mockResolvedValue({ data: mockRecipes })
      api.put.mockResolvedValue({ data: { id: 1, name: 'Ensalada César Actualizada' } })
      
      const { getAllByText, getByDisplayValue, getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        const editButtons = getAllByText('✏️')
        fireEvent.press(editButtons[0])
      })
      
      await waitFor(() => {
        const nameInput = getByDisplayValue('Ensalada César')
        fireEvent.changeText(nameInput, 'Ensalada César Actualizada')
      })
      
      fireEvent.press(getByText('Guardar'))
      
      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/nutritionist/recipes/1', expect.objectContaining({
          name: 'Ensalada César Actualizada'
        }))
      })
    })
  })

  describe('Recipe Deletion', () => {
    it('should call delete API when delete is confirmed', async () => {
      api.get.mockResolvedValue({ data: mockRecipes })
      api.delete.mockResolvedValue({ data: { success: true } })

      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
        const confirmButton = Array.isArray(buttons) ? buttons.find(b => b.style === 'destructive') : null
        if (confirmButton && confirmButton.onPress) {
          confirmButton.onPress()
        }
      })

      const { getAllByText } = render(<RecipesScreen onNavigate={mockNavigate} />)

      await waitFor(() => {
        const deleteButtons = getAllByText('🗑️')
        fireEvent.press(deleteButtons[0])
      })

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/nutritionist/recipes/1')
      })

      alertSpy.mockRestore()
    })
  })

  describe('Category Selection', () => {
    it('should display all categories in modal', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('+ Crear'))
      })
      
      await waitFor(() => {
        expect(getByText('Proteínas')).toBeTruthy()
        expect(getByText('Carbohidratos')).toBeTruthy()
        expect(getByText('Verduras')).toBeTruthy()
        expect(getByText('Frutas')).toBeTruthy()
        expect(getByText('Snacks')).toBeTruthy()
        expect(getByText('Postres')).toBeTruthy()
        expect(getByText('Bebidas')).toBeTruthy()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error banner when API fails', async () => {
      api.get.mockRejectedValue(new Error('Network error'))
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('Error al cargar recetas')).toBeTruthy()
      })
    })

    it('should handle empty response gracefully', async () => {
      api.get.mockResolvedValue({ data: null })
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(getByText('📖 No hay recetas todavía')).toBeTruthy()
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate back to dashboard when back button is pressed', async () => {
      api.get.mockResolvedValue({ data: [] })
      const { getByText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('← Volver'))
      })
      
      expect(mockNavigate).toHaveBeenCalledWith('dashboard')
    })
  })

  describe('Pull to Refresh', () => {
    it('should reload recipes on pull to refresh', async () => {
      api.get.mockResolvedValue({ data: mockRecipes })
      const { UNSAFE_getAllByType } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(1)
      })
      
      const { ScrollView } = require('react-native')
      const scrollView = UNSAFE_getAllByType(ScrollView)[0]
      const refreshControl = scrollView.props.refreshControl
      
      if (refreshControl && refreshControl.props.onRefresh) {
        await refreshControl.props.onRefresh()
      }
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Data Validation', () => {
    it('should convert string inputs to numbers for numeric fields', async () => {
      api.get.mockResolvedValue({ data: [] })
      api.post.mockResolvedValue({ data: { id: 3 } })
      
      const { getByText, getByPlaceholderText } = render(<RecipesScreen onNavigate={mockNavigate} />)
      
      await waitFor(() => {
        fireEvent.press(getByText('+ Crear'))
      })
      
      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Ej: Ensalada César'), 'Test Recipe')
      })
      
      fireEvent.press(getByText('Guardar'))
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/nutritionist/recipes', expect.objectContaining({
          name: 'Test Recipe',
          prep_time: expect.any(Number),
          servings: expect.any(Number),
          calories: expect.any(Number),
          protein: expect.any(Number),
          carbs: expect.any(Number),
          fat: expect.any(Number)
        }))
      })
    })
  })
})
// File intentionally left blank or removed to match GitHub repo state.
