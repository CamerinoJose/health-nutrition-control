import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HealthProfileForm from '../HealthProfileForm';
import { ageFromBirthDate } from '../age';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

const legacyProfile = { age: 41, sex: 'male', height: 170, current_weight: 70 };

test('asks existing users for their birth date and submits the calculated age', () => {
  const onSubmit = jest.fn();
  const ui = render(<HealthProfileForm initialData={legacyProfile} onSubmit={onSubmit} />);
  expect(ui.getByText('Agrega tu fecha de nacimiento para calcular tu edad automáticamente.')).toBeTruthy();
  fireEvent.press(ui.getByText('Guardar'));
  expect(onSubmit).not.toHaveBeenCalled();

  fireEvent.press(ui.getByLabelText('Seleccionar fecha de nacimiento'));
  fireEvent(ui.getByTestId('birth-date-picker'), 'onChange', { type: 'set' }, new Date(1990, 0, 2));
  fireEvent.press(ui.getByText('Guardar'));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    birth_date: '1990-01-02',
    age: ageFromBirthDate('1990-01-02'),
  }));
});

test('dismissing the date picker keeps the birth date empty', () => {
  const ui = render(<HealthProfileForm initialData={legacyProfile} onSubmit={jest.fn()} />);
  fireEvent.press(ui.getByLabelText('Seleccionar fecha de nacimiento'));
  fireEvent(ui.getByTestId('birth-date-picker'), 'onChange', { type: 'dismissed' }, undefined);
  expect(ui.getByText('Agrega tu fecha de nacimiento para calcular tu edad automáticamente.')).toBeTruthy();
});
