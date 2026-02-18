/* eslint-disable @typescript-eslint/no-explicit-any -- vi.mocked partial mocks require any for Prisma model types */
/**
 * RubataPrismaRepository Tests
 *
 * Tests for the Prisma-based implementation of the Rubata repository.
 * Uses mocked Prisma client to verify atomic operations and correct behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RubataPrismaRepository } from '../rubata.prisma-repository'

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    leagueMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    serieAPlayer: {
      findMany: vi.fn(),
    },
    playerRoster: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Import the mocked prisma
import { prisma } from '@/lib/prisma'

describe('RubataPrismaRepository', () => {
  let repository: RubataPrismaRepository

  beforeEach(() => {
    repository = new RubataPrismaRepository()
    vi.clearAllMocks()
  })

  describe('getSession', () => {
    it('should return null if session not found', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue(null)

      const result = await repository.getSession('non-existent')

      expect(result).toBeNull()
      expect(prisma.marketSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
      })
    })

    it('should return null if session is not in RUBATA phase', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        currentPhase: 'SVINCOLATI',
        rubataState: 'OFFERING',
        rubataTimerStartedAt: null,
      } as any)

      const result = await repository.getSession('session-1')

      expect(result).toBeNull()
    })

    it('should return mapped RubataSession when found and in RUBATA phase', async () => {
      const mockSession = {
        id: 'session-1',
        currentPhase: 'RUBATA',
        rubataState: 'OFFERING',
        rubataTimerStartedAt: new Date('2025-01-01T10:00:00Z'),
      }

      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue(mockSession as any)

      const result = await repository.getSession('session-1')

      expect(result).not.toBeNull()
      expect(result?.marketSessionId).toBe('session-1')
      expect(result?.status).toBe('AUCTION')
      expect(result?.currentPhase).toBe('OFFERS')
    })

    it('should correctly map rubataState WAITING to SETUP status', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        currentPhase: 'RUBATA',
        rubataState: 'WAITING',
        rubataTimerStartedAt: null,
      } as any)

      const result = await repository.getSession('session-1')

      expect(result?.status).toBe('SETUP')
      expect(result?.currentPhase).toBe('WAITING_READY')
    })

    it('should correctly map rubataState COMPLETED to COMPLETED status', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        currentPhase: 'RUBATA',
        rubataState: 'COMPLETED',
        rubataTimerStartedAt: null,
      } as any)

      const result = await repository.getSession('session-1')

      expect(result?.status).toBe('COMPLETED')
      expect(result?.currentPhase).toBe('DONE')
    })
  })

  describe('updateSessionStatus', () => {
    it('should update rubataState in database', async () => {
      vi.mocked(prisma.marketSession.update).mockResolvedValue({} as any)

      await repository.updateSessionStatus('session-1', 'AUCTION')

      expect(prisma.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { rubataState: 'AUCTION' },
      })
    })
  })

  describe('getBoardEntries', () => {
    it('should return empty array if no rubataBoard', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        rubataBoard: null,
      } as any)

      const result = await repository.getBoardEntries('session-1')

      expect(result).toEqual([])
    })

    it('should return mapped board entries', async () => {
      const mockBoard = [
        {
          id: 'entry-1',
          rosterId: 'roster-1',
          memberId: 'member-1',
          playerId: 'player-1',
          status: 'PENDING',
          createdAt: '2025-01-01T10:00:00Z',
        },
        {
          id: 'entry-2',
          rosterId: 'roster-2',
          memberId: 'member-2',
          playerId: 'player-2',
          status: 'IN_AUCTION',
          createdAt: '2025-01-01T11:00:00Z',
        },
      ]

      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        rubataBoard: mockBoard,
      } as any)

      const result = await repository.getBoardEntries('session-1')

      expect(result).toHaveLength(2)
      expect(result[0]?.id).toBe('entry-1')
      expect(result[0]?.sessionId).toBe('session-1')
      expect(result[0]?.status).toBe('PENDING')
      expect(result[1]?.id).toBe('entry-2')
      expect(result[1]?.status).toBe('IN_AUCTION')
    })
  })

  describe('setReady', () => {
    it('should add member to ready list using transaction', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            rubataReadyMembers: ['member-1'],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      await repository.setReady('session-1', 'member-2')

      expect(mockTx.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { rubataReadyMembers: ['member-1', 'member-2'] },
      })
    })

    it('should not duplicate member in ready list', async () => {
      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            rubataReadyMembers: ['member-1', 'member-2'],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      await repository.setReady('session-1', 'member-2')

      // Should not call update since member is already ready
      expect(mockTx.marketSession.update).not.toHaveBeenCalled()
    })
  })

  describe('placeOfferAtomic', () => {
    it('should return ENTRY_NOT_FOUND when board entry does not exist', async () => {
      const mockTx = {
        marketSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'session-1',
              rubataBoard: [
                { id: 'entry-1', memberId: 'member-1', status: 'PENDING' },
              ],
              leagueId: 'league-1',
            },
          ]),
        },
        leagueMember: {
          findUnique: vi.fn(),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.placeOfferAtomic({
        boardEntryId: 'entry-999', // Does not exist
        offeredByMemberId: 'member-2',
        amount: 100,
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('ENTRY_NOT_FOUND')
    })

    it('should return ENTRY_ALREADY_IN_AUCTION when entry status is IN_AUCTION', async () => {
      const mockTx = {
        marketSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'session-1',
              rubataBoard: [
                { id: 'entry-1', memberId: 'member-1', status: 'IN_AUCTION' },
              ],
              leagueId: 'league-1',
            },
          ]),
        },
        leagueMember: {
          findUnique: vi.fn(),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.placeOfferAtomic({
        boardEntryId: 'entry-1',
        offeredByMemberId: 'member-2',
        amount: 100,
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('ENTRY_ALREADY_IN_AUCTION')
    })

    it('should return CANNOT_BID_OWN_PLAYER when bidder is the owner', async () => {
      const mockTx = {
        marketSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'session-1',
              rubataBoard: [
                { id: 'entry-1', memberId: 'member-1', status: 'PENDING' },
              ],
              leagueId: 'league-1',
            },
          ]),
        },
        leagueMember: {
          findUnique: vi.fn(),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.placeOfferAtomic({
        boardEntryId: 'entry-1',
        offeredByMemberId: 'member-1', // Same as owner
        amount: 100,
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('CANNOT_BID_OWN_PLAYER')
    })

    it('should return INSUFFICIENT_BUDGET when bidder cannot afford', async () => {
      const mockTx = {
        marketSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'session-1',
              rubataBoard: [
                { id: 'entry-1', memberId: 'member-1', status: 'PENDING' },
              ],
              leagueId: 'league-1',
            },
          ]),
        },
        leagueMember: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'member-2',
            currentBudget: 50, // Less than offer amount
          }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.placeOfferAtomic({
        boardEntryId: 'entry-1',
        offeredByMemberId: 'member-2',
        amount: 100,
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('INSUFFICIENT_BUDGET')
    })

    it('should return OFFER_TOO_LOW when offer is not higher than current', async () => {
      const mockTx = {
        marketSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'session-1',
              rubataBoard: [
                {
                  id: 'entry-1',
                  memberId: 'member-1',
                  status: 'PENDING',
                  currentOffer: 100, // Current highest offer
                },
              ],
              leagueId: 'league-1',
            },
          ]),
        },
        leagueMember: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'member-2',
            currentBudget: 500,
          }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.placeOfferAtomic({
        boardEntryId: 'entry-1',
        offeredByMemberId: 'member-2',
        amount: 100, // Same as current, should be higher
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('OFFER_TOO_LOW')
    })

    it('should successfully place offer and update board', async () => {
      const mockTx = {
        marketSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'session-1',
              rubataBoard: [
                {
                  id: 'entry-1',
                  memberId: 'member-1',
                  status: 'PENDING',
                  currentOffer: 50,
                },
              ],
              leagueId: 'league-1',
            },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
        leagueMember: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'member-2',
            currentBudget: 500,
          }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.placeOfferAtomic({
        boardEntryId: 'entry-1',
        offeredByMemberId: 'member-2',
        amount: 100,
      })

      expect(result.success).toBe(true)
      expect(result.offer).toBeDefined()
      expect(result.offer?.amount).toBe(100)
      expect(result.offer?.offeredByMemberId).toBe('member-2')
      expect(result.highestOffer).toBe(100)

      // Verify board was updated
      expect(mockTx.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          rubataBoard: expect.arrayContaining([
            expect.objectContaining({
              id: 'entry-1',
              currentOffer: 100,
              offeredById: 'member-2',
            }),
          ]),
        },
      })
    })

    it('should use atomic transaction for all operations', async () => {
      const mockTx = {
        marketSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'session-1',
              rubataBoard: [
                { id: 'entry-1', memberId: 'member-1', status: 'PENDING' },
              ],
              leagueId: 'league-1',
            },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
        leagueMember: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'member-2',
            currentBudget: 500,
          }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      await repository.placeOfferAtomic({
        boardEntryId: 'entry-1',
        offeredByMemberId: 'member-2',
        amount: 100,
      })

      // Verify transaction was used
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('getMemberBudget', () => {
    it('should return member budget', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        id: 'member-1',
        currentBudget: 350,
      } as any)

      const result = await repository.getMemberBudget('member-1')

      expect(result).toBe(350)
    })

    it('should return 0 if member not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      const result = await repository.getMemberBudget('non-existent')

      expect(result).toBe(0)
    })
  })

  describe('resetAllReady', () => {
    it('should clear all ready members', async () => {
      vi.mocked(prisma.marketSession.update).mockResolvedValue({} as any)

      await repository.resetAllReady('session-1')

      expect(prisma.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { rubataReadyMembers: [] },
      })
    })
  })

  describe('addToBoardAtomic', () => {
    it('should add entry to board using transaction', async () => {
      const existingBoard = [
        { id: 'entry-1', rosterId: 'roster-1', memberId: 'member-1', playerId: 'player-1', status: 'PENDING', createdAt: '2025-01-01T10:00:00Z' },
      ]

      const mockTx = {
        marketSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'session-1',
            rubataBoard: existingBoard,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const result = await repository.addToBoardAtomic({
        sessionId: 'session-1',
        rosterId: 'roster-2',
        memberId: 'member-2',
        playerId: 'player-2',
      })

      expect(result.sessionId).toBe('session-1')
      expect(result.rosterId).toBe('roster-2')
      expect(result.memberId).toBe('member-2')
      expect(result.playerId).toBe('player-2')
      expect(result.status).toBe('PENDING')

      // Verify board was updated with new entry added
      expect(mockTx.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          rubataBoard: expect.arrayContaining([
            expect.objectContaining({ id: 'entry-1' }),
            expect.objectContaining({
              rosterId: 'roster-2',
              memberId: 'member-2',
              playerId: 'player-2',
              status: 'PENDING',
            }),
          ]),
        },
      })
    })
  })

  describe('cancelPendingOffers', () => {
    it('should clear offer and set status to IN_AUCTION', async () => {
      const mockTx = {
        marketSession: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'session-1',
              rubataBoard: [
                {
                  id: 'entry-1',
                  status: 'PENDING',
                  currentOffer: 100,
                  offeredById: 'member-2',
                },
              ],
            },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      await repository.cancelPendingOffers('entry-1')

      expect(mockTx.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          rubataBoard: expect.arrayContaining([
            expect.objectContaining({
              id: 'entry-1',
              status: 'IN_AUCTION',
              currentOffer: undefined,
              offeredById: undefined,
            }),
          ]),
        },
      })
    })
  })
})
