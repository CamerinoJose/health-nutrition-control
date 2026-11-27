import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import MessagesScreen from '../MessagesScreen';
import api from '../api';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));

test('warns when older messages are restricted', async () => {
  api.get.mockResolvedValue({
    data: [],
    headers: { 'x-restricted-legacy-messages': 'true' },
  });
  const ui = render(<MessagesScreen onNavigate={jest.fn()} profile={{ id: 1 }} />);
  await waitFor(() => expect(ui.getByText('restrictedLegacyMessages')).toBeTruthy());
});

test('opens the configured support account instead of a fixed ID', async () => {
  api.get.mockImplementation(path => Promise.resolve(path === '/support'
    ? { data: { id: 17, name: 'Soporte' } }
    : { data: [], headers: {} }));
  const ui = render(<MessagesScreen onNavigate={jest.fn()} profile={{ id: 1 }} />);
  await waitFor(() => ui.getByText('Chat con soporte'));
  fireEvent.press(ui.getByText('Chat con soporte'));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/messages?user_id=17'));
});

test('does not log conversation content', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  api.get.mockImplementation(path => Promise.resolve(path === '/messages/conversations'
    ? { data: [{ user_id: 17, user_name: 'Support', last_message: 'private test content' }] }
    : { data: [] }));
  const ui = render(<MessagesScreen onNavigate={jest.fn()} profile={{ id: 1 }} />);
  await waitFor(() => ui.getByText('Support'));
  expect(JSON.stringify(log.mock.calls)).not.toContain('private test content');
  log.mockRestore();
});
