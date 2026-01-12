/**
 * Counter Offer Use Case Tests
 * TDD: Tests written to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CounterOfferUseCase } from '../../application/use-cases/counter-offer.use-case'
import type { ITradeRepository } from '../../domain/repositories/trade.repository.interface'
import type { ITradeValidator } from '../../domain/services/trade-validator.service'
import type { TradeOffer } from '../../domain/entities/trade-offer.entity'

describe('CounterOfferUseCase', () => {
  let useCase: CounterOfferUseCase
  let mockRepository: ITradeRepository
  let mockValidator: ITradeValidator

  const createMockTrade = (overrides: Partial<TradeOffer> = {}): TradeOffer => ({
    id: 'trade-1',
    leagueId: 'league-1',
    senderId: 'member-1',
    receiverId: 'member-2',
    senderPlayers: ['roster-1', 'roster-2'],
    receiverPlayers: ['roster-3'],
    senderBudget: 10,
    receiverBudget: 5,
    status: 'PENDING',
    message: 'Original offer',
    createdAt: new Date('2024-01-01'),
    respondedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    counterOfferId: null,
    marketSessionId: 'session-1',
    ...overrides,
  })

  const createMockCounterOffer = (overrides: Partial<TradeOffer> = {}): TradeOffer => ({
    id: 'counter-1',
    leagueId: 'league-1',
    senderId: 'member-2', // Original receiver becomes sender
    receiverId: 'member-1', // Original sender becomes receiver
    senderPlayers: ['roster-4'],
    receiverPlayers: ['roster-1'],
    senderBudget: 5,
    receiverBudget: 15,
    status: 'PENDING',
    message: 'Counter offer',
    createdAt: new Date('2024-01-02'),
    respondedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    counterOfferId: null,
    marketSessionId: 'session-1',
    ...overrides,
  })

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      findByLeague: vi.fn(),
      findPendingForMember: vi.fn(),
      findSentByMember: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      setCounterOffer: vi.fn(),
      getRosterInfo: vi.fn(),
      getMemberBudget: vi.fn(),
      executeTrade: vi.fn(),
      findAcceptedTradesInSession: vi.fn(),
      isTradeWindowOpen: vi.fn(),
      getActiveMarketSessionId: vi.fn(),
    }

    mockValidator = {
      validateAntiLoop: vi.fn(),
      validateAssets: vi.fn(),
      isTradeWindowOpen: vi.fn(),
    }

    useCase = new CounterOfferUseCase(mockRepository, mockValidator)
  })

  describe('execute', () => {
    it('should return failure if original trade not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null)

      const result = await useCase.execute({
        originalTradeId: 'non-existent',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Offerta originale non trovata')
      }
    })

    it('should return failure if sender was not the original receiver', async () => {
      const trade = createMockTrade({ receiverId: 'member-2' })
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)

      const result = await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-3', // Not the original receiver
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Non sei autorizzato a controffertare')
      }
    })

    it('should return failure if original trade is not pending', async () => {
      const trade = createMockTrade({ status: 'ACCEPTED' })
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)

      const result = await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non è più valida')
      }
    })

    it('should return failure if original trade has expired', async () => {
      const expiredDate = new Date(Date.now() - 1000)
      const trade = createMockTrade({ expiresAt: expiredDate })
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)

      const result = await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('scaduta')
      }
      expect(mockRepository.updateStatus).toHaveBeenCalledWith('trade-1', 'EXPIRED')
    })

    it('should return failure if trade window is not open', async () => {
      const trade = createMockTrade()
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(false)

      const result = await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('fase SCAMBI/OFFERTE')
      }
    })

    it('should return failure if asset validation fails', async () => {
      const trade = createMockTrade()
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({
        isValid: false,
        errors: ['Budget insufficiente'],
      })

      const result = await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 1000, // Too much
        receiverBudget: 15,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Budget insufficiente')
      }
    })

    it('should mark original trade as COUNTERED', async () => {
      const trade = createMockTrade()
      const counterOffer = createMockCounterOffer()

      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockRepository.create).mockResolvedValue(counterOffer)

      await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        'trade-1',
        'COUNTERED',
        expect.any(Date)
      )
    })

    it('should create counter offer with swapped sender/receiver', async () => {
      const trade = createMockTrade()
      const counterOffer = createMockCounterOffer()

      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockRepository.create).mockResolvedValue(counterOffer)

      await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2', // Original receiver
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leagueId: 'league-1',
          senderId: 'member-2',      // Original receiver is now sender
          receiverId: 'member-1',     // Original sender is now receiver
          senderPlayers: ['roster-4'],
          receiverPlayers: ['roster-1'],
          senderBudget: 5,
          receiverBudget: 15,
        })
      )
    })

    it('should link counter offer to original trade', async () => {
      const trade = createMockTrade()
      const counterOffer = createMockCounterOffer()

      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockRepository.create).mockResolvedValue(counterOffer)

      await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(mockRepository.setCounterOffer).toHaveBeenCalledWith('trade-1', 'counter-1')
    })

    it('should return success with counter offer details', async () => {
      const trade = createMockTrade()
      const counterOffer = createMockCounterOffer()

      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockRepository.create).mockResolvedValue(counterOffer)

      const result = await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.originalTradeId).toBe('trade-1')
        expect(result.value.counterOffer.id).toBe('counter-1')
        expect(result.value.message).toBe('Controofferta inviata')
      }
    })

    it('should publish CounterOfferMade event on success', async () => {
      const eventHandler = vi.fn()
      useCase.onCounterOfferMade(eventHandler)

      const trade = createMockTrade()
      const counterOffer = createMockCounterOffer()

      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockRepository.create).mockResolvedValue(counterOffer)

      await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
      })

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'COUNTER_OFFER_MADE',
          originalTradeId: 'trade-1',
          counterOfferId: 'counter-1',
          leagueId: 'league-1',
          senderId: 'member-2',
          receiverId: 'member-1',
        })
      )
    })

    it('should use default message if not provided', async () => {
      const trade = createMockTrade()
      const counterOffer = createMockCounterOffer()

      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockRepository.create).mockResolvedValue(counterOffer)

      await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
        // No message provided
      })

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Controofferta'),
        })
      )
    })

    it('should use custom message if provided', async () => {
      const trade = createMockTrade()
      const counterOffer = createMockCounterOffer()

      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockRepository.create).mockResolvedValue(counterOffer)

      await useCase.execute({
        originalTradeId: 'trade-1',
        senderId: 'member-2',
        senderPlayers: ['roster-4'],
        receiverPlayers: ['roster-1'],
        senderBudget: 5,
        receiverBudget: 15,
        message: 'My counter proposal',
      })

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'My counter proposal',
        })
      )
    })
  })
})
