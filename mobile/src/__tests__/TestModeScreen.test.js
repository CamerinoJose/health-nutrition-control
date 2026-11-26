import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TestModeScreen from '../TestModeScreen';

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
});

test('renders test cases and allows marking a case approved', async () => {
  render(<TestModeScreen onNavigate={jest.fn()} profile={{ user_id: 42 }} />);
  expect(await screen.findAllByText('Registrar una cuenta nueva')).toBeTruthy();
  const cases = screen.getAllByText('Registrar una cuenta nueva');
  fireEvent.press(cases[0]);
  fireEvent.press(screen.getByText('Aprobado'));
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'bienestar_test_results_v1:42',
    expect.any(String),
  );
});
