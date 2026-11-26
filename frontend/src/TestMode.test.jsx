import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import TestMode from './TestMode'

describe('TestMode', () => {
  test('renders cases and stores an approved result', async () => {
    localStorage.clear()
    render(<TestMode profile={{ user_id: 42 }} />)
    const caseButtons = screen.getAllByText('Registrar una cuenta nueva')
    fireEvent.click(caseButtons[0])
    fireEvent.click(screen.getByText('Aprobado'))
    await waitFor(() => {
      const raw = localStorage.getItem('bienestar_test_results_v1:42')
      expect(raw).toBeTruthy()
      expect(JSON.parse(raw)[0].status).toBe('approved')
    })
  })
})
