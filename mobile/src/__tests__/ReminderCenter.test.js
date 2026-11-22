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
  alarms.reminderCapabilities.mockResolvedValue({ notifications: true, exactAlarms: true });
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
