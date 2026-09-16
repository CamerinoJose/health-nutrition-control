import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Share } from 'react-native'
import PatientsScreen from '../PatientsScreen'
import api from '../../api'

jest.mock('../../api')

describe('NutritionistPatientsScreen', () => {
  const mockNavigate = jest.fn()

  const mockPatients = [
    {
      id: 1,
      name: 'Juan Pérez',
      email: 'juan@test.com',
      phone: '555-0001',
      height: 175,
      weight: 80,
      age: 30,
      sex: 'M',
      activity_level: 'moderado',
      goal: 'pérdida',
      appointment_count: 3
    },
    {
      id: 2,
      name: 'María García',
      email: 'maria@test.com',
      phone: '555-0002',
      height: 160,
      weight: 65,
      age: 25,
      sex: 'F',
      activity_level: 'activo',
      goal: 'mantenimiento',
      appointment_count: 2
    }
  ]

  const mockPatientDetails = {
    id: 1,
    name: 'Juan Pérez',
    email: 'juan@test.com',
    last_visit: '2026-01-10T10:00:00Z',
    weight: 80
  }

  const mockHistory = [
    { id: 1, date: '2026-01-01', weight: 82 },
    { id: 2, date: '2026-01-08', weight: 80 }
  ]

  const mockRecommendations = [
    {
      id: 1,
      created_at: '2026-01-01T10:00:00Z',
      recommendation_text: 'Reducir carbohidratos refinados'
    },
    {
      id: 2,
      created_at: '2026-01-08T10:00:00Z',
      recommendation_text: 'Caminar 30 minutos diarios'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    Share.share = jest.fn(async () => ({ action: 'sharedAction' }))
    global.console.error = jest.fn()
  })

  it('renders the header and back button', async () => {
    api.get.mockResolvedValue({ data: [] })
    const { getByText } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(getByText('Pacientes')).toBeTruthy()
      expect(getByText('←')).toBeTruthy()
    })
  })

  it('shows the loading indicator while patients load', () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    const { UNSAFE_queryByType } = render(<PatientsScreen onNavigate={mockNavigate} />)

    expect(UNSAFE_queryByType('ActivityIndicator')).toBeTruthy()
  })

  it('shows the empty state when no patients exist', async () => {
    api.get.mockResolvedValue({ data: [] })
    const { getByText } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(getByText('Sin pacientes')).toBeTruthy()
    })
  })

  it('displays all patients in the list', async () => {
    api.get.mockResolvedValue({ data: mockPatients })
    const { getByText } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(getByText('Juan Pérez')).toBeTruthy()
      expect(getByText('María García')).toBeTruthy()
      expect(getByText('juan@test.com')).toBeTruthy()
      expect(getByText('maria@test.com')).toBeTruthy()
    })
  })

  it('shows patient details when a patient is selected', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/nutritionist/patients') return Promise.resolve({ data: mockPatients })
      if (url === '/nutritionist/patients/1') return Promise.resolve({ data: mockPatientDetails })
      if (url === '/nutritionist/patients/1/history') return Promise.resolve({ data: mockHistory })
      if (url === '/nutritionist/recommendations/1') return Promise.resolve({ data: mockRecommendations })
      return Promise.resolve({ data: [] })
    })

    const { getAllByText, getByText } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(getAllByText('Juan Pérez').length).toBeGreaterThan(0)
      expect(getByText(/Última visita:/)).toBeTruthy()
      expect(getByText(/Peso actual:/)).toBeTruthy()
      expect(getByText('Historial reciente')).toBeTruthy()
    })
  })

  it('switches to the recommendations tab and renders recommendation text', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/nutritionist/patients') return Promise.resolve({ data: mockPatients })
      if (url === '/nutritionist/patients/1') return Promise.resolve({ data: mockPatientDetails })
      if (url === '/nutritionist/patients/1/history') return Promise.resolve({ data: mockHistory })
      if (url === '/nutritionist/recommendations/1') return Promise.resolve({ data: mockRecommendations })
      return Promise.resolve({ data: [] })
    })

    const { getByText } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      fireEvent.press(getByText('Recomendaciones (2)'))
    })

    await waitFor(() => {
      expect(getByText('Reducir carbohidratos refinados')).toBeTruthy()
      expect(getByText('Caminar 30 minutos diarios')).toBeTruthy()
    })
  })

  it('exports the patient report through Share', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/nutritionist/patients') return Promise.resolve({ data: mockPatients })
      if (url === '/nutritionist/patients/1') return Promise.resolve({ data: mockPatientDetails })
      if (url === '/nutritionist/patients/1/history') return Promise.resolve({ data: mockHistory })
      if (url === '/nutritionist/recommendations/1') return Promise.resolve({ data: mockRecommendations })
      return Promise.resolve({ data: [] })
    })

    const { getByText } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      fireEvent.press(getByText('📄'))
    })

    await waitFor(() => {
      expect(Share.share).toHaveBeenCalledTimes(1)
      const shareCall = Share.share.mock.calls[0][0]
      expect(shareCall.message).toContain('Juan Pérez')
      expect(shareCall.message).toContain('REPORTE DE PACIENTE')
    })
  })

  it('logs export errors without crashing', async () => {
    Share.share = jest.fn(async () => {
      throw new Error('Share failed')
    })

    api.get.mockImplementation((url) => {
      if (url === '/nutritionist/patients') return Promise.resolve({ data: mockPatients })
      if (url === '/nutritionist/patients/1') return Promise.resolve({ data: mockPatientDetails })
      if (url === '/nutritionist/patients/1/history') return Promise.resolve({ data: mockHistory })
      if (url === '/nutritionist/recommendations/1') return Promise.resolve({ data: mockRecommendations })
      return Promise.resolve({ data: [] })
    })

    const { getByText } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      fireEvent.press(getByText('📄'))
    })

    await waitFor(() => {
      expect(global.console.error).toHaveBeenCalled()
    })
  })

  it('shows an error banner when patients fail to load', async () => {
    api.get.mockRejectedValue(new Error('Network error'))
    const { getByText } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(getByText('No se pudieron cargar los pacientes')).toBeTruthy()
    })
  })

  it('navigates back to dashboard when the back button is pressed', async () => {
    api.get.mockResolvedValue({ data: [] })
    const { getByText } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      fireEvent.press(getByText('←'))
    })

    expect(mockNavigate).toHaveBeenCalledWith('dashboard')
  })

  it('triggers a refresh and reloads patients', async () => {
    api.get.mockResolvedValue({ data: mockPatients })

    const { UNSAFE_queryAllByType } = render(<PatientsScreen onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/nutritionist/patients')
    })

    const scrollView = UNSAFE_queryAllByType('RCTScrollView')[0]
    const refreshControl = scrollView && scrollView.props && scrollView.props.refreshControl

    if (refreshControl && refreshControl.props.onRefresh) {
      await refreshControl.props.onRefresh()
    }

    await waitFor(() => {
      expect(api.get.mock.calls.length).toBeGreaterThan(1)
    })
  })
})
