import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api'
import AccountDeletion from './AccountDeletion'

vi.mock('./api', () => ({
  default: { delete: vi.fn() },
}))

describe('AccountDeletion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires explicit confirmation and current password before submitting', async () => {
    api.delete.mockResolvedValue({ data: { ok: true } })
    const onDeleted = vi.fn()
    render(<AccountDeletion onDeleted={onDeleted} />)

    fireEvent.change(screen.getByLabelText('Contraseña actual (si aplica)'), {
      target: { value: 'current-password' },
    })
    fireEvent.change(screen.getByLabelText('Escribe ELIMINAR para continuar'), {
      target: { value: 'ELIMINAR' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta permanentemente' }))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/me', { data: { password: 'current-password' } })
    })
    expect(onDeleted).toHaveBeenCalledTimes(1)
  })

  it('does not report success when the server rejects identity confirmation', async () => {
    api.delete.mockRejectedValue({ response: { status: 401 } })
    const onDeleted = vi.fn()
    render(<AccountDeletion onDeleted={onDeleted} />)

    fireEvent.change(screen.getByLabelText('Escribe ELIMINAR para continuar'), {
      target: { value: 'ELIMINAR' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta permanentemente' }))

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo confirmar tu identidad')
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
