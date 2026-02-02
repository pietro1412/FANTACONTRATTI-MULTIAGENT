/**
 * Unit tests for ExecutePlanModal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExecutePlanModal } from '../../src/components/ExecutePlanModal'

describe('ExecutePlanModal', () => {
  const mockPlayers = [
    {
      id: 'player-1',
      name: 'Player One',
      position: 'C',
      team: 'Team A',
      maxBid: 20,
      type: 'owned' as const,
      ownerTeam: 'Owner Team',
    },
    {
      id: 'player-2',
      name: 'Player Two',
      position: 'A',
      team: 'Team B',
      maxBid: 30,
      type: 'svincolato' as const,
      ownerTeam: 'Svincolato',
    },
  ]

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    players: mockPlayers,
    totalBudget: 50,
    availableBudget: 100,
    onPayClause: vi.fn().mockResolvedValue({ success: true }),
    onComplete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ExecutePlanModal {...defaultProps} isOpen={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders modal with player list when open', () => {
    render(<ExecutePlanModal {...defaultProps} />)

    expect(screen.getByText('Esegui Piano Clausole')).toBeDefined()
    expect(screen.getByText('Player One')).toBeDefined()
    expect(screen.getByText('Player Two')).toBeDefined()
  })

  it('displays total budget and available budget', () => {
    render(<ExecutePlanModal {...defaultProps} />)

    expect(screen.getByText('100M')).toBeDefined() // Available budget
    expect(screen.getByText('-50M')).toBeDefined() // Total clauses
  })

  it('shows budget warning when insufficient', () => {
    render(
      <ExecutePlanModal
        {...defaultProps}
        totalBudget={150}
        availableBudget={100}
      />
    )

    expect(screen.getByText(/Budget insufficiente/)).toBeDefined()
  })

  it('disables execute button when budget insufficient', () => {
    render(
      <ExecutePlanModal
        {...defaultProps}
        totalBudget={150}
        availableBudget={100}
      />
    )

    const executeButton = screen.getByText(/Paga 2 Clausole/)
    expect(executeButton.closest('button')).toHaveProperty('disabled', true)
  })

  it('calls onPayClause for each player when executing', async () => {
    const onPayClause = vi.fn().mockResolvedValue({ success: true })
    render(<ExecutePlanModal {...defaultProps} onPayClause={onPayClause} />)

    const executeButton = screen.getByText(/Paga 2 Clausole/)
    fireEvent.click(executeButton)

    await waitFor(() => {
      expect(onPayClause).toHaveBeenCalledTimes(2)
    })

    expect(onPayClause).toHaveBeenCalledWith('player-1', 'owned')
    expect(onPayClause).toHaveBeenCalledWith('player-2', 'svincolato')
  })

  it('shows success status after successful execution', async () => {
    render(<ExecutePlanModal {...defaultProps} />)

    const executeButton = screen.getByText(/Paga 2 Clausole/)
    fireEvent.click(executeButton)

    await waitFor(() => {
      expect(screen.getByText('Esecuzione Completata')).toBeDefined()
    }, { timeout: 5000 })

    expect(screen.getByText(/2 clausole pagate, 0 errori/)).toBeDefined()
  })

  it('shows error status when execution fails', async () => {
    const onPayClause = vi.fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, message: 'Errore test' })

    render(<ExecutePlanModal {...defaultProps} onPayClause={onPayClause} />)

    const executeButton = screen.getByText(/Paga 2 Clausole/)
    fireEvent.click(executeButton)

    await waitFor(() => {
      expect(screen.getByText('Esecuzione Completata')).toBeDefined()
    }, { timeout: 5000 })

    expect(screen.getByText(/1 clausole pagate, 1 errori/)).toBeDefined()
    expect(screen.getByText('Errore test')).toBeDefined()
  })

  it('calls onClose when cancel button is clicked', () => {
    render(<ExecutePlanModal {...defaultProps} />)

    const cancelButton = screen.getByText('Annulla')
    fireEvent.click(cancelButton)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('calls onComplete when closing after execution', async () => {
    render(<ExecutePlanModal {...defaultProps} />)

    const executeButton = screen.getByText(/Paga 2 Clausole/)
    fireEvent.click(executeButton)

    await waitFor(() => {
      expect(screen.getByText('Esecuzione Completata')).toBeDefined()
    }, { timeout: 5000 })

    const closeButton = screen.getByText('Chiudi')
    fireEvent.click(closeButton)

    expect(defaultProps.onComplete).toHaveBeenCalled()
  })

  it('prevents closing during execution', async () => {
    // Make execution take longer
    const slowPayClause = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
    )

    render(<ExecutePlanModal {...defaultProps} onPayClause={slowPayClause} />)

    const executeButton = screen.getByText(/Paga 2 Clausole/)
    fireEvent.click(executeButton)

    // During execution, cancel button should be disabled
    await waitFor(() => {
      const cancelButton = screen.getByText('Annulla')
      expect(cancelButton.closest('button')).toHaveProperty('disabled', true)
    })
  })

  it('shows player positions with correct colors', () => {
    render(<ExecutePlanModal {...defaultProps} />)

    // Check that position badges are rendered
    const positionBadges = document.querySelectorAll('.rounded-full')
    expect(positionBadges.length).toBeGreaterThan(0)
  })

  it('displays player team and owner info', () => {
    render(<ExecutePlanModal {...defaultProps} />)

    expect(screen.getByText(/Team A/)).toBeDefined()
    expect(screen.getByText(/Owner Team/)).toBeDefined()
  })
})
