import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api'
import AdminPanel from './AdminPanel'

vi.mock('./api', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

describe('AdminPanel Gemini reports', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the private report queue and updates a report status', async () => {
    let reportStatus = 'pending'
    api.get.mockImplementation(async (path) => {
      if (path === '/admin/metrics') {
        return { data: { can_view_individual_data: 0 } }
      }
      if (path === '/admin/users') return { data: [] }
      if (path === '/admin/gemini-reports') {
        return {
          data: [{
            id: 8,
            response_text: 'Respuesta reportada',
            reason: 'privacy',
            status: reportStatus,
            created_at: '2026-01-01T10:00:00Z',
          }],
        }
      }
      throw new Error(`Unexpected API path: ${path}`)
    })
    api.put.mockImplementation(async (_path, payload) => {
      reportStatus = payload.status
      return { data: { ok: true, status: payload.status } }
    })

    render(<AdminPanel token="admin-token" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reportes de Gemini' }))
    expect((await screen.findAllByText('Respuesta reportada')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Marcar revisado' }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/gemini-reports/8', { status: 'reviewed' })
    })
    await waitFor(() => {
      expect(screen.getByText('reviewed')).toBeTruthy()
    })
  })
})
