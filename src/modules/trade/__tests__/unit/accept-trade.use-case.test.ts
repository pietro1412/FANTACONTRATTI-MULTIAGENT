/**
 * Accept Trade Use Case Tests
 * TDD: Tests written to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AcceptTradeUseCase } from '../../application/use-cases/accept-trade.use-case'
import type { ITradeRepository } from '../../domain/repositories/trade.repository.interface'
import type { ITradeValidator } from '../../domain/services/trade-validator.service'
import type { TradeOffer } from '../../domain/entities/trade-offer.entity'

describe('AcceptTradeUseCase', () => {
  let useCase: AcceptTradeUseCase
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
    message: 'Test offer',
    createdAt: new Date('2024-01-01'),
    respondedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
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

    useCase = new AcceptTradeUseCase(mockRepository, mockValidator)
  })

  describe('execute', () => {
    it('should return failure if trade not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null)

      const result = await useCase.execute({
        tradeId: 'non-existent',
        receiverId: 'member-2',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Offerta non trovata')
      }
    })

    it('should return failure if receiver is not authorized', async () => {
      const trade = createMockTrade({ receiverId: 'member-2' })
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)

      const result = await useCase.execute({
        tradeId: 'trade-1',
        receiverId: 'member-3', // Wrong receiver
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Non sei autorizzato')
      }
    })

    it('should return failure if trade status is not PENDING', async () => {
      const trade = createMockTrade({ status: 'REJECTED' })
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)

      const result = await useCase.execute({
        tradeId: 'trade-1',
        receiverId: 'member-2',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non è più valida')
      }
    })

    it('should return failure if trade has expired', async () => {
      const expiredDate = new Date(Date.now() - 1000) // 1 second ago
      const trade = createMockTrade({ expiresAt: expiredDate })
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)

      const result = await useCase.execute({
        tradeId: 'trade-1',
        receiverId: 'member-2',
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
        tradeId: 'trade-1',
        receiverId: 'member-2',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('fase SCAMBI/OFFERTE')
      }
    })

    it('should return failure if asset validation fails at acceptance', async () => {
      const trade = createMockTrade()
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({
        isValid: false,
        errors: ['Alcuni giocatori non sono più disponibili'],
      })

      const result = await useCase.execute({
        tradeId: 'trade-1',
        receiverId: 'member-2',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non sono più disponibili')
      }
    })

    it('should execute trade and mark as accepted on success', async () => {
      const trade = createMockTrade()
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })

      const result = await useCase.execute({
        tradeId: 'trade-1',
        receiverId: 'member-2',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.tradeId).toBe('trade-1')
        expect(result.value.message).toBe('Scambio completato!')
      }

      // Verify trade execution was called
      expect(mockRepository.executeTrade).toHaveBeenCalledWith(
        'trade-1',
        'member-1',
        'member-2',
        ['roster-1', 'roster-2'],
        ['roster-3'],
        10,
        5
      )

      // Verify status was updated
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        'trade-1',
        'ACCEPTED',
        expect.any(Date)
      )
    })

    it('should publish TradeAccepted event on success', async () => {
      const eventHandler = vi.fn()
      useCase.onTradeAccepted(eventHandler)

      const trade = createMockTrade()
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })

      await useCase.execute({
        tradeId: 'trade-1',
        receiverId: 'member-2',
      })

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TRADE_ACCEPTED',
          tradeId: 'trade-1',
          leagueId: 'league-1',
          senderId: 'member-1',
          receiverId: 'member-2',
          senderPlayers: ['roster-1', 'roster-2'],
          receiverPlayers: ['roster-3'],
          senderBudget: 10,
          receiverBudget: 5,
        })
      )
    })

    it('should handle trade with no expiration date', async () => {
      const trade = createMockTrade({ expiresAt: null })
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })

      const result = await useCase.execute({
        tradeId: 'trade-1',
        receiverId: 'member-2',
      })

      expect(result.isSuccess).toBe(true)
    })

    it('should handle trade with only budget exchange (no players)', async () => {
      const trade = createMockTrade({
        senderPlayers: [],
        receiverPlayers: [],
        senderBudget: 50,
        receiverBudget: 0,
      })
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })

      const result = await useCase.execute({
        tradeId: 'trade-1',
        receiverId: 'member-2',
      })

      expect(result.isSuccess).toBe(true)
      expect(mockRepository.executeTrade).toHaveBeenCalledWith(
        'trade-1',
        'member-1',
        'member-2',
        [],
        [],
        50,
        0
      )
    })

    it('should handle trade with only player exchange (no budget)', async () => {
      const trade = createMockTrade({
        senderPlayers: ['roster-1'],
        receiverPlayers: ['roster-2'],
        senderBudget: 0,
        receiverBudget: 0,
      })
      vi.mocked(mockRepository.findById).mockResolvedValue(trade)
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })

      const result = await useCase.execute({
        tradeId: 'trade-1',
        receiverId: 'member-2',
      })

      expect(result.isSuccess).toBe(true)
      expect(mockRepository.executeTrade).toHaveBeenCalledWith(
        'trade-1',
        'member-1',
        'member-2',
        ['roster-1'],
        ['roster-2'],
        0,
        0
      )
    })
  })
})
