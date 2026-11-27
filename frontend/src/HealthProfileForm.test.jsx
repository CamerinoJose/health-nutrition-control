

import { describe, it, expect, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import HealthProfileForm from './HealthProfileForm';
import api from './api';
import '../src/i18n';

// Mockear el módulo api para que las llamadas no fallen
vi.mock('./api', () => ({
  __esModule: true,
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn((_, data) => Promise.resolve({ data: { birth_date: data.birth_date } })),
    put: vi.fn((_, data) => Promise.resolve({ data: { birth_date: data.birth_date } })),
  },
}));


describe('HealthProfileForm', () => {
  beforeAll(() => {
    // Asegura que i18n esté en español
    // eslint-disable-next-line no-undef
    if (globalThis.i18n) globalThis.i18n.changeLanguage('es');
  });

  it('muestra errores si los campos obligatorios están vacíos o inválidos', async () => {
    const { container } = render(<HealthProfileForm onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Guardar Perfil'));
    await waitFor(() => {
      const errores = ['Selecciona una fecha de nacimiento válida', 'Campo requerido', 'Altura inválida', 'Peso inválido'];
      errores.forEach(msg => {
        const found = screen.queryByText((content) => content && content.replace(/\s+/g, ' ').includes(msg), { exact: false });
        if (!found) {
          expect(container.textContent).toContain(msg);
        } else {
          expect(found).toBeTruthy();
        }
      });
    });
  });

  it('permite guardar si los campos son válidos', async () => {
    const onSave = vi.fn();
    render(<HealthProfileForm onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento *'), { target: { value: '1995-01-01' } });
    fireEvent.change(screen.getByLabelText('Sexo *'), { target: { value: 'male' } });
    fireEvent.change(screen.getByLabelText('Altura (cm) *'), { target: { value: '170' } });
    fireEvent.change(screen.getByLabelText('Peso Actual (kg) *'), { target: { value: '70' } });
    fireEvent.click(screen.getByText('Guardar Perfil'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    expect(api.post).toHaveBeenCalledWith('/health-profile', expect.objectContaining({ birth_date: '1995-01-01' }));
  });

  it('advierte si el servidor anterior no confirma la fecha de nacimiento', async () => {
    api.post.mockResolvedValueOnce({ data: { ok: true } });
    const onSave = vi.fn();
    render(<HealthProfileForm onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento *'), { target: { value: '1995-01-01' } });
    fireEvent.change(screen.getByLabelText('Sexo *'), { target: { value: 'male' } });
    fireEvent.change(screen.getByLabelText('Altura (cm) *'), { target: { value: '170' } });
    fireEvent.change(screen.getByLabelText('Peso Actual (kg) *'), { target: { value: '70' } });
    fireEvent.click(screen.getByText('Guardar Perfil'));
    await waitFor(() => expect(screen.getByText(/El servidor no confirmó la fecha/)).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });
});
