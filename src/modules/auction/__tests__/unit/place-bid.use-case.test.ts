/**
 * Place Bid Use Case Tests - TDD
 *
 * Tests for the place bid use case following TDD principles.
 * This is CRITICAL for real-time auction performance.
 *
 * Focus areas:
 * - Race condition prevention (concurrent bids)
 * - Budget validation
 * - Timer reset logic
 * - Outbid detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PlaceBidUseCase } from '../../application/use-cases/place-bid.use-case'
import type { IAuctionRepository, PlaceBidResult } from '../../domain/repositories/auction.repository.interface'
import type { Auction } from '../../domain/entities/auction.entity'
import type { AuctionBid } from '../../domain/entities/bid.entity'
import type { EventBus } from '@/shared/infrastructure/events/event-bus'

describe('PlaceBidUseCase', () => {
  let placeBidUseCase: PlaceBidUseCase
  let mockAuctionRepository: IAuctionRepository
  let mockEventBus: EventBus
  let mockBudgetService: { getBudget: ReturnType<typeof vi.fn>; hasSlotAvailable: ReturnType<typeof vi.fn> }

  const mockAuction: Auction = {
    id: 'auction-123',
    marketSessionId: 'session-456',
    playerId: 'player-789',
    startingPrice: 1,
    currentPrice: 10,
    currentWinnerId: 'member-old',
    status: 'ACTIVE',
    timerDuration: 30,
    timerExpiresAt: new Date(Date.now() + 30000),
    createdAt: new Date('2024-01-01'),
    closedAt: null,
    type: 'FREE',
  }

  const mockBid: AuctionBid = {
    id: 'bid-new',
    auctionId: 'auction-123',
    bidderId: 'member-new',
    amount: 15,
    placedAt: new Date(),
    isWinning: true,
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

    mockBudgetService = {
      getBudget: vi.fn().mockResolvedValue(100),
      hasSlotAvailable: vi.fn().mockResolvedValue(true),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.fn() partial mock
    placeBidUseCase = new PlaceBidUseCase(
      mockAuctionRepository,
      mockEventBus,
      mockBudgetService as any
    )
  })

  describe('execute', () => {
    // ==================== AUCTION NOT FOUND ====================
    it('should return failure if auction not found', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(null)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'non-existent',
        bidderId: 'member-123',
        amount: 15,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non trovata')
      }
      expect(mockAuctionRepository.findById).toHaveBeenCalledWith('non-existent')
    })

    // ==================== AUCTION NOT ACTIVE ====================
    it('should return failure if auction not active', async () => {
      // Arrange
      const closedAuction = { ...mockAuction, status: 'CLOSED' as const }
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(closedAuction)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-123',
        amount: 15,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('chiusa')
      }
    })

    // ==================== BID TOO LOW ====================
    it('should return failure if bid amount <= current price', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-123',
        amount: 10, // Equal to current price
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('minima')
      }
    })

    it('should return failure if bid amount is less than current price', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-123',
        amount: 5, // Less than current price
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('minima')
      }
    })

    // ==================== INSUFFICIENT BUDGET ====================
    it('should return failure if bidder has insufficient budget', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      mockBudgetService.getBudget.mockResolvedValue(10) // Budget is 10, trying to bid 15

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-123',
        amount: 15,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Budget insufficiente')
      }
      expect(mockBudgetService.getBudget).toHaveBeenCalledWith('member-123')
    })

    // ==================== NO SLOT AVAILABLE ====================
    it('should return failure if bidder has no slot available for player position', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      mockBudgetService.hasSlotAvailable.mockResolvedValue(false)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-123',
        amount: 15,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('limite')
      }
      expect(mockBudgetService.hasSlotAvailable).toHaveBeenCalled()
    })

    // ==================== SUCCESSFUL BID ====================
    it('should successfully place a bid when all validations pass', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      const placeBidResult: PlaceBidResult = {
        success: true,
        bid: mockBid,
        previousWinnerId: 'member-old',
      }
      vi.mocked(mockAuctionRepository.placeBidAtomic).mockResolvedValue(placeBidResult)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-new',
        amount: 15,
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.success).toBe(true)
        expect(result.value.currentPrice).toBe(15)
        expect(result.value.outbid).toBe(true) // There was a previous winner
        expect(result.value.previousWinnerId).toBe('member-old')
      }
    })

    // ==================== ATOMIC TRANSACTION ====================
    it('should use atomic transaction (SELECT FOR UPDATE) to prevent race conditions', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      const placeBidResult: PlaceBidResult = {
        success: true,
        bid: mockBid,
        previousWinnerId: 'member-old',
      }
      vi.mocked(mockAuctionRepository.placeBidAtomic).mockResolvedValue(placeBidResult)

      // Act
      await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-new',
        amount: 15,
      })

      // Assert - verify atomic operation was called with correct params
      expect(mockAuctionRepository.placeBidAtomic).toHaveBeenCalledWith(
        'auction-123',
        expect.objectContaining({
          auctionId: 'auction-123',
          bidderId: 'member-new',
          amount: 15,
          newTimerExpiresAt: expect.any(Date),
        })
      )
    })

    // ==================== CONCURRENT BID HANDLING ====================
    it('should handle concurrent bid failure gracefully', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      const placeBidResult: PlaceBidResult = {
        success: false,
        error: 'CONCURRENT_BID',
      }
      vi.mocked(mockAuctionRepository.placeBidAtomic).mockResolvedValue(placeBidResult)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-new',
        amount: 15,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('concorrente')
      }
    })

    it('should handle atomic BID_TOO_LOW error (race condition where price increased)', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      const placeBidResult: PlaceBidResult = {
        success: false,
        error: 'BID_TOO_LOW',
      }
      vi.mocked(mockAuctionRepository.placeBidAtomic).mockResolvedValue(placeBidResult)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-new',
        amount: 15,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('superata')
      }
    })

    // ==================== TIMER RESET ====================
    it('should reset timer to configured duration after successful bid', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      const placeBidResult: PlaceBidResult = {
        success: true,
        bid: mockBid,
        previousWinnerId: null,
      }
      vi.mocked(mockAuctionRepository.placeBidAtomic).mockResolvedValue(placeBidResult)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-new',
        amount: 15,
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.timerExpiresAt).toBeInstanceOf(Date)
        // Timer should be set to ~30 seconds from now (mock auction has 30s timer)
        const expectedExpiry = Date.now() + 30000
        const actualExpiry = result.value.timerExpiresAt.getTime()
        expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000) // Within 1 second
      }
    })

    // ==================== OUTBID DETECTION ====================
    it('should correctly detect when a previous winner is outbid', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      const placeBidResult: PlaceBidResult = {
        success: true,
        bid: mockBid,
        previousWinnerId: 'member-old',
      }
      vi.mocked(mockAuctionRepository.placeBidAtomic).mockResolvedValue(placeBidResult)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-new',
        amount: 15,
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.outbid).toBe(true)
        expect(result.value.previousWinnerId).toBe('member-old')
      }
    })

    it('should not detect outbid when there was no previous winner', async () => {
      // Arrange
      const auctionNoPreviousWinner = { ...mockAuction, currentWinnerId: null }
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(auctionNoPreviousWinner)
      const placeBidResult: PlaceBidResult = {
        success: true,
        bid: mockBid,
        previousWinnerId: null,
      }
      vi.mocked(mockAuctionRepository.placeBidAtomic).mockResolvedValue(placeBidResult)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-new',
        amount: 15,
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.outbid).toBe(false)
        expect(result.value.previousWinnerId).toBeNull()
      }
    })

    // ==================== DOMAIN EVENT PUBLISHING ====================
    it('should publish BidPlaced domain event on successful bid', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)
      const placeBidResult: PlaceBidResult = {
        success: true,
        bid: mockBid,
        previousWinnerId: 'member-old',
      }
      vi.mocked(mockAuctionRepository.placeBidAtomic).mockResolvedValue(placeBidResult)

      // Act
      await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-new',
        amount: 15,
      })

      // Assert
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'auction.bid.placed',
        expect.objectContaining({
          auctionId: 'auction-123',
          bidderId: 'member-new',
          amount: 15,
        })
      )
    })

    it('should not publish domain event on failed bid', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(null)

      // Act
      await placeBidUseCase.execute({
        auctionId: 'non-existent',
        bidderId: 'member-123',
        amount: 15,
      })

      // Assert
      expect(mockEventBus.publish).not.toHaveBeenCalled()
    })

    // ==================== VALIDATION ORDER ====================
    it('should validate auction exists before checking budget', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(null)

      // Act
      await placeBidUseCase.execute({
        auctionId: 'non-existent',
        bidderId: 'member-123',
        amount: 15,
      })

      // Assert - budget check should not be called if auction doesn't exist
      expect(mockBudgetService.getBudget).not.toHaveBeenCalled()
    })

    it('should validate bid amount before checking budget', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)

      // Act
      await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-123',
        amount: 5, // Too low
      })

      // Assert - budget check should not be called if bid is too low
      expect(mockBudgetService.getBudget).not.toHaveBeenCalled()
    })

    // ==================== INVALID BID AMOUNT ====================
    it('should return failure for non-positive bid amount', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-123',
        amount: 0,
      })

      // Assert
      expect(result.isFailure).toBe(true)
    })

    it('should return failure for non-integer bid amount', async () => {
      // Arrange
      vi.mocked(mockAuctionRepository.findById).mockResolvedValue(mockAuction)

      // Act
      const result = await placeBidUseCase.execute({
        auctionId: 'auction-123',
        bidderId: 'member-123',
        amount: 15.5,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('intero')
      }
    })
  })
})
