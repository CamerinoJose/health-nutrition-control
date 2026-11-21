import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import GeminiChat from './GeminiChat';

vi.mock('./api', () => ({
  default: { post: vi.fn() },
}));

describe('GeminiChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('sends the prompt through the authenticated backend API', async () => {
    api.post.mockResolvedValue({ data: { text: 'Una opción es avena con fruta.' } });
    render(<GeminiChat onNavigate={vi.fn()} profile={{ name: 'Ana' }} />);

    fireEvent.change(screen.getByPlaceholderText('Pregunta a Gemini...'), {
      target: { value: '¿Qué puedo desayunar?' },
    });
    fireEvent.click(screen.getByRole('button', { name: '➤' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/gemini/chat', {
        message: '¿Qué puedo desayunar?',
        profileName: 'Ana',
      });
    });
    expect(await screen.findByText('Una opción es avena con fruta.')).toBeTruthy();
  });
});
