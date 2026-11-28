import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import CalendarScreen from '../CalendarScreen'
import api from '../../api'

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker')
jest.mock('../../api', () => ({ get: jest.fn(), post: jest.fn() }))

const appointment = { id: 4, title: 'Consulta', status: 'scheduled', appointment_date: '2030-11-03', appointment_time: '09:00' }
const slot = { start_time: '10:00', available: true, starts_at: '2030-11-03T16:00:00Z', time_zone: 'America/Mexico_City', utc_offset: '-06:00' }

beforeEach(() => {
  jest.clearAllMocks()
  api.get.mockImplementation(path => Promise.resolve({ data: path === '/nutritionist/appointments' ? [appointment] : [slot] }))
  api.post.mockResolvedValue({ data: { message: 'change proposed' } })
})

test('professional proposes a change using an available slot instant', async () => {
  const ui = render(<CalendarScreen onNavigate={jest.fn()} />)
  fireEvent.press(await ui.findByText('Proponer cambio de horario'))
  fireEvent.press(await ui.findByText('10:00 (UTC-06:00)'))
  fireEvent.press(ui.getByText('Enviar propuesta'))
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/nutritionist/appointments/4/propose-change', {
    new_date: '2030-11-03', new_time: '10:00', new_starts_at: '2030-11-03T16:00:00Z', reason: ''
  }))
})
