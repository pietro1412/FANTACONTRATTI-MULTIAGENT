/**
 * Create Trade Use Case Tests
 * TDD: Tests written to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreateTradeUseCase } from '../../application/use-cases/create-trade.use-case'
import type { ITradeRepository } from '../../domain/repositories/trade.repository.interface'
import type { ITradeValidator } from '../../domain/services/trade-validator.service'
import type { TradeOffer } from '../../domain/entities/trade-offer.entity'

describe('CreateTradeUseCase', () => {
  let useCase: CreateTradeUseCase
  let mockRepository: ITradeRepository
  let mockValidator: ITradeValidator

  const mockTradeOffer: TradeOffer = {
    id: 'trade-1',
    leagueId: 'league-1',
    senderId: 'member-1',
    receiverId: 'member-2',
    senderPlayers: ['roster-1', 'roster-2'],
    receiverPlayers: ['roster-3'],
    senderBudget: 10,
    receiverBudget: 0,
    status: 'PENDING',
    message: 'Test offer',
    createdAt: new Date('2024-01-01'),
    respondedAt: null,
    expiresAt: new Date('2024-01-02'),
    counterOfferId: null,
    marketSessionId: 'session-1',
  }

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

    useCase = new CreateTradeUseCase(mockRepository, mockValidator)
  })

  describe('execute', () => {
    it('should return failure if sender and receiver are the same', async () => {
      const result = await useCase.execute({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-1',
        senderPlayers: ['roster-1'],
        receiverPlayers: [],
        senderBudget: 0,
        receiverBudget: 0,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Non puoi fare offerte a te stesso')
      }
    })

    it('should return failure if trade window is not open', async () => {
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(false)

      const result = await useCase.execute({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-2',
        senderPlayers: ['roster-1'],
        receiverPlayers: [],
        senderBudget: 0,
        receiverBudget: 0,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('fase SCAMBI/OFFERTE')
      }
    })

    it('should return failure if asset validation fails', async () => {
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockRepository.getActiveMarketSessionId).mockResolvedValue('session-1')
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({
        isValid: false,
        errors: ['Budget insufficiente. Disponibile: 5'],
      })

      const result = await useCase.execute({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-2',
        senderPlayers: [],
        receiverPlayers: [],
        senderBudget: 100,
        receiverBudget: 0,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Budget insufficiente')
      }
    })

    it('should return failure if anti-loop validation fails', async () => {
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockRepository.getActiveMarketSessionId).mockResolvedValue('session-1')
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockValidator.validateAntiLoop).mockResolvedValue(false)

      const result = await useCase.execute({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-2',
        senderPlayers: ['roster-1'],
        receiverPlayers: [],
        senderBudget: 0,
        receiverBudget: 0,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('scambio inverso')
      }
    })

    it('should create trade offer when all validations pass', async () => {
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockRepository.getActiveMarketSessionId).mockResolvedValue('session-1')
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockValidator.validateAntiLoop).mockResolvedValue(true)
      vi.mocked(mockRepository.create).mockResolvedValue(mockTradeOffer)

      const result = await useCase.execute({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-2',
        senderPlayers: ['roster-1', 'roster-2'],
        receiverPlayers: ['roster-3'],
        senderBudget: 10,
        receiverBudget: 0,
        message: 'Test offer',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.trade.id).toBe('trade-1')
        expect(result.value.message).toBe('Offerta inviata')
      }
    })

    it('should call repository.create with correct parameters', async () => {
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockRepository.getActiveMarketSessionId).mockResolvedValue('session-1')
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockValidator.validateAntiLoop).mockResolvedValue(true)
      vi.mocked(mockRepository.create).mockResolvedValue(mockTradeOffer)

      await useCase.execute({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-2',
        senderPlayers: ['roster-1'],
        receiverPlayers: ['roster-2'],
        senderBudget: 5,
        receiverBudget: 10,
        message: 'My offer',
        durationHours: 48,
      })

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leagueId: 'league-1',
          senderId: 'member-1',
          receiverId: 'member-2',
          senderPlayers: ['roster-1'],
          receiverPlayers: ['roster-2'],
          senderBudget: 5,
          receiverBudget: 10,
          message: 'My offer',
          marketSessionId: 'session-1',
        })
      )
    })

    it('should publish TradeOffered event on success', async () => {
      const eventHandler = vi.fn()
      useCase.onTradeOffered(eventHandler)

      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockRepository.getActiveMarketSessionId).mockResolvedValue('session-1')
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockValidator.validateAntiLoop).mockResolvedValue(true)
      vi.mocked(mockRepository.create).mockResolvedValue(mockTradeOffer)

      await useCase.execute({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-2',
        senderPlayers: ['roster-1'],
        receiverPlayers: [],
        senderBudget: 0,
        receiverBudget: 0,
      })

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TRADE_OFFERED',
          tradeId: 'trade-1',
          leagueId: 'league-1',
          senderId: 'member-1',
          receiverId: 'member-2',
        })
      )
    })

    it('should set expiration date based on durationHours', async () => {
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockRepository.getActiveMarketSessionId).mockResolvedValue('session-1')
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockValidator.validateAntiLoop).mockResolvedValue(true)
      vi.mocked(mockRepository.create).mockResolvedValue(mockTradeOffer)

      await useCase.execute({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-2',
        senderPlayers: ['roster-1'],
        receiverPlayers: [],
        senderBudget: 0,
        receiverBudget: 0,
        durationHours: 48,
      })

      // Verify create was called with an expiresAt roughly 48 hours from now
      const createCall = vi.mocked(mockRepository.create).mock.calls[0]![0]
      const expiresAt = createCall.expiresAt as Date
      const hoursDiff = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
      expect(hoursDiff).toBeGreaterThan(47.9)
      expect(hoursDiff).toBeLessThan(48.1)
    })

    it('should use default 24 hours when durationHours not specified', async () => {
      vi.mocked(mockValidator.isTradeWindowOpen).mockResolvedValue(true)
      vi.mocked(mockRepository.getActiveMarketSessionId).mockResolvedValue('session-1')
      vi.mocked(mockValidator.validateAssets).mockResolvedValue({ isValid: true, errors: [] })
      vi.mocked(mockValidator.validateAntiLoop).mockResolvedValue(true)
      vi.mocked(mockRepository.create).mockResolvedValue(mockTradeOffer)

      await useCase.execute({
        leagueId: 'league-1',
        senderId: 'member-1',
        receiverId: 'member-2',
        senderPlayers: ['roster-1'],
        receiverPlayers: [],
        senderBudget: 0,
        receiverBudget: 0,
      })

      const createCall = vi.mocked(mockRepository.create).mock.calls[0]![0]
      const expiresAt = createCall.expiresAt as Date
      const hoursDiff = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
      expect(hoursDiff).toBeGreaterThan(23.9)
      expect(hoursDiff).toBeLessThan(24.1)
    })
  })
})
