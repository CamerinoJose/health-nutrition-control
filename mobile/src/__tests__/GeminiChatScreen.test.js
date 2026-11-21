import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import api from '../api';
import GeminiChatScreen from '../GeminiChatScreen';

jest.mock('../api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

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
