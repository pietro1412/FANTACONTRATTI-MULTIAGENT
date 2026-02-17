/**
 * Close Auction Use Case Tests - TDD
 *
 * Tests for closing an auction following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CloseAuctionUseCase } from '../../application/use-cases/close-auction.use-case'
import type { IAuctionRepository } from '../../domain/repositories/auction.repository.interface'
import type { Auction } from '../../domain/entities/auction.entity'
import type { AuctionBid } from '../../domain/entities/bid.entity'
import type { EventBus } from '@/shared/infrastructure/events/event-bus'

describe('CloseAuctionUseCase', () => {
  let closeAuctionUseCase: CloseAuctionUseCase
  let mockAuctionRepository: IAuctionRepository
  let mockEventBus: EventBus
  let mockRosterService: {
    awardPlayer: ReturnType<typeof vi.fn>
    deductBudget: ReturnType<typeof vi.fn>
  }
  let mockPlayerService: {
    getPlayer: ReturnType<typeof vi.fn>
  }
  let mockMemberService: {
    getMemberName: ReturnType<typeof vi.fn>
  }

  const mockAuction: Auction = {
    id: 'auction-123',
    marketSessionId: 'session-456',
    playerId: 'player-789',
    startingPrice: 1,
    currentPrice: 15,
    currentWinnerId: 'member-winner',
    status: 'ACTIVE',
    timerDuration: 30,
    timerExpiresAt: new Date(Date.now() + 30000),
    createdAt: new Date('2024-01-01'),
    closedAt: null,
    type: 'FREE',
  }

  const mockWinningBid: AuctionBid = {
    id: 'bid-winner',
    auctionId: 'auction-123',
    bidderId: 'member-winner',
    amount: 15,
    placedAt: new Date(),
    isWinning: true,
  }

  const mockPlayer = {
    id: 'player-789',
    name: 'Test Player',
    position: 'D',
    team: 'Test Team',
  }

  beforeEach(() => {
    // Create mock implementations
    mockAuctionRepository = {
      findById: vi.fn(),
      findActiveBySession: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      placeBidAtomic: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
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

    mockRosterService = {
      awardPlayer: vi.fn().mockResolvedValue(undefined),
      deductBudget: vi.fn().mockResolvedValue(undefined),
    }

    mockPlayerService = {
      getPlayer: vi.fn().mockResolvedValue(mockPlayer),
    }

    mockMemberService = {
      getMemberName: vi.fn().mockResolvedValue('Winner User'),
    }

    closeAuctionUseCase = new CloseAuctionUseCase(
      mockAuctionRepository,
      mockEventBus,
      mockRosterService,
      mockPlayerService,
      mockMemberService
    )
  })

  describe('execute', () => {
    // ==================== AUCTION NOT FOUND ====================
    it('should return failure if auction not found', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(null)

      // Act
      const result = await closeAuctionUseCase.execute({
        auctionId: 'non-existent',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non trovata')
      }
    })

    // ==================== AUCTION NOT ACTIVE ====================
    it('should return failure if auction is not active', async () => {
      // Arrange
      const closedAuction = { ...mockAuction, status: 'CLOSED' as const }
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(closedAuction)

      // Act
      const result = await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('chiusa')
      }
    })

    // ==================== SUCCESSFUL CLOSE WITH WINNER ====================
    it('should successfully close auction with winner', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(mockWinningBid)

      // Act
      const result = await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.success).toBe(true)
        expect(result.value.winnerId).toBe('member-winner')
        expect(result.value.winnerName).toBe('Winner User')
        expect(result.value.finalAmount).toBe(15)
        expect(result.value.wasAcquired).toBe(true)
      }
    })

    // ==================== CLOSE WITH NO BIDS ====================
    it('should close auction as unsold when there are no bids', async () => {
      // Arrange
      const auctionNoBids = { ...mockAuction, currentWinnerId: null, currentPrice: 1 }
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(auctionNoBids)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(null)

      // Act
      const result = await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.winnerId).toBeNull()
        expect(result.value.winnerName).toBeNull()
        expect(result.value.finalAmount).toBe(0)
        expect(result.value.wasAcquired).toBe(false)
      }
    })

    // ==================== AWARD PLAYER TO WINNER ====================
    it('should award player to winner via roster service', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(mockWinningBid)

      // Act
      await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(mockRosterService.awardPlayer).toHaveBeenCalledWith(
        'member-winner',
        'player-789',
        15
      )
    })

    it('should not award player when there is no winner', async () => {
      // Arrange
      const auctionNoBids = { ...mockAuction, currentWinnerId: null }
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(auctionNoBids)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(null)

      // Act
      await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(mockRosterService.awardPlayer).not.toHaveBeenCalled()
    })

    // ==================== DEDUCT BUDGET FROM WINNER ====================
    it('should deduct budget from winner', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(mockWinningBid)

      // Act
      await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(mockRosterService.deductBudget).toHaveBeenCalledWith(
        'member-winner',
        15
      )
    })

    it('should not deduct budget when there is no winner', async () => {
      // Arrange
      const auctionNoBids = { ...mockAuction, currentWinnerId: null }
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(auctionNoBids)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(null)

      // Act
      await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(mockRosterService.deductBudget).not.toHaveBeenCalled()
    })

    // ==================== UPDATE AUCTION STATUS ====================
    it('should call repository close method with correct params', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(mockWinningBid)

      // Act
      await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(mockAuctionRepository.close).toHaveBeenCalledWith(
        'auction-123',
        'member-winner',
        15
      )
    })

    it('should close with null winner when no bids', async () => {
      // Arrange
      const auctionNoBids = { ...mockAuction, currentWinnerId: null }
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(auctionNoBids)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(null)

      // Act
      await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(mockAuctionRepository.close).toHaveBeenCalledWith(
        'auction-123',
        null,
        0
      )
    })

    // ==================== DOMAIN EVENT ====================
    it('should publish AuctionClosed domain event on success', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(mockWinningBid)

      // Act
      await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'auction.closed',
        expect.objectContaining({
          auctionId: 'auction-123',
          winnerId: 'member-winner',
          finalAmount: 15,
        })
      )
    })

    it('should publish AuctionClosed event with null winner when unsold', async () => {
      // Arrange
      const auctionNoBids = { ...mockAuction, currentWinnerId: null }
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(auctionNoBids)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(null)

      // Act
      await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'auction.closed',
        expect.objectContaining({
          auctionId: 'auction-123',
          winnerId: null,
          finalAmount: 0,
        })
      )
    })

    it('should not publish domain event on failure', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(null)

      // Act
      await closeAuctionUseCase.execute({
        auctionId: 'non-existent',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(mockEventBus.publish).not.toHaveBeenCalled()
    })

    // ==================== PLAYER INFO IN RESULT ====================
    it('should include player info in result', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      vi.mocked(mockAuctionRepository.getWinningBid).mockResolvedValue(mockWinningBid)

      // Act
      const result = await closeAuctionUseCase.execute({
        auctionId: 'auction-123',
        adminUserId: 'admin-123',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.playerId).toBe('player-789')
        expect(result.value.playerName).toBe('Test Player')
      }
    })
  })
})
