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

    fireEvent.click(screen.getByRole('checkbox', { name: 'Acepto compartir mis mensajes con Google Gemini' }));
    fireEvent.change(screen.getByPlaceholderText('Pregunta a Gemini...'), {
      target: { value: '¿Qué puedo desayunar?' },
    });
    fireEvent.click(screen.getByRole('button', { name: '➤' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/gemini/chat', {
        message: '¿Qué puedo desayunar?',
      });
    });
    expect(await screen.findByText('Una opción es avena con fruta.')).toBeTruthy();
  });

  it('submits only the selected assistant response and report reason', async () => {
    api.post
      .mockResolvedValueOnce({ data: { text: 'Una opción es avena con fruta.' } })
      .mockResolvedValueOnce({ data: { id: 8, status: 'pending' } });
    render(<GeminiChat onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Acepto compartir mis mensajes con Google Gemini' }));
    fireEvent.change(screen.getByPlaceholderText('Pregunta a Gemini...'), {
      target: { value: '¿Qué puedo desayunar?' },
    });
    fireEvent.click(screen.getByRole('button', { name: '➤' }));
    await screen.findByText('Una opción es avena con fruta.');
    fireEvent.click(screen.getByRole('button', { name: 'Reportar respuesta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenLastCalledWith('/gemini/reports', {
        responseText: 'Una opción es avena con fruta.',
        reason: 'unsafe_medical_advice',
      });
    });
    expect(await screen.findByText('Reporte enviado')).toBeTruthy();
  });
});
