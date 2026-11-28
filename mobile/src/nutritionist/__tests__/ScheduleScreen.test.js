import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import ScheduleScreen from '../ScheduleScreen'
import api from '../../api'

jest.mock('../../api', () => ({ get: jest.fn(), put: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  api.get.mockResolvedValue({ data: { time_zone: '', weekly: [], exceptions: [], legacy_count: 0 } })
  api.put.mockResolvedValue({ data: {} })
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

test('saves weekly intervals and a closed-date exception', async () => {
  const ui = render(<ScheduleScreen onBack={jest.fn()} />)
  await waitFor(() => ui.getByLabelText('Zona horaria'))
  fireEvent.changeText(ui.getByLabelText('Zona horaria'), 'America/Mexico_City')
  fireEvent.press(ui.getByText('+ Lunes'))
  fireEvent.changeText(ui.getByLabelText('Inicio semanal 1'), '08:30')
  fireEvent.press(ui.getByText('+ Excepción'))
  fireEvent.changeText(ui.getByLabelText('Fecha excepción 1'), '2030-01-02')
  fireEvent.press(ui.getByText('Guardar agenda'))
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/nutritionist/schedule', {
    time_zone: 'America/Mexico_City', legacy_time_zone: '',
    legacy_instants: {},
    weekly: [{ day_of_week: 1, start_time: '08:30', end_time: '17:00' }],
    exceptions: [{ date: '2030-01-02', intervals: [] }],
  }))
})

test('lets the professional resolve an ambiguous legacy time and preserves input on failure', async () => {
  api.get.mockImplementation((path) => path === '/nutritionist/schedule/legacy-times'
    ? Promise.resolve({ data: { items: [{ kind: 'appointment', id: 10, date: '2026-11-01', time: '01:30', status: 'ambiguous', instants: ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'] }] } })
    : Promise.resolve({ data: { time_zone: 'America/New_York', weekly: [], exceptions: [], legacy_count: 1 } }))
  api.put.mockRejectedValue({ response: { data: { code: 'legacy_time_needs_review' } } })
  const ui = render(<ScheduleScreen onBack={jest.fn()} />)
  await waitFor(() => ui.getByLabelText('Zona de citas anteriores'))
  fireEvent.press(ui.getByText('Guardar agenda'))
  expect(api.put).not.toHaveBeenCalled()
  fireEvent.changeText(ui.getByLabelText('Zona de citas anteriores'), 'America/New_York')
  fireEvent.press(ui.getByText('Revisar citas anteriores'))
  await waitFor(() => ui.getByText('Elegir 2026-11-01T06:30:00Z (UTC)'))
  fireEvent.press(ui.getByText('Elegir 2026-11-01T06:30:00Z (UTC)'))
  fireEvent.press(ui.getByText('Guardar agenda'))
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('No se pudo guardar', expect.stringContaining('hora inválida o repetida')))
  expect(ui.getByLabelText('Zona de citas anteriores').props.value).toBe('America/New_York')
  expect(api.put).toHaveBeenCalledWith('/nutritionist/schedule', expect.objectContaining({
    legacy_instants: { 'appointment:10': '2026-11-01T06:30:00Z' }
  }))
})

test('offers retry for an invalid schedule response', async () => {
  api.get.mockResolvedValueOnce({ data: { time_zone: 'UTC', weekly: [], exceptions: [{ date: '', intervals: null }], legacy_count: 0 } })
  const ui = render(<ScheduleScreen onBack={jest.fn()} />)
  await waitFor(() => ui.getByText('No se pudo cargar la configuración de agenda.'))
  fireEvent.press(ui.getByText('Reintentar'))
  await waitFor(() => ui.getByLabelText('Zona horaria'))
})
