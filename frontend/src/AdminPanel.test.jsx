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

  it('shows feedback in order and updates its status', async () => {
    let status = 'pending'
    api.get.mockImplementation(async (path) => {
      if (path === '/admin/metrics') return { data: {} }
      if (path === '/admin/users') return { data: [] }
      if (path === '/admin/feedback?view=active&after_id=0') return {
        data: { items: [
          { id: 1, subject: 'Primero', message: 'Uno', status, created_at: '2026-01-01T10:00:00Z' },
          { id: 2, subject: 'Segundo', message: 'Dos', status: 'pending', created_at: '2026-01-02T10:00:00Z' },
        ], next_after_id: 0 },
      }
      throw new Error(`Unexpected API path: ${path}`)
    })
    api.put.mockImplementation(async (_path, payload) => { status = payload.status })
    render(<AdminPanel token="admin-token" />)
    fireEvent.click(await screen.findByRole('button', { name: 'feedbackQueue' }))
    const first = await screen.findByText('Primero')
    const second = screen.getByText('Segundo')
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'feedbackStart' })[0])
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/feedback/1', { status: 'in_progress' }))
    expect(await screen.findByText('feedbackProgressStatus')).toBeTruthy()
  })

  it('loads additional feedback and reopens completed feedback', async () => {
    api.get.mockImplementation(async (path) => {
      if (path === '/admin/metrics') return { data: {} }
      if (path === '/admin/users') return { data: [] }
      if (path === '/admin/feedback?view=active&after_id=0') return {
        data: { items: [{ id: 1, subject: 'Primero', message: 'Uno', status: 'pending', created_at: '2026-01-01T10:00:00Z' }], next_after_id: 1 },
      }
      if (path === '/admin/feedback?view=active&after_id=1') return {
        data: { items: [{ id: 2, subject: 'Siguiente', message: 'Dos', status: 'pending', created_at: '2026-01-02T10:00:00Z' }], next_after_id: 0 },
      }
      if (path === '/admin/feedback?view=resolved&after_id=0') return {
        data: { items: [{ id: 3, subject: 'Completado', message: 'Tres', status: 'resolved', created_at: '2026-01-03T10:00:00Z' }], next_after_id: 0 },
      }
      throw new Error(`Unexpected API path: ${path}`)
    })
    api.put.mockResolvedValue({ data: { ok: true } })
    render(<AdminPanel token="admin-token" />)
    fireEvent.click(await screen.findByRole('button', { name: 'feedbackQueue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'feedbackMore' }))
    expect(await screen.findByText('Siguiente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'feedbackResolved' }))
    fireEvent.click(await screen.findByRole('button', { name: 'feedbackReopen' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/feedback/3', { status: 'in_progress' }))
  })
})
