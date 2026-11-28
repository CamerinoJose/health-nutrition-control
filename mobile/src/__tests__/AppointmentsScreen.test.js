import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AppointmentsScreen from '../AppointmentsScreen';
import api from '../api';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));

const firstOccurrence = { start_time: '01:30', end_time: '02:00', available: true, starts_at: '2030-11-03T05:30:00Z', time_zone: 'America/New_York', utc_offset: '-04:00' };
const secondOccurrence = { ...firstOccurrence, starts_at: '2030-11-03T06:30:00Z', utc_offset: '-05:00' };

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: url === '/available-slots' ? [firstOccurrence, secondOccurrence] : [] }));
  api.post.mockResolvedValue({ data: { ok: true } });
  api.put.mockResolvedValue({ data: { message: 'change accepted' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test('books the selected occurrence in the professional time zone', async () => {
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => ui.getByText('+ Agendar cita'));
  fireEvent.press(ui.getByText('+ Agendar cita'));
  fireEvent.changeText(ui.getByPlaceholderText('Ej: Consulta con nutricionista'), 'Consulta');

  fireEvent.press(ui.getByLabelText('Seleccionar fecha'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 10, 3, 12, 0));
  await waitFor(() => ui.getByText('01:30 (UTC-05:00)'));
  expect(ui.getByText('Zona del profesional: America/New_York')).toBeTruthy();
  fireEvent.press(ui.getByText('01:30 (UTC-05:00)'));
  fireEvent.press(ui.getByText('Crear Cita'));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/appointments', expect.objectContaining({
    title: 'Consulta',
    appointment_date: '2030-11-03',
    appointment_time: '01:30',
    starts_at: '2030-11-03T06:30:00Z',
  })));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/appointments?month=2030-11'));
});

test('dismissing a picker does not select a value and missing time prevents submission', async () => {
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => ui.getByText('+ Agendar cita'));
  fireEvent.press(ui.getByText('+ Agendar cita'));
  fireEvent.changeText(ui.getByPlaceholderText('Ej: Consulta con nutricionista'), 'Consulta');
  fireEvent.press(ui.getByLabelText('Seleccionar fecha'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'dismissed' }, undefined);
  expect(ui.getByText('Seleccionar fecha')).toBeTruthy();

  fireEvent.press(ui.getByLabelText('Seleccionar fecha'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 0, 2));
  fireEvent.press(ui.getByText('Crear Cita'));
  expect(Alert.alert).toHaveBeenCalledWith('Error', 'Completa los campos requeridos');
  expect(api.post).not.toHaveBeenCalled();
});

test('displays stored calendar dates without shifting them to the previous day', async () => {
  api.get.mockResolvedValue({ data: [{ id: 1, title: 'Consulta', appointment_date: '2030-01-02', appointment_time: '09:05' }] });
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => expect(ui.getByText('📅 2/1/2030')).toBeTruthy());
});

test('shows a retry instead of an empty-list message when loading fails', async () => {
  api.get.mockRejectedValueOnce(new Error('offline'));
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => ui.getByText(/No se pudieron actualizar las citas/));
  expect(ui.queryByText('📅 Sin citas programadas')).toBeNull();
  fireEvent.press(ui.getByText('Reintentar'));
  await waitFor(() => ui.getByText('📅 Sin citas programadas'));
});

test('explains that a nutritionist must be assigned and keeps the form', async () => {
  api.get.mockImplementation(url => url === '/available-slots'
    ? Promise.reject({ response: { data: { error: 'no nutritionist assigned' } } })
    : Promise.resolve({ data: [] }));
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => ui.getByText('+ Agendar cita'));
  fireEvent.press(ui.getByText('+ Agendar cita'));
  fireEvent.changeText(ui.getByPlaceholderText('Ej: Consulta con nutricionista'), 'Consulta');
  fireEvent.press(ui.getByLabelText('Seleccionar fecha'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 0, 2));
  await waitFor(() => ui.getByText(/asigna un nutriólogo/));
  expect(ui.getByPlaceholderText('Ej: Consulta con nutricionista').props.value).toBe('Consulta');
  expect(api.post).not.toHaveBeenCalled();
});

test('ignores a stale availability response after changing the date', async () => {
  let resolveFirst;
  api.get.mockImplementation((url, config) => {
    if (url !== '/available-slots') return Promise.resolve({ data: [] });
    if (config.params.date === '2030-01-02') return new Promise(resolve => { resolveFirst = resolve; });
    return Promise.resolve({ data: [secondOccurrence] });
  });
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => ui.getByText('+ Agendar cita'));
  fireEvent.press(ui.getByText('+ Agendar cita'));
  fireEvent.press(ui.getByLabelText('Seleccionar fecha'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 0, 2));
  await waitFor(() => expect(resolveFirst).toBeDefined());
  fireEvent.press(ui.getByLabelText('Seleccionar fecha'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 0, 3));
  await waitFor(() => ui.getByText('01:30 (UTC-05:00)'));
  await act(async () => resolveFirst({ data: [firstOccurrence] }));
  expect(ui.queryByText('01:30 (UTC-04:00)')).toBeNull();
});

test('reports malformed availability rather than presenting it as an empty schedule', async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === '/available-slots' ? [{ available: true }] : [] }));
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => ui.getByText('+ Agendar cita'));
  fireEvent.press(ui.getByText('+ Agendar cita'));
  fireEvent.press(ui.getByLabelText('Seleccionar fecha'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 0, 2));
  await waitFor(() => ui.getByText(/No se pudieron cargar los horarios/));
  expect(ui.queryByText('No hay horarios disponibles para esta fecha.')).toBeNull();
});

test('shows and accepts a pending professional change proposal', async () => {
  const appointment = { id: 51, title: 'Consulta', appointment_date: '2030-11-03', appointment_time: '09:00', time_zone: 'America/Mexico_City' };
  api.get.mockImplementation(url => {
    if (url.startsWith('/appointments?month=')) return Promise.resolve({ data: [appointment] });
    if (url === '/appointment-changes/51') return Promise.resolve({ data: [{ id: 61, status: 'pending', new_date: '2030-11-04', new_time: '10:00', reason: 'Cambio de agenda' }] });
    return Promise.resolve({ data: [] });
  });
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => ui.getByText('Cambios de cita pendientes'));
  expect(ui.getByText('2030-11-04 · 10:00 (America/Mexico_City)')).toBeTruthy();
  fireEvent.press(ui.getByText('Aceptar'));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/appointment-changes/61/accept', undefined));
});
