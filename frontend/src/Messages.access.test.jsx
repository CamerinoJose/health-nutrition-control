import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Messages from './Messages';
import api from './api';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('./api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: [],
      headers: { 'x-restricted-legacy-messages': 'true' },
    }),
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

describe('Messages', () => {
  it('warns when older messages are restricted', async () => {
    render(<Messages profile={{ id: 1 }} />);
    expect(await screen.findByText('restrictedLegacyMessages')).toBeTruthy();
  });

  it('uses the configured support account instead of a fixed ID', async () => {
    api.get.mockImplementation(path => Promise.resolve(path === '/support'
      ? { data: { id: 17, name: 'Support' } }
      : { data: [], headers: {} }));
    render(<Messages profile={{ id: 1 }} />);
    fireEvent.click(await screen.findByRole('button', { name: /supportChat/ }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/messages?user_id=17'));
  });
});
