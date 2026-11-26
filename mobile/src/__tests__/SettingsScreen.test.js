import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import api from '../api';
import SettingsScreen from '../SettingsScreen';

jest.mock('../api', () => ({
  __esModule: true,
  default: { delete: jest.fn(), put: jest.fn() },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: jest.fn(), i18n: { language: 'es', changeLanguage: jest.fn() } }),
}));
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0',
  nativeBuildVersion: '1',
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const confirmDeletion = () => {
  fireEvent.press(screen.getByText('Eliminar cuenta'));
  const [title, , buttons] = Alert.alert.mock.calls[0];
  expect(title).toBe('Eliminar cuenta');
  return buttons;
};

const openPasswordPrompt = () => {
  const buttons = confirmDeletion();
  act(() => buttons.find((button) => button.text === 'Continuar').onPress());
};

test('asks for confirmation and cancel does not delete the account', () => {
  const onLogout = jest.fn();
  render(<SettingsScreen onNavigate={jest.fn()} onLogout={onLogout} />);

  const buttons = confirmDeletion();
  expect(buttons.find((button) => button.text === 'Cancelar').style).toBe('cancel');
  expect(api.delete).not.toHaveBeenCalled();
  expect(onLogout).not.toHaveBeenCalled();
});

test('allows cancelling the password prompt without deleting', () => {
  render(<SettingsScreen onNavigate={jest.fn()} />);
  openPasswordPrompt();
  fireEvent.changeText(screen.getByLabelText('Contraseña actual'), 'secreto');
  fireEvent.press(screen.getByText('Cancelar'));
  expect(api.delete).not.toHaveBeenCalled();
  openPasswordPrompt();
  expect(screen.getByLabelText('Contraseña actual').props.value).toBe('');
});

test('deletes only after confirmation and invokes the account callback only after success', async () => {
  let resolveDelete;
  api.delete.mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }));
  const onAccountDeleted = jest.fn();
  const onLogout = jest.fn();
  render(<SettingsScreen onNavigate={jest.fn()} onAccountDeleted={onAccountDeleted} onLogout={onLogout} />);

  openPasswordPrompt();
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Contraseña actual'), 'contraseña actual');
  fireEvent.press(screen.getByText('Confirmar eliminación'));
  expect(api.delete).toHaveBeenCalledWith('/me', { data: { password: 'contraseña actual' } });
  expect(onAccountDeleted).not.toHaveBeenCalled();
  expect(onLogout).not.toHaveBeenCalled();
  await act(async () => { resolveDelete({}); });
  expect(onAccountDeleted).toHaveBeenCalledTimes(1);
  expect(onLogout).not.toHaveBeenCalled();
});

test('falls back to logout on successful deletion when no account callback is supplied', async () => {
  api.delete.mockResolvedValue({});
  const onLogout = jest.fn();
  render(<SettingsScreen onNavigate={jest.fn()} onLogout={onLogout} />);

  openPasswordPrompt();
  fireEvent.press(screen.getByText('Confirmar eliminación'));
  expect(api.delete).toHaveBeenCalledWith('/me', { data: { password: '' } });
  await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
});

test('shows an error and keeps the session when deletion fails', async () => {
  api.delete.mockRejectedValue(new Error('offline'));
  const onAccountDeleted = jest.fn();
  const onLogout = jest.fn();
  render(<SettingsScreen onNavigate={jest.fn()} onAccountDeleted={onAccountDeleted} onLogout={onLogout} />);

  openPasswordPrompt();
  fireEvent.press(screen.getByText('Confirmar eliminación'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
    'Error', 'No se pudo eliminar la cuenta. Verifica tu contraseña o inicia sesión de nuevo y vuelve a intentarlo.',
  ));
  expect(onAccountDeleted).not.toHaveBeenCalled();
  expect(onLogout).not.toHaveBeenCalled();
});

test('opens the deployed privacy policy', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  render(<SettingsScreen onNavigate={jest.fn()} />);
  fireEvent.press(screen.getByRole('link', { name: 'Política de privacidad' }));
  await waitFor(() => expect(openURL).toHaveBeenCalledWith(
    'https://health-nutrition-control-web.onrender.com/privacy-policy.html',
  ));
});

test('shows an error if the privacy policy cannot be opened', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('unavailable'));
  render(<SettingsScreen onNavigate={jest.fn()} />);
  fireEvent.press(screen.getByRole('link', { name: 'Política de privacidad' }));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
    'Error', 'No se pudo abrir la política de privacidad.',
  ));
});
