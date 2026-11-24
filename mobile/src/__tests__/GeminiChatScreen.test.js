import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import api from '../api';
import GeminiChatScreen from '../GeminiChatScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';

jest.mock('../api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Alert.alert = jest.fn();
  return RN;
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('sends the prompt through the authenticated backend API', async () => {
  api.post.mockResolvedValue({ data: { text: 'Una opción es avena con fruta.' } });
  render(<GeminiChatScreen onNavigate={jest.fn()} profile={{ name: 'Ana' }} />);

  fireEvent.changeText(screen.getByPlaceholderText('Pregunta a Gemini...'), '¿Qué puedo desayunar?');
  fireEvent.press(screen.getByText('➤'));

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/gemini/chat', {
      message: '¿Qué puedo desayunar?',
      profileName: 'Ana',
    });
  });
  expect(await screen.findByText('Una opción es avena con fruta.')).toBeTruthy();
});

test('shows a temporary-provider message for a 503 response', async () => {
  api.post.mockRejectedValue({ response: { status: 503 } });
  render(<GeminiChatScreen onNavigate={jest.fn()} profile={{ name: 'Ana' }} />);

  fireEvent.changeText(screen.getByPlaceholderText('Pregunta a Gemini...'), '¿Qué puedo desayunar?');
  fireEvent.press(screen.getByText('➤'));

  expect(await screen.findByText(/temporalmente ocupado/)).toBeTruthy();
});

test('restores and saves Gemini history for the active user', async () => {
  AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([{
    id: 'old',
    text: 'Respuesta anterior',
    sender: 'bot',
    timestamp: '2026-11-22T12:00:00.000Z',
  }]));
  api.post.mockResolvedValue({ data: { text: 'Nueva respuesta' } });

  render(<GeminiChatScreen onNavigate={jest.fn()} profile={{ name: 'Ana', user_id: 42 }} />);

  expect(await screen.findByText('Respuesta anterior')).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText('Pregunta a Gemini...'), 'Pregunta nueva');
  fireEvent.press(screen.getByText('➤'));
  await screen.findByText('Nueva respuesta');

  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'bienestar_gemini_history_v1:42',
    expect.any(String),
  );
});

test('copies bot response text to the clipboard', async () => {
  api.post.mockResolvedValue({ data: { text: 'Texto que quiero copiar' } });
  render(<GeminiChatScreen onNavigate={jest.fn()} profile={{ name: 'Ana', user_id: 42 }} />);

  fireEvent.changeText(screen.getByPlaceholderText('Pregunta a Gemini...'), 'Dame texto');
  fireEvent.press(screen.getByText('➤'));
  await screen.findByText('Texto que quiero copiar');

  const copyButtons = screen.getAllByLabelText('Copiar texto');
  fireEvent.press(copyButtons[copyButtons.length - 1]);
  expect(Clipboard.setString).toHaveBeenCalledWith('Texto que quiero copiar');
});
