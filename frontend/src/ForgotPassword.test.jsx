import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ForgotPassword from './ForgotPassword';

describe('password recovery', () => {
  it('explains that recovery is unavailable without requesting a password', () => {
    const onBack = vi.fn();
    render(<ForgotPassword onBack={onBack} />);
    expect(screen.getByText(/recuperación de contraseña no está disponible/i)).toBeTruthy();
    expect(screen.queryByLabelText(/nueva contraseña/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /volver al inicio de sesión/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
