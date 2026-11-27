import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SupportScreen from '../SupportScreen';
import api from '../api';

jest.mock('../api', () => ({ post: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('confirms and clears feedback only after the server saves it', async () => {
  api.post.mockResolvedValue({ status: 201, data: { id: 1, status: 'pending' } });
  const ui = render(<SupportScreen onNavigate={jest.fn()} />);
  fireEvent.changeText(ui.getByLabelText('subject'), ' Idea ');
  fireEvent.changeText(ui.getByLabelText('message'), ' Texto ');
  fireEvent.press(ui.getByText('feedbackSubmit'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/feedback', { subject: 'Idea', message: 'Texto' }));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('feedbackTitle', 'feedbackSent'));
  expect(ui.getByLabelText('message').props.value).toBe('');
});

test('preserves feedback and reports a failed submission', async () => {
  api.post.mockRejectedValue(new Error('offline'));
  const ui = render(<SupportScreen onNavigate={jest.fn()} />);
  fireEvent.changeText(ui.getByLabelText('subject'), 'Idea');
  fireEvent.changeText(ui.getByLabelText('message'), 'Texto');
  fireEvent.press(ui.getByText('feedbackSubmit'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'feedbackFailed'));
  expect(ui.getByLabelText('message').props.value).toBe('Texto');
});

test('does not confirm an unverified server response', async () => {
  api.post.mockResolvedValue({ status: 200, data: { ok: true } });
  const ui = render(<SupportScreen onNavigate={jest.fn()} />);
  fireEvent.changeText(ui.getByLabelText('subject'), 'Idea');
  fireEvent.changeText(ui.getByLabelText('message'), 'Texto');
  fireEvent.press(ui.getByText('feedbackSubmit'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'feedbackFailed'));
  expect(ui.getByLabelText('message').props.value).toBe('Texto');
});
