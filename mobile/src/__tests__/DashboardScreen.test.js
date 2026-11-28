import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import DashboardScreen from '../DashboardScreen';
import api from '../api';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows professional navigation only for a nutritionist', () => {
  const onNavigate = jest.fn();
  const ui = render(<DashboardScreen profile={{ role: 'nutritionist', name: 'Test' }} onNavigate={onNavigate} />);
  expect(ui.getByText('professionalDashboard')).toBeTruthy();
  expect(api.get).not.toHaveBeenCalled();
  const sections = [
    ['professionalPatients', 'nutri-patients'],
    ['professionalAppointments', 'nutri-calendar'],
    ['professionalRecommendations', 'nutri-recommendations'],
    ['professionalMealPlans', 'nutri-meal-plans'],
    ['recipes', 'nutri-recipes'],
  ];
  sections.forEach(([label, target]) => {
    fireEvent.press(ui.getByText(label));
    expect(onNavigate).toHaveBeenLastCalledWith(target);
  });
});

test.each(['user', 'admin'])('%s does not see professional navigation', async role => {
  api.get.mockResolvedValue({ data: [] });
  const ui = render(<DashboardScreen profile={{ role }} onNavigate={jest.fn()} />);
  await waitFor(() => expect(ui.getByText('Atajos')).toBeTruthy());
  expect(ui.queryByText('professionalPatients')).toBeNull();
});

test('does not log profile, meal plan, or food log contents', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  api.get.mockImplementation(path => {
    if (path === '/meal-plan') return Promise.resolve({ data: { meals: [{ name: 'private meal' }] } });
    if (path.startsWith('/food-log')) return Promise.resolve({ data: [{ notes: 'private food log' }] });
    return Promise.resolve({ data: [] });
  });
  const ui = render(<DashboardScreen profile={{ role: 'user', name: 'private profile' }} onNavigate={jest.fn()} />);
  await waitFor(() => expect(ui.getByText('Atajos')).toBeTruthy());
  const output = JSON.stringify([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]);
  expect(output).not.toContain('private profile');
  expect(output).not.toContain('private meal');
  expect(output).not.toContain('private food log');
  jest.restoreAllMocks();
});
