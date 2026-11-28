import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NutritionistDashboard from './NutritionistDashboard'
import api, { getNutritionistAppointments, getPatients, proposeAppointmentChange } from './api'

vi.mock('./api', () => ({
  default: { get: vi.fn() },
  getPatients: vi.fn(), getPatientDetails: vi.fn(), getPatientHistory: vi.fn(),
  getNutritionistAppointments: vi.fn(), updateAppointmentNotes: vi.fn(),
  createRecommendation: vi.fn(), getRecommendations: vi.fn(), getRecipes: vi.fn(),
  createRecipe: vi.fn(), updateRecipe: vi.fn(), deleteRecipe: vi.fn(),
  proposeAppointmentChange: vi.fn(), sendMessageToPatient: vi.fn(),
}))

const appointment = { id: 4, title: 'Consulta', status: 'scheduled', appointment_date: '2030-11-03', appointment_time: '09:00', time_zone: 'America/Mexico_City' }
const slot = { start_time: '10:00', available: true, starts_at: '2030-11-03T16:00:00Z', time_zone: 'America/Mexico_City', utc_offset: '-06:00' }

describe('professional appointment proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPatients.mockResolvedValue([])
    getNutritionistAppointments.mockResolvedValue([appointment])
    api.get.mockResolvedValue({ data: [slot] })
    proposeAppointmentChange.mockResolvedValue({ data: { message: 'change proposed' } })
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('selects an available professional slot and sends its instant', async () => {
    render(<NutritionistDashboard profile={{ name: 'Profesional' }} />)
    fireEvent.click(screen.getByRole('button', { name: /Citas/ }))
    fireEvent.click(await screen.findByTitle('Proponer un cambio de fecha/hora al paciente'))
    fireEvent.click(await screen.findByRole('button', { name: '10:00 (UTC-06:00)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/nutritionist/available-slots', { params: { date: '2030-11-03' } }))
    await waitFor(() => expect(proposeAppointmentChange).toHaveBeenCalledWith(4, {
      new_date: '2030-11-03', new_time: '10:00', new_starts_at: '2030-11-03T16:00:00Z', reason: ''
    }))
  })
})
