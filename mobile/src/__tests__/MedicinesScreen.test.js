import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import MedicinesScreen from '../../MedicinesScreen';
import { getActiveAccountId } from '../auth';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('expo-notifications', () => ({}));
jest.mock('../api', () => ({ get: jest.fn().mockResolvedValue({ data: {} }), put: jest.fn() }));
jest.mock('../auth', () => ({
  getToken: jest.fn().mockResolvedValue('test-token'),
  getActiveAccountId: jest.fn(),
}));
jest.mock('../reminderAlarm', () => ({ scheduleNextMedicineReminder: jest.fn(), openReminder: jest.fn() }));

let storage;
const response = data => ({ ok: true, status: 200, json: async () => data });

beforeEach(() => {
  jest.clearAllMocks();
  storage = {};
  AsyncStorage.getItem.mockImplementation(async key => storage[key] ?? null);
  AsyncStorage.setItem.mockImplementation(async (key, value) => { storage[key] = value; });
  getActiveAccountId.mockResolvedValue('2');
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

test('never shows another account cache when the network is unavailable', async () => {
  storage.bienestar_user_id = '1';
  storage['bienestar_medicines_v1:1'] = JSON.stringify([{ id: 1, name: 'Otra cuenta', time: '08:00' }]);
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  const ui = render(<MedicinesScreen onBack={jest.fn()} />);
  await waitFor(() => ui.getByText(/No se pudo verificar la lista/));
  expect(ui.queryByText('💊 Otra cuenta')).toBeNull();
  expect(ui.getByText('Reintentar')).toBeTruthy();
  expect(ui.queryByText('No hay medicinas registradas')).toBeNull();
});

test('a successful empty server list replaces stale cached medicines', async () => {
  storage['bienestar_medicines_v1:2'] = JSON.stringify([{ id: 1, name: 'Antigua', time: '08:00' }]);
  global.fetch = jest.fn(async () => response(null));
  const ui = render(<MedicinesScreen onBack={jest.fn()} />);
  await waitFor(() => ui.getByText('No hay medicinas registradas'));
  expect(ui.queryByText('💊 Antigua')).toBeNull();
  expect(JSON.parse(storage['bienestar_medicines_v1:2'])).toEqual([]);
});

test('confirmation reloads the taken state from the server', async () => {
  const med = { id: 1, name: 'Prueba', time: '08:00', taken: false };
  let confirmed = false;
  global.fetch = jest.fn(async (url, options) => {
    if (options?.method === 'PUT') {
      confirmed = true;
      return response({ message: 'ok' });
    }
    if (url.endsWith('/medicines/history')) return response([]);
    return response([{ ...med, taken: confirmed }]);
  });
  const ui = render(<MedicinesScreen onBack={jest.fn()} />);
  await waitFor(() => ui.getByText('Confirmar'));
  fireEvent.press(ui.getByText('Confirmar'));
  await waitFor(() => ui.getByText('✓ Tomada'));
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/medicines/1'), expect.objectContaining({ method: 'PUT' }));
});
