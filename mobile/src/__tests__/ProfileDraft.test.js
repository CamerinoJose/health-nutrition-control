import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';
import api from '../api';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../api', () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn() }));
jest.mock('../auth', () => ({
  getContactProfile: jest.fn().mockResolvedValue(null),
  saveContactProfile: jest.fn(),
}));

const profile = { id: 1, age: 30, birth_date: '1995-01-01', sex: 'male', height: 170, current_weight: 70 };
let storage;

beforeEach(() => {
  jest.clearAllMocks();
  storage = {};
  AsyncStorage.getItem.mockImplementation(async key => storage[key] ?? null);
  AsyncStorage.setItem.mockImplementation(async (key, value) => { storage[key] = value; });
  AsyncStorage.removeItem.mockImplementation(async key => { delete storage[key]; });
  api.get.mockResolvedValue({ data: profile });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test('keeps an account-scoped draft across restarts and only retries when requested', async () => {
  api.put.mockRejectedValueOnce(new Error('offline'));
  const first = render(<ProfileScreen onNavigate={jest.fn()} accountProfile={{ user_id: 1 }} />);
  await waitFor(() => first.getByText('Editar'));
  fireEvent.press(first.getByText('Editar'));
  fireEvent.changeText(first.getByPlaceholderText('Altura (cm)'), '175');
  fireEvent.press(first.getByText('Guardar'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Guardado pendiente', expect.stringContaining('borrador')));
  expect(JSON.parse(storage['bienestar_health_profile_draft_v1:1']).height).toBe(175);
  first.unmount();

  api.get.mockClear();
  const other = render(<ProfileScreen onNavigate={jest.fn()} accountProfile={{ user_id: 2 }} />);
  await waitFor(() => other.getByText('Editar'));
  expect(other.queryByText(/Cambios pendientes/)).toBeNull();
  other.unmount();

  api.get.mockClear();
  const resumed = render(<ProfileScreen onNavigate={jest.fn()} accountProfile={{ user_id: 1 }} />);
  await waitFor(() => resumed.getByText(/Cambios pendientes/));
  expect(api.get).not.toHaveBeenCalled();
  expect(api.put).toHaveBeenCalledTimes(1);
  fireEvent.press(resumed.getByText('Editar'));
  expect(resumed.getByPlaceholderText('Altura (cm)').props.value).toBe('175');
  api.put.mockResolvedValueOnce({ data: { birth_date: '1995-01-01' } });
  api.get.mockResolvedValueOnce({ data: { ...profile, height: 175 } });
  fireEvent.press(resumed.getByText('Guardar'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Éxito', 'Perfil guardado correctamente'));
  expect(storage['bienestar_health_profile_draft_v1:1']).toBeUndefined();
  expect(resumed.queryByText(/Cambios pendientes/)).toBeNull();
});

test('does not send the profile when the draft cannot be saved', async () => {
  const ui = render(<ProfileScreen onNavigate={jest.fn()} accountProfile={{ user_id: 1 }} />);
  await waitFor(() => ui.getByText('Editar'));
  fireEvent.press(ui.getByText('Editar'));
  AsyncStorage.setItem.mockRejectedValueOnce(new Error('storage error'));
  fireEvent.press(ui.getByText('Guardar'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('El perfil no se envió')));
  expect(api.put).not.toHaveBeenCalled();
  expect(ui.getByPlaceholderText('Altura (cm)').props.value).toBe('170');
});

test('marks a cached profile as unverified when the server is unavailable', async () => {
  storage['bienestar_health_profile_v1:1'] = JSON.stringify(profile);
  api.get.mockRejectedValueOnce(new Error('offline'));
  const ui = render(<ProfileScreen onNavigate={jest.fn()} accountProfile={{ user_id: 1 }} />);
  await waitFor(() => ui.getByText(/Copia local sin verificar/));
  expect(ui.getByText('Editar')).toBeTruthy();
});

test('does not present a new-profile form when loading fails without a cache', async () => {
  api.get.mockRejectedValueOnce(new Error('offline'));
  const ui = render(<ProfileScreen onNavigate={jest.fn()} accountProfile={{ user_id: 1 }} />);
  await waitFor(() => ui.getByText('No se pudo cargar el perfil o su borrador local.'));
  expect(ui.queryByText('Guardar')).toBeNull();
  expect(ui.getByText('Reintentar')).toBeTruthy();
});
