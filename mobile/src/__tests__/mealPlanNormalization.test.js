jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));

import { buildMealUploadMessage, findMealForDayAndType, normalizeMealPlanLabel } from '../MealPlanScreen';

test('normalizes accented and unaccented day names', () => {
  expect(normalizeMealPlanLabel('Miércoles')).toBe('miercoles');
  expect(normalizeMealPlanLabel('  SÁBADO  ')).toBe('sabado');
});

test('finds meals despite Almuerzo alias and parser variants', () => {
  const meals = [
    { day_of_week: 'Miercoles', meal_type: 'Desayuno', name: 'Avena' },
    { day_of_week: 'Miércoles', meal_type: 'Almuerzo', name: 'Arroz' },
  ];
  expect(findMealForDayAndType(meals, 'Miércoles', 'Desayuno')?.name).toBe('Avena');
  expect(findMealForDayAndType(meals, 'Miércoles', 'Comida')?.name).toBe('Arroz');
});

test('upload feedback distinguishes zero and multiple detected meals', () => {
  expect(buildMealUploadMessage(0).title).toBe('PDF cargado, pero sin comidas detectadas');
  expect(buildMealUploadMessage(1).body).toContain('1 comida');
  expect(buildMealUploadMessage(21).body).toContain('21 comidas');
});
