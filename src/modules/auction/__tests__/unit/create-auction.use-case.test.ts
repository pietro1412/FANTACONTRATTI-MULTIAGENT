/**
 * Create Auction Use Case Tests - TDD
 *
 * Tests for creating a new auction following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreateAuctionUseCase } from '../../application/use-cases/create-auction.use-case'
import type { IAuctionRepository } from '../../domain/repositories/auction.repository.interface'
import type { Auction } from '../../domain/entities/auction.entity'
import type { EventBus } from '@/shared/infrastructure/events/event-bus'

describe('CreateAuctionUseCase', () => {
  let createAuctionUseCase: CreateAuctionUseCase
  let mockAuctionRepository: IAuctionRepository
  let mockEventBus: EventBus
  let mockSessionService: {
    getSession: ReturnType<typeof vi.fn>
    isAdmin: ReturnType<typeof vi.fn>
    getTimerDuration: ReturnType<typeof vi.fn>
  }
  let mockPlayerService: {
    getPlayer: ReturnType<typeof vi.fn>
    isPlayerAvailable: ReturnType<typeof vi.fn>
  }

  const mockAuction: Auction = {
    id: 'auction-123',
    marketSessionId: 'session-456',
    playerId: 'player-789',
    startingPrice: 1,
    currentPrice: 1,
    currentWinnerId: null,
    status: 'ACTIVE',
    timerDuration: 30,
    timerExpiresAt: new Date(Date.now() + 30000),
    createdAt: new Date('2024-01-01'),
    closedAt: null,
    type: 'FREE',
  }

  const mockSession = {
    id: 'session-456',
    leagueId: 'league-001',
    status: 'ACTIVE',
    timerDuration: 30,
    currentPhase: 'ASTA_LIBERA',
  }

  const mockPlayer = {
    id: 'player-789',
    name: 'Test Player',
    position: 'D',
    team: 'Test Team',
    quotation: 10,
  }

  beforeEach(() => {
    // Create mock implementations
    mockAuctionRepository = {
      findById: vi.fn(),
      findActiveBySession: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      placeBidAtomic: vi.fn(),
      close: vi.fn(),
      cancel: vi.fn(),
      resetTimer: vi.fn(),
      updateStatus: vi.fn(),
      getBids: vi.fn(),
      getWinningBid: vi.fn(),
      createBid: vi.fn(),
      getAppeal: vi.fn(),
      createAppeal: vi.fn(),
      resolveAppeal: vi.fn(),
      getPendingAppeals: vi.fn(),
    }

    mockEventBus = {
      subscribe: vi.fn(),
      publish: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
      getHandlerCount: vi.fn(),
      getEventTypes: vi.fn(),
    } as unknown as EventBus

    mockSessionService = {
      getSession: vi.fn().mockResolvedValue(mockSession),
      isAdmin: vi.fn().mockResolvedValue(true),
      getTimerDuration: vi.fn().mockResolvedValue(30),
    }

    mockPlayerService = {
      getPlayer: vi.fn().mockResolvedValue(mockPlayer),
      isPlayerAvailable: vi.fn().mockResolvedValue(true),
    }

    /* eslint-disable @typescript-eslint/no-explicit-any -- vi.fn() partial mocks */
    createAuctionUseCase = new CreateAuctionUseCase(
      mockAuctionRepository,
      mockEventBus,
      mockSessionService as any,
      mockPlayerService as any
    )
    /* eslint-enable @typescript-eslint/no-explicit-any */
  })

  describe('execute', () => {
    // ==================== SESSION VALIDATION ====================
    it('should return failure if session not found', async () => {
      // Arrange
      mockSessionService.getSession.mockResolvedValue(null)

      // Act
      const result = await createAuctionUseCase.execute({
        sessionId: 'non-existent',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non trovata')
      }
    })

    it('should return failure if session is not active', async () => {
      // Arrange
      mockSessionService.getSession.mockResolvedValue({
        ...mockSession,
        status: 'COMPLETED',
      })

      // Act
      const result = await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('sessione')
      }
    })

    // ==================== EXISTING AUCTION CHECK ====================
    it('should return failure if there is already an active auction in session', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findActiveBySession).mockResolvedValue(mockAuction)

      // Act
      const result = await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('già un\'asta attiva')
      }
    })

    // ==================== PLAYER VALIDATION ====================
    it('should return failure if player not found', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findActiveBySession).mockResolvedValue(null)
      mockPlayerService.getPlayer.mockResolvedValue(null)

      // Act
      const result = await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'non-existent',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non trovato')
      }
    })

    it('should return failure if player is already in a roster', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findActiveBySession).mockResolvedValue(null)
      mockPlayerService.isPlayerAvailable.mockResolvedValue(false)

      // Act
      const result = await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('già in una rosa')
      }
    })

    // ==================== SUCCESSFUL CREATION ====================
    it('should successfully create auction when all validations pass', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findActiveBySession).mockResolvedValue(null)
      vi.mocked(mockAuctionRepository.create).mockResolvedValue(mockAuction)

      // Act
      const result = await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.auctionId).toBe('auction-123')
        expect(result.value.playerId).toBe('player-789')
        expect(result.value.playerName).toBe('Test Player')
        expect(result.value.startingPrice).toBe(1)
      }
    })

    it('should create auction with correct timer duration from session', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findActiveBySession).mockResolvedValue(null)
      vi.mocked(mockAuctionRepository.create).mockResolvedValue(mockAuction)

      // Act
      const result = await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      expect(mockAuctionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timerDuration: 30,
        })
      )
    })

    // ==================== DOMAIN EVENT ====================
    it('should publish AuctionCreated domain event on success', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findActiveBySession).mockResolvedValue(null)
      vi.mocked(mockAuctionRepository.create).mockResolvedValue(mockAuction)

      // Act
      await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'auction.created',
        expect.objectContaining({
          auctionId: 'auction-123',
          sessionId: 'session-456',
          playerId: 'player-789',
        })
      )
    })

    it('should not publish domain event on failure', async () => {
      // Arrange
      mockSessionService.getSession.mockResolvedValue(null)

      // Act
      await createAuctionUseCase.execute({
        sessionId: 'non-existent',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(mockEventBus.publish).not.toHaveBeenCalled()
    })

    // ==================== STARTING PRICE ====================
    it('should use provided starting price', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findActiveBySession).mockResolvedValue(null)
      vi.mocked(mockAuctionRepository.create).mockResolvedValue({
        ...mockAuction,
        startingPrice: 5,
        currentPrice: 5,
      })

      // Act
      await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'player-789',
        startingPrice: 5,
        nominatorId: 'member-123',
      })

      // Assert
      expect(mockAuctionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          startingPrice: 5,
        })
      )
    })

    // ==================== AUCTION TYPE ====================
    it('should default to FREE auction type', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findActiveBySession).mockResolvedValue(null)
      vi.mocked(mockAuctionRepository.create).mockResolvedValue(mockAuction)

      // Act
      await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
      })

      // Assert
      expect(mockAuctionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FREE',
        })
      )
    })

    it('should use provided auction type', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findActiveBySession).mockResolvedValue(null)
      vi.mocked(mockAuctionRepository.create).mockResolvedValue({
        ...mockAuction,
        type: 'RUBATA',
      })

      // Act
      await createAuctionUseCase.execute({
        sessionId: 'session-456',
        playerId: 'player-789',
        startingPrice: 1,
        nominatorId: 'member-123',
        type: 'RUBATA',
      })

      // Assert
      expect(mockAuctionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RUBATA',
        })
      )
    })
  })
})
