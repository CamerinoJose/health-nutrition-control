import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AppointmentsScreen from '../AppointmentsScreen';
import api from '../api';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: [] });
  api.post.mockResolvedValue({ data: { ok: true } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test('selects local date and time and sends the expected appointment fields', async () => {
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => ui.getByText('+ Agendar cita'));
  fireEvent.press(ui.getByText('+ Agendar cita'));
  fireEvent.changeText(ui.getByPlaceholderText('Ej: Consulta con nutricionista'), 'Consulta');

  fireEvent.press(ui.getByLabelText('Seleccionar fecha'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 0, 2, 12, 0));
  fireEvent.press(ui.getByLabelText('Seleccionar hora'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 0, 2, 9, 5));
  fireEvent.press(ui.getByText('Crear Cita'));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/appointments', expect.objectContaining({
    title: 'Consulta',
    appointment_date: '2030-01-02',
    appointment_time: '09:05',
  })));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/appointments?month=2030-01'));
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
  api.post.mockRejectedValueOnce({ response: { data: { error: 'please assign a nutritionist before booking' } } });
  const ui = render(<AppointmentsScreen onNavigate={jest.fn()} />);
  await waitFor(() => ui.getByText('+ Agendar cita'));
  fireEvent.press(ui.getByText('+ Agendar cita'));
  fireEvent.changeText(ui.getByPlaceholderText('Ej: Consulta con nutricionista'), 'Consulta');
  fireEvent.press(ui.getByLabelText('Seleccionar fecha'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 0, 2));
  fireEvent.press(ui.getByLabelText('Seleccionar hora'));
  fireEvent(ui.getByTestId('appointment-picker'), 'onChange', { type: 'set' }, new Date(2030, 0, 2, 9, 5));
  fireEvent.press(ui.getByText('Crear Cita'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('asigna un nutriólogo')));
  expect(ui.getByPlaceholderText('Ej: Consulta con nutricionista').props.value).toBe('Consulta');
});
