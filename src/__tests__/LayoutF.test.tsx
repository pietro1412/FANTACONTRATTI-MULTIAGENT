/**
 * LayoutF.test.tsx - Unit Tests for LayoutF Component
 *
 * Tests for the Pro auction layout.
 *
 * Creato il: 25/01/2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the objectives hook
vi.mock('../modules/auction/presentation/hooks/useAuctionObjectives', () => ({
  useAuctionObjectives: () => ({
    objectives: [],
    summary: { active: 0, acquired: 0, missed: 0, removed: 0, total: 0 },
    isLoading: false,
    error: null,
    createObjective: vi.fn(),
    deleteObjective: vi.fn(),
    isPlayerObjective: () => false,
    getPlayerObjective: () => undefined
  })
}))

// Mock team logos
vi.mock('../../utils/teamLogos', () => ({
  getTeamLogo: () => '/placeholder.png'
}))

import { LayoutF } from '../components/auction/LayoutF'

// Base props for testing
const baseProps = {
  auction: null,
  timeLeft: 30,
  timerSetting: 30,
  isTimerExpired: false,
  membership: { currentBudget: 500 },
  isAdmin: false,
  isMyTurn: false,
  isUserWinning: false,
  currentUsername: 'testuser',
  managersStatus: {
    myId: 'member-1',
    managers: [
      { id: 'member-1', username: 'testuser', isCurrentTurn: false, isConnected: true, currentBudget: 500, slotsByPosition: { P: { filled: 0, total: 3 }, D: { filled: 0, total: 8 }, C: { filled: 0, total: 8 }, A: { filled: 0, total: 6 } } }
    ]
  },
  currentTurnManager: null,
  myRosterSlots: {
    currentRole: 'A',
    slots: {
      P: { filled: 0, total: 3 },
      D: { filled: 0, total: 8 },
      C: { filled: 0, total: 8 },
      A: { filled: 0, total: 6 }
    }
  },
  marketProgress: null,
  bidAmount: '10',
  setBidAmount: vi.fn(),
  onPlaceBid: vi.fn(),
  isConnected: true,
  connectionStatus: 'connected',
  onSelectManager: vi.fn(),
  onCloseAuction: vi.fn(),
  sessionId: 'session-1',
  readyStatus: null,
  onMarkReady: vi.fn(),
  markingReady: false,
  pendingAck: null,
  onAcknowledge: vi.fn(),
  ackSubmitting: false
}

describe('LayoutF Component', () => {
  describe('Waiting State', () => {
    it('renders waiting message when no auction and no pending nomination', () => {
      render(<LayoutF {...baseProps} />)

      expect(screen.getByText('In attesa della prossima nomination')).toBeInTheDocument()
    })

    it('shows current turn manager', () => {
      render(
        <LayoutF
          {...baseProps}
          currentTurnManager={{ username: 'mario', id: 'member-2' }}
        />
      )

      expect(screen.getByText(/Turno di:/)).toBeInTheDocument()
      expect(screen.getByText('mario')).toBeInTheDocument()
    })

    it('shows my turn indicator when it is my turn', () => {
      render(<LayoutF {...baseProps} isMyTurn={true} />)

      expect(screen.getByText('È il tuo turno!')).toBeInTheDocument()
    })
  })

  describe('Ready Check State', () => {
    it('renders ready check UI when there is a pending nomination', () => {
      const readyStatus = {
        hasPendingNomination: true,
        nominatorConfirmed: true,
        player: { name: 'Leao', position: 'A', team: 'Milan' },
        nominatorUsername: 'mario',
        readyMembers: [{ id: 'm1', username: 'luigi' }],
        pendingMembers: [{ id: 'm2', username: 'peach' }],
        totalMembers: 3,
        readyCount: 1,
        userIsReady: false,
        userIsNominator: false
      }

      render(<LayoutF {...baseProps} readyStatus={readyStatus} />)

      expect(screen.getByText('READY CHECK')).toBeInTheDocument()
      expect(screen.getByText('Leao')).toBeInTheDocument()
      expect(screen.getByText('Milan')).toBeInTheDocument()
    })

    it('shows ready button when not ready', () => {
      const readyStatus = {
        hasPendingNomination: true,
        nominatorConfirmed: true,
        player: { name: 'Leao', position: 'A', team: 'Milan' },
        nominatorUsername: 'mario',
        readyMembers: [],
        pendingMembers: [{ id: 'm1', username: 'testuser' }],
        totalMembers: 2,
        readyCount: 0,
        userIsReady: false,
        userIsNominator: false
      }

      render(<LayoutF {...baseProps} readyStatus={readyStatus} />)

      expect(screen.getByRole('button', { name: 'SONO PRONTO' })).toBeInTheDocument()
    })

    it('calls onMarkReady when button is clicked', () => {
      const onMarkReady = vi.fn()
      const readyStatus = {
        hasPendingNomination: true,
        nominatorConfirmed: true,
        player: { name: 'Leao', position: 'A', team: 'Milan' },
        nominatorUsername: 'mario',
        readyMembers: [],
        pendingMembers: [{ id: 'm1', username: 'testuser' }],
        totalMembers: 2,
        readyCount: 0,
        userIsReady: false,
        userIsNominator: false
      }

      render(<LayoutF {...baseProps} readyStatus={readyStatus} onMarkReady={onMarkReady} />)

      fireEvent.click(screen.getByRole('button', { name: 'SONO PRONTO' }))
      expect(onMarkReady).toHaveBeenCalled()
    })

    it('shows confirmation when user is ready', () => {
      const readyStatus = {
        hasPendingNomination: true,
        nominatorConfirmed: true,
        player: { name: 'Leao', position: 'A', team: 'Milan' },
        nominatorUsername: 'mario',
        readyMembers: [{ id: 'm1', username: 'testuser' }],
        pendingMembers: [],
        totalMembers: 1,
        readyCount: 1,
        userIsReady: true,
        userIsNominator: false
      }

      render(<LayoutF {...baseProps} readyStatus={readyStatus} />)

      expect(screen.getByText(/Sei pronto/)).toBeInTheDocument()
    })
  })

  describe('Pending Acknowledgment State', () => {
    it('renders acknowledgment UI when there is a pending ack', () => {
      const pendingAck = {
        player: { name: 'Leao', position: 'A', team: 'Milan' },
        winner: { username: 'mario' },
        finalPrice: 25,
        userAcknowledged: false,
        acknowledgedMembers: [],
        pendingMembers: [{ id: 'm1', username: 'testuser' }],
        totalMembers: 2,
        totalAcknowledged: 0
      }

      render(<LayoutF {...baseProps} pendingAck={pendingAck} />)

      expect(screen.getByText('ASTA CONCLUSA')).toBeInTheDocument()
      expect(screen.getByText('Leao')).toBeInTheDocument()
      expect(screen.getByText('mario')).toBeInTheDocument()
      expect(screen.getByText('25')).toBeInTheDocument()
    })

    it('shows confirm button when not acknowledged', () => {
      const pendingAck = {
        player: { name: 'Leao', position: 'A', team: 'Milan' },
        winner: { username: 'mario' },
        finalPrice: 25,
        userAcknowledged: false,
        acknowledgedMembers: [],
        pendingMembers: [{ id: 'm1', username: 'testuser' }],
        totalMembers: 2,
        totalAcknowledged: 0
      }

      render(<LayoutF {...baseProps} pendingAck={pendingAck} />)

      expect(screen.getByRole('button', { name: 'CONFERMA' })).toBeInTheDocument()
    })

    it('calls onAcknowledge when confirm button is clicked', () => {
      const onAcknowledge = vi.fn()
      const pendingAck = {
        player: { name: 'Leao', position: 'A', team: 'Milan' },
        winner: { username: 'mario' },
        finalPrice: 25,
        userAcknowledged: false,
        acknowledgedMembers: [],
        pendingMembers: [{ id: 'm1', username: 'testuser' }],
        totalMembers: 2,
        totalAcknowledged: 0
      }

      render(<LayoutF {...baseProps} pendingAck={pendingAck} onAcknowledge={onAcknowledge} />)

      fireEvent.click(screen.getByRole('button', { name: 'CONFERMA' }))
      expect(onAcknowledge).toHaveBeenCalled()
    })

    it('shows unsold message when no winner', () => {
      const pendingAck = {
        player: { name: 'Leao', position: 'A', team: 'Milan' },
        winner: null,
        finalPrice: 1,
        userAcknowledged: false,
        acknowledgedMembers: [],
        pendingMembers: [{ id: 'm1', username: 'testuser' }],
        totalMembers: 2,
        totalAcknowledged: 0
      }

      render(<LayoutF {...baseProps} pendingAck={pendingAck} />)

      expect(screen.getByText('Nessuna offerta - Invenduto')).toBeInTheDocument()
    })
  })

  describe('Active Auction State', () => {
    const auctionData = {
      id: 'auction-1',
      player: {
        id: 'player-1',
        name: 'Leao',
        team: 'Milan',
        position: 'A',
        quotation: 30
      },
      basePrice: 1,
      currentPrice: 15,
      bids: [
        {
          id: 'bid-1',
          amount: 15,
          placedAt: new Date().toISOString(),
          bidder: { user: { username: 'mario' } }
        }
      ]
    }

    it('renders auction info correctly', () => {
      render(<LayoutF {...baseProps} auction={auctionData as any} />)

      expect(screen.getByText('Leao')).toBeInTheDocument()
      expect(screen.getAllByText('Milan').length).toBeGreaterThan(0)
      expect(screen.getAllByText('15').length).toBeGreaterThan(0) // Current price appears in multiple places
    })

    it('shows player tier based on quotation', () => {
      render(<LayoutF {...baseProps} auction={auctionData as any} />)

      // Tier A appears multiple times (position and tier badge)
      expect(screen.getAllByText('A').length).toBeGreaterThan(0)
    })

    it('shows timer', () => {
      render(<LayoutF {...baseProps} auction={auctionData as any} timeLeft={20} />)

      expect(screen.getByText('20')).toBeInTheDocument()
    })

    it('shows budget', () => {
      render(<LayoutF {...baseProps} auction={auctionData as any} />)

      // Budget appears in header and manager table
      expect(screen.getAllByText('500').length).toBeGreaterThan(0)
    })

    it('shows bid history', () => {
      render(<LayoutF {...baseProps} auction={auctionData as any} />)

      expect(screen.getByText('Offerte')).toBeInTheDocument()
      // mario appears in multiple places (current bid info and bid history)
      expect(screen.getAllByText(/mario/).length).toBeGreaterThan(0)
    })

    it('shows managers table', () => {
      render(<LayoutF {...baseProps} auction={auctionData as any} />)

      expect(screen.getByText('Manager')).toBeInTheDocument()
    })

    it('shows slot status', () => {
      render(<LayoutF {...baseProps} auction={auctionData as any} />)

      expect(screen.getByText('Rosa')).toBeInTheDocument()
    })

    it('disables bid when slot is full', () => {
      const fullSlots = {
        currentRole: 'A',
        slots: {
          P: { filled: 3, total: 3 },
          D: { filled: 8, total: 8 },
          C: { filled: 8, total: 8 },
          A: { filled: 6, total: 6 } // Full
        }
      }

      render(
        <LayoutF
          {...baseProps}
          auction={auctionData as any}
          myRosterSlots={fullSlots as any}
        />
      )

      expect(screen.getByText('completo')).toBeInTheDocument()
    })
  })

  describe('Objectives Panel', () => {
    it('renders objectives toggle when sessionId is provided', () => {
      const auctionData = {
        id: 'auction-1',
        player: {
          id: 'player-1',
          name: 'Leao',
          team: 'Milan',
          position: 'A',
          quotation: 30
        },
        basePrice: 1,
        currentPrice: 15,
        bids: []
      }

      render(<LayoutF {...baseProps} auction={auctionData as any} sessionId="session-1" />)

      expect(screen.getByText('Obiettivi')).toBeInTheDocument()
    })

    it('expands objectives panel on click', () => {
      const auctionData = {
        id: 'auction-1',
        player: {
          id: 'player-1',
          name: 'Leao',
          team: 'Milan',
          position: 'A',
          quotation: 30
        },
        basePrice: 1,
        currentPrice: 15,
        bids: []
      }

      render(<LayoutF {...baseProps} auction={auctionData as any} sessionId="session-1" />)

      const button = screen.getByText('Obiettivi').closest('button')
      if (button) {
        fireEvent.click(button)
      }

      // Should show empty state since mock returns empty objectives
      expect(screen.getByText('Nessun obiettivo attivo')).toBeInTheDocument()
    })
  })
})
