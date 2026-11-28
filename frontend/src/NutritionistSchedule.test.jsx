import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NutritionistSchedule from './NutritionistSchedule'
import api from './api'

vi.mock('./api', () => ({ default: { get: vi.fn(), put: vi.fn() } }))

describe('professional schedule configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: { time_zone: 'America/New_York', weekly: [], exceptions: [], legacy_count: 0 } })
    api.put.mockResolvedValue({ data: { message: 'schedule updated' } })
  })

  it('shows both occurrences and submits the selected legacy instant', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/nutritionist/schedule/legacy-times') {
        return Promise.resolve({ data: { items: [{
          kind: 'appointment', id: 10, date: '2026-11-01', time: '01:30', status: 'ambiguous',
          instants: ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z']
        }] } })
      }
      return Promise.resolve({ data: { time_zone: 'America/New_York', weekly: [], exceptions: [], legacy_count: 1 } })
    })
    render(<NutritionistSchedule />)
    fireEvent.change(await screen.findByLabelText('Zona horaria anterior'), { target: { value: 'America/New_York' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar citas antiguas' }))
    const choice = await screen.findByLabelText('Ocurrencia appointment:10')
    fireEvent.change(choice, { target: { value: '2026-11-01T06:30:00Z' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar agenda' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/nutritionist/schedule', expect.objectContaining({
      legacy_time_zone: 'America/New_York',
      legacy_instants: { 'appointment:10': '2026-11-01T06:30:00Z' }
    })))
  })

  it('requires legacy items to be previewed before saving', async () => {
    api.get.mockResolvedValue({ data: { time_zone: 'UTC', weekly: [], exceptions: [], legacy_count: 1 } })
    render(<NutritionistSchedule />)
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar agenda' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Revisa todas las citas antiguas')
    expect(api.put).not.toHaveBeenCalled()
  })
})
