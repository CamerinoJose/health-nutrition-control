import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Support from './Support';
import api from './api';

vi.mock('./api', () => ({ default: { post: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));

describe('Support feedback', () => {
  beforeEach(() => vi.resetAllMocks());

  it('only confirms and clears feedback after the server saves it', async () => {
    api.post.mockResolvedValue({ status: 201, data: { id: 1, status: 'pending' } });
    render(<Support />);
    fireEvent.change(screen.getByLabelText('subject'), { target: { value: ' Idea ' } });
    fireEvent.change(screen.getByLabelText('message'), { target: { value: ' Comentario ' } });
    fireEvent.click(screen.getByRole('button', { name: 'feedbackSubmit' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/feedback', { subject: 'Idea', message: 'Comentario' }));
    expect(await screen.findByText('feedbackSent')).toBeTruthy();
    expect(screen.getByLabelText('message').value).toBe('');
  });

  it('preserves the comment and shows an error when sending fails', async () => {
    api.post.mockRejectedValue(new Error('offline'));
    render(<Support />);
    fireEvent.change(screen.getByLabelText('subject'), { target: { value: 'Idea' } });
    fireEvent.change(screen.getByLabelText('message'), { target: { value: 'Texto' } });
    fireEvent.click(screen.getByRole('button', { name: 'feedbackSubmit' }));
    expect((await screen.findByRole('alert')).textContent).toBe('feedbackFailed');
    expect(screen.getByLabelText('message').value).toBe('Texto');
    expect(screen.queryByText('feedbackSent')).toBeNull();
  });

  it('does not confirm an unverified server response', async () => {
    api.post.mockResolvedValue({ status: 200, data: { ok: true } });
    render(<Support />);
    fireEvent.change(screen.getByLabelText('subject'), { target: { value: 'Idea' } });
    fireEvent.change(screen.getByLabelText('message'), { target: { value: 'Texto' } });
    fireEvent.click(screen.getByRole('button', { name: 'feedbackSubmit' }));
    expect((await screen.findByRole('alert')).textContent).toBe('feedbackFailed');
    expect(screen.getByLabelText('message').value).toBe('Texto');
  });
});
