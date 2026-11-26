import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ReminderCenter from '../ReminderCenter';
import * as alarms from '../reminderAlarm';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../reminderAlarm', () => ({
  reminderAlarmsAvailable: () => true,
  reconcileReminders: jest.fn(), completeReminder: jest.fn(), cancelReminder: jest.fn(),
  createReminder: jest.fn(), reminderCapabilities: jest.fn(), openExactAlarmSettings: jest.fn(),
  subscribeReminderOpen: jest.fn(() => () => {}), reminderIdFromUrl: jest.fn(),
  isPendingReminder: (r) => r.status === 'active' || r.status === 'scheduled',
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  alarms.reconcileReminders.mockResolvedValue([{ id: 'one', title: 'Prueba pendiente', body: 'Tarea', status: 'active', scheduledAt: 10000 }]);
  alarms.reminderCapabilities.mockResolvedValue({ paused: false, notifications: true, exactAlarms: true });
  alarms.completeReminder.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

test('opening and closing the center cannot complete a reminder; Done can', async () => {
  const ui = render(<ReminderCenter />);
  fireEvent.press(ui.getByLabelText('Abrir recordatorios persistentes'));
  await waitFor(() => expect(ui.getByText('Prueba pendiente')).toBeTruthy());
  expect(alarms.completeReminder).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText('Cerrar sin completar'));
  expect(alarms.completeReminder).not.toHaveBeenCalled();
  fireEvent.press(ui.getByLabelText('Abrir recordatorios persistentes'));
  await act(async () => fireEvent.press(ui.getByText('✓ Hecho')));
  expect(alarms.completeReminder).toHaveBeenCalledTimes(1);
  expect(alarms.completeReminder).toHaveBeenCalledWith('one');
  ui.unmount();
});

test('notification selection opens pending task without completing it', async () => {
  const ui = render(<ReminderCenter />);
  const onOpen = alarms.subscribeReminderOpen.mock.calls[0][0];
  await act(async () => onOpen('one'));
  expect(ui.getByText('Prueba pendiente')).toBeTruthy();
  expect(alarms.completeReminder).not.toHaveBeenCalled();
  expect(alarms.cancelReminder).not.toHaveBeenCalled();
  ui.unmount();
});

test('signed-out users see a clear paused state and no creation form', async () => {
  alarms.reconcileReminders.mockResolvedValue([]);
  alarms.reminderCapabilities.mockResolvedValue({ paused: true, notifications: true, exactAlarms: true });
  const ui = render(<ReminderCenter />);
  fireEvent.press(ui.getByLabelText('Abrir recordatorios persistentes'));
  await waitFor(() => expect(ui.getByText('Inicia sesión con tu cuenta para crear o ver recordatorios locales.')).toBeTruthy());
  expect(ui.queryByText('Nuevo recordatorio')).toBeNull();
  ui.unmount();
});

test('can hide the floating launcher in screens with their own reminder access', () => {
  const ui = render(<ReminderCenter hidden />);
  expect(ui.queryByLabelText('Abrir recordatorios persistentes')).toBeNull();
  ui.unmount();
});
