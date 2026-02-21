/**
 * Auction Prisma Repository Integration Tests
 *
 * Tests the AuctionPrismaRepository with mocked Prisma client.
 * CRITICAL: Includes tests for atomic bid placement.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- vi.mocked partial Prisma transaction mocks */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuctionPrismaRepository } from '../repositories/auction.prisma-repository'
import type { PlaceBidData } from '../../domain/repositories/auction.repository.interface'
import { Prisma } from '@prisma/client'

// Mock the Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    auction: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auctionBid: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    auctionAppeal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    marketSession: {
      findUnique: vi.fn(),
    },
    leagueMember: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}))

// Import the mocked prisma after mocking
import { prisma } from '@/lib/prisma'

describe('AuctionPrismaRepository', () => {
  let repository: AuctionPrismaRepository

  // Mock Prisma data
  const mockPrismaAuction = {
    id: 'auction-1',
    leagueId: 'league-1',
    marketSessionId: 'session-1',
    playerId: 'player-1',
    type: 'FREE_BID' as const,
    basePrice: 1,
    currentPrice: 10,
    winnerId: 'member-old',
    sellerId: null,
    nominatorId: 'member-1',
    status: 'ACTIVE' as const,
    timerExpiresAt: new Date(Date.now() + 30000),
    timerSeconds: 30,
    startsAt: new Date(),
    endsAt: null,
    createdAt: new Date(),
    appealDecisionAcks: null,
    resumeReadyMembers: null,
  }

  const mockPrismaBid = {
    id: 'bid-1',
    auctionId: 'auction-1',
    bidderId: 'member-1',
    userId: 'user-1',
    amount: 15,
    isWinning: true,
    isCancelled: false,
    cancelledAt: null,
    cancelledBy: null,
    placedAt: new Date(),
  }

  const mockPrismaAppeal = {
    id: 'appeal-1',
    auctionId: 'auction-1',
    memberId: 'member-1',
    content: 'Test appeal reason',
    status: 'PENDING' as const,
    resolvedById: null,
    resolutionNote: null,
    resolvedAt: null,
    createdAt: new Date(),
  }

  beforeEach(() => {
    repository = new AuctionPrismaRepository()
    vi.clearAllMocks()
  })

  describe('findById', () => {
    it('should return auction by ID', async () => {
      vi.mocked(prisma.auction.findUnique).mockResolvedValue(mockPrismaAuction)

      const result = await repository.findById('auction-1')

      expect(prisma.auction.findUnique).toHaveBeenCalledWith({
        where: { id: 'auction-1' },
      })

      expect(result).not.toBeNull()
      expect(result?.id).toBe('auction-1')
      expect(result?.status).toBe('ACTIVE')
      expect(result?.type).toBe('FREE') // Mapped from FREE_BID
    })

    it('should return null when auction not found', async () => {
      vi.mocked(prisma.auction.findUnique).mockResolvedValue(null)

      const result = await repository.findById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findActiveBySession', () => {
    it('should return active auction for session', async () => {
      vi.mocked(prisma.auction.findFirst).mockResolvedValue(mockPrismaAuction)

      const result = await repository.findActiveBySession('session-1')

      expect(prisma.auction.findFirst).toHaveBeenCalledWith({
        where: {
          marketSessionId: 'session-1',
          status: 'ACTIVE',
        },
      })

      expect(result).not.toBeNull()
      expect(result?.marketSessionId).toBe('session-1')
    })

    it('should return null when no active auction in session', async () => {
      vi.mocked(prisma.auction.findFirst).mockResolvedValue(null)

      const result = await repository.findActiveBySession('session-no-active')

      expect(result).toBeNull()
    })
  })

  describe('findMany', () => {
    it('should filter by session ID', async () => {
      vi.mocked(prisma.auction.findMany).mockResolvedValue([mockPrismaAuction])

      const result = await repository.findMany({ sessionId: 'session-1' })

      expect(prisma.auction.findMany).toHaveBeenCalledWith({
        where: { marketSessionId: 'session-1' },
        orderBy: { createdAt: 'desc' },
      })

      expect(result).toHaveLength(1)
    })

    it('should filter by status', async () => {
      vi.mocked(prisma.auction.findMany).mockResolvedValue([mockPrismaAuction])

      await repository.findMany({ status: 'ACTIVE' })

      expect(prisma.auction.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should filter by player ID', async () => {
      vi.mocked(prisma.auction.findMany).mockResolvedValue([mockPrismaAuction])

      await repository.findMany({ playerId: 'player-1' })

      expect(prisma.auction.findMany).toHaveBeenCalledWith({
        where: { playerId: 'player-1' },
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('create', () => {
    it('should create a new auction', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      } as any)
      vi.mocked(prisma.auction.create).mockResolvedValue(mockPrismaAuction)

      const result = await repository.create({
        marketSessionId: 'session-1',
        playerId: 'player-1',
        startingPrice: 1,
        timerDuration: 30,
        type: 'FREE',
        nominatorId: 'member-1',
      })

      expect(prisma.auction.create).toHaveBeenCalledWith({
        data: {
          leagueId: 'league-1',
          marketSessionId: 'session-1',
          playerId: 'player-1',
          type: 'FREE_BID',
          basePrice: 1,
          currentPrice: 1,
          timerSeconds: 30,
          timerExpiresAt: expect.any(Date),
          nominatorId: 'member-1',
          status: 'ACTIVE',
        },
      })

      expect(result.id).toBe('auction-1')
    })

    it('should throw error if market session not found', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue(null)

      await expect(
        repository.create({
          marketSessionId: 'non-existent',
          playerId: 'player-1',
          startingPrice: 1,
          timerDuration: 30,
          type: 'FREE',
          nominatorId: 'member-1',
        })
      ).rejects.toThrow('Market session not found')
    })
  })

  describe('placeBidAtomic - CRITICAL', () => {
    it('should place bid atomically with transaction', async () => {
      const newBid = {
        ...mockPrismaBid,
        id: 'bid-new',
        amount: 15,
        bidderId: 'member-new',
      }

      // Mock transaction execution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([mockPrismaAuction]),
          auctionBid: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue(newBid),
          },
          auction: {
            update: vi.fn().mockResolvedValue({ ...mockPrismaAuction, currentPrice: 15 }),
          },
          leagueMember: {
            findUnique: vi.fn().mockResolvedValue({ userId: 'user-new' }),
          },
        }
        return callback(tx)
      }) as any)

      const bidData: PlaceBidData = {
        auctionId: 'auction-1',
        bidderId: 'member-new',
        amount: 15,
        newTimerExpiresAt: new Date(Date.now() + 30000),
      }

      const result = await repository.placeBidAtomic('auction-1', bidData)

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        })
      )

      expect(result.success).toBe(true)
      expect(result.bid?.amount).toBe(15)
      expect(result.previousWinnerId).toBe('member-old')
    })

    it('should return AUCTION_NOT_FOUND if auction does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]), // Empty array = not found
        }
        return callback(tx)
      }) as any)

      const bidData: PlaceBidData = {
        auctionId: 'non-existent',
        bidderId: 'member-1',
        amount: 15,
        newTimerExpiresAt: new Date(),
      }

      const result = await repository.placeBidAtomic('non-existent', bidData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('AUCTION_NOT_FOUND')
    })

    it('should return AUCTION_NOT_ACTIVE if auction is closed', async () => {
      const closedAuction = {
        ...mockPrismaAuction,
        status: 'COMPLETED' as const,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([closedAuction]),
        }
        return callback(tx)
      }) as any)

      const bidData: PlaceBidData = {
        auctionId: 'auction-1',
        bidderId: 'member-1',
        amount: 15,
        newTimerExpiresAt: new Date(),
      }

      const result = await repository.placeBidAtomic('auction-1', bidData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('AUCTION_NOT_ACTIVE')
    })

    it('should return BID_TOO_LOW if bid amount <= current price', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([mockPrismaAuction]), // currentPrice = 10
        }
        return callback(tx)
      }) as any)

      const bidData: PlaceBidData = {
        auctionId: 'auction-1',
        bidderId: 'member-1',
        amount: 10, // Equal to current price
        newTimerExpiresAt: new Date(),
      }

      const result = await repository.placeBidAtomic('auction-1', bidData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('BID_TOO_LOW')
    })

    it('should return BID_TOO_LOW if bid amount is less than current price', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([mockPrismaAuction]), // currentPrice = 10
        }
        return callback(tx)
      }) as any)

      const bidData: PlaceBidData = {
        auctionId: 'auction-1',
        bidderId: 'member-1',
        amount: 5, // Less than current price
        newTimerExpiresAt: new Date(),
      }

      const result = await repository.placeBidAtomic('auction-1', bidData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('BID_TOO_LOW')
    })

    it('should update previous winning bid to isWinning = false', async () => {
      const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([mockPrismaAuction]),
          auctionBid: {
            updateMany: mockUpdateMany,
            create: vi.fn().mockResolvedValue(mockPrismaBid),
          },
          auction: {
            update: vi.fn().mockResolvedValue(mockPrismaAuction),
          },
          leagueMember: {
            findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' }),
          },
        }
        return callback(tx)
      }) as any)

      const bidData: PlaceBidData = {
        auctionId: 'auction-1',
        bidderId: 'member-new',
        amount: 15,
        newTimerExpiresAt: new Date(),
      }

      await repository.placeBidAtomic('auction-1', bidData)

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          auctionId: 'auction-1',
          isWinning: true,
        },
        data: {
          isWinning: false,
        },
      })
    })

    it('should reset timer to new expiration time', async () => {
      const newExpiresAt = new Date(Date.now() + 30000)
      const mockAuctionUpdate = vi.fn().mockResolvedValue(mockPrismaAuction)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([mockPrismaAuction]),
          auctionBid: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue(mockPrismaBid),
          },
          auction: {
            update: mockAuctionUpdate,
          },
          leagueMember: {
            findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' }),
          },
        }
        return callback(tx)
      }) as any)

      const bidData: PlaceBidData = {
        auctionId: 'auction-1',
        bidderId: 'member-new',
        amount: 15,
        newTimerExpiresAt: newExpiresAt,
      }

      await repository.placeBidAtomic('auction-1', bidData)

      expect(mockAuctionUpdate).toHaveBeenCalledWith({
        where: { id: 'auction-1' },
        data: expect.objectContaining({
          timerExpiresAt: newExpiresAt,
        }),
      })
    })

    it('should use Serializable isolation level for concurrency safety', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([mockPrismaAuction]),
          auctionBid: {
            updateMany: vi.fn(),
            create: vi.fn().mockResolvedValue(mockPrismaBid),
          },
          auction: {
            update: vi.fn().mockResolvedValue(mockPrismaAuction),
          },
          leagueMember: {
            findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' }),
          },
        }
        return callback(tx)
      }) as any)

      await repository.placeBidAtomic('auction-1', {
        auctionId: 'auction-1',
        bidderId: 'member-1',
        amount: 15,
        newTimerExpiresAt: new Date(),
      })

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        })
      )
    })
  })

  describe('close', () => {
    it('should close auction with winner', async () => {
      vi.mocked(prisma.auction.update).mockResolvedValue({
        ...mockPrismaAuction,
        status: 'COMPLETED' as const,
        winnerId: 'member-winner',
        currentPrice: 50,
      })

      await repository.close('auction-1', 'member-winner', 50)

      expect(prisma.auction.update).toHaveBeenCalledWith({
        where: { id: 'auction-1' },
        data: {
          status: 'COMPLETED',
          winnerId: 'member-winner',
          currentPrice: 50,
          endsAt: expect.any(Date),
        },
      })
    })

    it('should close auction as NO_BIDS when no winner', async () => {
      vi.mocked(prisma.auction.update).mockResolvedValue({
        ...mockPrismaAuction,
        status: 'NO_BIDS' as const,
        winnerId: null,
      })

      await repository.close('auction-1', null, 1)

      expect(prisma.auction.update).toHaveBeenCalledWith({
        where: { id: 'auction-1' },
        data: {
          status: 'NO_BIDS',
          winnerId: null,
          currentPrice: 1,
          endsAt: expect.any(Date),
        },
      })
    })
  })

  describe('cancel', () => {
    it('should cancel auction', async () => {
      vi.mocked(prisma.auction.update).mockResolvedValue({
        ...mockPrismaAuction,
        status: 'CANCELLED' as const,
      })

      await repository.cancel('auction-1')

      expect(prisma.auction.update).toHaveBeenCalledWith({
        where: { id: 'auction-1' },
        data: {
          status: 'CANCELLED',
          endsAt: expect.any(Date),
        },
      })
    })
  })

  describe('resetTimer', () => {
    it('should reset auction timer', async () => {
      const newExpiresAt = new Date(Date.now() + 30000)
      vi.mocked(prisma.auction.update).mockResolvedValue({
        ...mockPrismaAuction,
        timerExpiresAt: newExpiresAt,
      })

      await repository.resetTimer('auction-1', newExpiresAt)

      expect(prisma.auction.update).toHaveBeenCalledWith({
        where: { id: 'auction-1' },
        data: {
          timerExpiresAt: newExpiresAt,
        },
      })
    })
  })

  describe('getBids', () => {
    it('should return all bids for auction ordered by amount', async () => {
      vi.mocked(prisma.auctionBid.findMany).mockResolvedValue([mockPrismaBid])

      const result = await repository.getBids('auction-1')

      expect(prisma.auctionBid.findMany).toHaveBeenCalledWith({
        where: {
          auctionId: 'auction-1',
          isCancelled: false,
        },
        orderBy: { amount: 'desc' },
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.amount).toBe(15)
    })
  })

  describe('getWinningBid', () => {
    it('should return winning bid for auction', async () => {
      vi.mocked(prisma.auctionBid.findFirst).mockResolvedValue(mockPrismaBid)

      const result = await repository.getWinningBid('auction-1')

      expect(prisma.auctionBid.findFirst).toHaveBeenCalledWith({
        where: {
          auctionId: 'auction-1',
          isWinning: true,
          isCancelled: false,
        },
      })

      expect(result).not.toBeNull()
      expect(result?.isWinning).toBe(true)
    })

    it('should return null when no winning bid', async () => {
      vi.mocked(prisma.auctionBid.findFirst).mockResolvedValue(null)

      const result = await repository.getWinningBid('auction-no-winner')

      expect(result).toBeNull()
    })
  })

  describe('createBid', () => {
    it('should create a new bid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({ userId: 'user-1' } as any)
      vi.mocked(prisma.auctionBid.create).mockResolvedValue(mockPrismaBid)

      const result = await repository.createBid({
        auctionId: 'auction-1',
        bidderId: 'member-1',
        amount: 15,
      })

      expect(prisma.auctionBid.create).toHaveBeenCalledWith({
        data: {
          auctionId: 'auction-1',
          bidderId: 'member-1',
          userId: 'user-1',
          amount: 15,
          isWinning: false,
        },
      })

      expect(result.amount).toBe(15)
    })

    it('should throw error if bidder not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      await expect(
        repository.createBid({
          auctionId: 'auction-1',
          bidderId: 'non-existent',
          amount: 15,
        })
      ).rejects.toThrow('Bidder not found')
    })
  })

  describe('getAppeal', () => {
    it('should return appeal for auction', async () => {
      vi.mocked(prisma.auctionAppeal.findFirst).mockResolvedValue(mockPrismaAppeal)

      const result = await repository.getAppeal('auction-1')

      expect(prisma.auctionAppeal.findFirst).toHaveBeenCalledWith({
        where: { auctionId: 'auction-1' },
        orderBy: { createdAt: 'desc' },
      })

      expect(result).not.toBeNull()
      expect(result?.reason).toBe('Test appeal reason')
    })
  })

  describe('createAppeal', () => {
    it('should create a new appeal', async () => {
      vi.mocked(prisma.auctionAppeal.create).mockResolvedValue(mockPrismaAppeal)

      const result = await repository.createAppeal({
        auctionId: 'auction-1',
        complainantId: 'member-1',
        reason: 'Test appeal reason',
      })

      expect(prisma.auctionAppeal.create).toHaveBeenCalledWith({
        data: {
          auctionId: 'auction-1',
          memberId: 'member-1',
          content: 'Test appeal reason',
          status: 'PENDING',
        },
      })

      expect(result.status).toBe('PENDING')
    })
  })

  describe('resolveAppeal', () => {
    it('should resolve appeal as ACCEPTED', async () => {
      const resolvedAppeal = {
        ...mockPrismaAppeal,
        status: 'ACCEPTED' as const,
        resolutionNote: 'Approved',
        resolvedAt: new Date(),
      }
      vi.mocked(prisma.auctionAppeal.update).mockResolvedValue(resolvedAppeal)

      const result = await repository.resolveAppeal('appeal-1', {
        resolution: 'ACCEPTED',
        notes: 'Approved',
      })

      expect(prisma.auctionAppeal.update).toHaveBeenCalledWith({
        where: { id: 'appeal-1' },
        data: {
          status: 'ACCEPTED',
          resolutionNote: 'Approved',
          resolvedAt: expect.any(Date),
        },
      })

      expect(result.status).toBe('ACCEPTED')
    })

    it('should resolve appeal as REJECTED', async () => {
      const resolvedAppeal = {
        ...mockPrismaAppeal,
        status: 'REJECTED' as const,
        resolutionNote: 'Invalid appeal',
        resolvedAt: new Date(),
      }
      vi.mocked(prisma.auctionAppeal.update).mockResolvedValue(resolvedAppeal)

      const result = await repository.resolveAppeal('appeal-1', {
        resolution: 'REJECTED',
        notes: 'Invalid appeal',
      })

      expect(result.status).toBe('REJECTED')
    })
  })

  describe('getPendingAppeals', () => {
    it('should return pending appeals for league', async () => {
      vi.mocked(prisma.auctionAppeal.findMany).mockResolvedValue([mockPrismaAppeal])

      const result = await repository.getPendingAppeals('league-1')

      expect(prisma.auctionAppeal.findMany).toHaveBeenCalledWith({
        where: {
          auction: {
            leagueId: 'league-1',
          },
          status: 'PENDING',
        },
        orderBy: { createdAt: 'asc' },
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.status).toBe('PENDING')
    })
  })

  describe('mapping functions', () => {
    it('should correctly map RUBATA auction type', async () => {
      const rubataAuction = {
        ...mockPrismaAuction,
        type: 'RUBATA' as const,
      }
      vi.mocked(prisma.auction.findUnique).mockResolvedValue(rubataAuction)

      const result = await repository.findById('auction-1')

      expect(result?.type).toBe('RUBATA')
    })

    it('should correctly map different auction statuses', async () => {
      const statuses = [
        { prisma: 'PENDING' as const, domain: 'ACTIVE' },
        { prisma: 'ACTIVE' as const, domain: 'ACTIVE' },
        { prisma: 'COMPLETED' as const, domain: 'CLOSED' },
        { prisma: 'CANCELLED' as const, domain: 'CANCELLED' },
        { prisma: 'NO_BIDS' as const, domain: 'CLOSED' },
      ]

      for (const { prisma: prismaStatus, domain: domainStatus } of statuses) {
        const auctionWithStatus = {
          ...mockPrismaAuction,
          status: prismaStatus,
        }
        vi.mocked(prisma.auction.findUnique).mockResolvedValue(auctionWithStatus)

        const result = await repository.findById('auction-1')

        expect(result?.status).toBe(domainStatus)
      }
    })
  })
})
