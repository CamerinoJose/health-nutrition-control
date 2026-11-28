import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BookAppointment from './BookAppointment'
import Appointments from './Appointments'
import { localDateInput, localMonthInput } from './appointmentSlots'
import api, { getAvailableSlots } from './api'

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  getAvailableSlots: vi.fn(),
  getAppointmentChanges: vi.fn(),
  acceptAppointmentChange: vi.fn(),
  rejectAppointmentChange: vi.fn()
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }))

const slots = [
  { start_time: '09:00', end_time: '09:30', available: true, starts_at: '2026-11-30T15:00:00Z', time_zone: 'America/Mexico_City', utc_offset: '-06:00' },
  { start_time: '09:30', end_time: '10:00', available: false, starts_at: '2026-11-30T15:30:00Z', time_zone: 'America/Mexico_City', utc_offset: '-06:00' }
]

describe('appointment availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: [] })
  })

  it('formats the default booking date using local calendar fields', () => {
    const localDate = new Date(2026, 10, 27, 20, 0)
    expect(localDateInput(localDate)).toBe('2026-11-27')
    expect(localMonthInput(localDate)).toBe('2026-11')
  })

  it('lets the booking screen select only an available time', async () => {
    getAvailableSlots.mockResolvedValue(slots)
    api.post.mockReturnValue(new Promise(() => {}))
    render(<BookAppointment onNavigate={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: '09:00 (UTC-06:00)' }))
    expect(screen.queryByRole('button', { name: '09:30 (UTC-06:00)' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }))
    expect(api.post).toHaveBeenCalledWith('/appointments', expect.objectContaining({ appointment_time: '09:00', starts_at: '2026-11-30T15:00:00Z' }))
  })

  it('does not show a response for a previously selected date', async () => {
    let resolveOld
    getAvailableSlots.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
    getAvailableSlots.mockResolvedValueOnce([{ start_time: '11:00', available: true, starts_at: '2027-01-10T17:00:00Z', time_zone: 'America/Mexico_City', utc_offset: '-06:00' }])
    render(<BookAppointment onNavigate={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2027-01-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ver horarios' }))
    await screen.findByRole('button', { name: '11:00 (UTC-06:00)' })
    resolveOld(slots)
    await waitFor(() => expect(screen.queryByRole('button', { name: '09:00 (UTC-06:00)' })).toBeNull())
  })

  it('distinguishes repeated professional times by UTC offset', async () => {
    getAvailableSlots.mockResolvedValue([
      { start_time: '01:30', available: true, starts_at: '2026-11-01T05:30:00Z', time_zone: 'America/New_York', utc_offset: '-04:00' },
      { start_time: '01:30', available: true, starts_at: '2026-11-01T06:30:00Z', time_zone: 'America/New_York', utc_offset: '-05:00' }
    ])
    api.post.mockReturnValue(new Promise(() => {}))
    render(<BookAppointment onNavigate={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: '01:30 (UTC-05:00)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }))
    expect(api.post).toHaveBeenCalledWith('/appointments', expect.objectContaining({ starts_at: '2026-11-01T06:30:00Z' }))
  })

  it('shows available times in the quick scheduler', async () => {
    getAvailableSlots.mockResolvedValue(slots)
    render(<Appointments />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver horarios' }))
    fireEvent.click(await screen.findByRole('button', { name: '09:00 (UTC-06:00)' }))
    expect(screen.queryByRole('button', { name: '09:30 (UTC-06:00)' })).toBeNull()
    await waitFor(() => expect(screen.getAllByRole('button', { name: '09:00 (UTC-06:00)' })).toHaveLength(2))
  })

  it('reports an invalid response instead of claiming there are no times', async () => {
    getAvailableSlots.mockResolvedValue([{ start_time: '09:00' }])
    render(<BookAppointment onNavigate={vi.fn()} />)
    await screen.findByText('No pudimos cargar horarios disponibles')
    expect(screen.queryByText('No hay horarios disponibles para esta fecha')).toBeNull()
  })
})
