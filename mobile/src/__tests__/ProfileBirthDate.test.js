import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';
import api from '../api';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../api', () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn() }));
jest.mock('../auth', () => ({
  getContactProfile: jest.fn().mockResolvedValue(null),
  saveContactProfile: jest.fn(),
}));

test('preserves the entered birth date when an older server does not confirm it', async () => {
  api.get.mockResolvedValue({ data: { id: 1, age: 41, sex: 'male', height: 170, current_weight: 70 } });
  api.put.mockResolvedValue({ data: { ok: true } });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const ui = render(<ProfileScreen onNavigate={jest.fn()} accountProfile={{ user_id: 1 }} />);
  await waitFor(() => ui.getByText('Editar'));
  fireEvent.press(ui.getByText('Editar'));
  fireEvent.press(ui.getByLabelText('Seleccionar fecha de nacimiento'));
  fireEvent(ui.getByTestId('birth-date-picker'), 'onChange', { type: 'set' }, new Date(1990, 0, 2));
  fireEvent.press(ui.getByText('Guardar'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith(
    'Aviso', expect.stringContaining('El servidor no confirmó la fecha de nacimiento'),
  ));
  expect(ui.getByText('1990-01-02')).toBeTruthy();
  alert.mockRestore();
});
