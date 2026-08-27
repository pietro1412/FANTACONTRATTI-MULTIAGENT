/**
 * auction-phase-trade-expiry.test.ts - Unit tests per la scadenza automatica
 * delle offerte di scambio pendenti alla chiusura della fase Scambi
 * (setMarketPhase, src/services/auction.service.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    marketSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    leagueMember: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    tradeOffer: {
      updateMany: vi.fn(),
    },
    playerContract: {
      updateMany: vi.fn(),
    },
  }
  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock
  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  MemberRole: { ADMIN: 'ADMIN', MANAGER: 'MANAGER' },
  MemberStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', PENDING: 'PENDING' },
  AuctionStatus: {},
  AuctionType: {},
  AcquisitionType: {},
  RosterStatus: {},
  Position: {},
}))

vi.mock('../services/notification.service', () => ({
  notifyPhaseChange: vi.fn().mockResolvedValue(undefined),
  notifyAuctionStart: vi.fn().mockResolvedValue(undefined),
}))

import * as auctionService from '../services/auction.service'

function makeSession(overrides = {}) {
  return {
    id: 'session-1',
    leagueId: 'league-1',
    status: 'ACTIVE',
    type: 'MERCATO_RICORRENTE',
    currentPhase: 'OFFERTE_PRE_RINNOVO',
    league: { id: 'league-1' },
    ...overrides,
  }
}

function makeAdmin(overrides = {}) {
  return { id: 'member-admin', leagueId: 'league-1', userId: 'user-admin', role: 'ADMIN', status: 'ACTIVE', ...overrides }
}

describe('setMarketPhase — scadenza offerte scambio pendenti', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.marketSession.update.mockResolvedValue({ id: 'session-1', currentPhase: 'PREMI' })
    mockPrisma.tradeOffer.updateMany.mockResolvedValue({ count: 0 })
  })

  it('marca EXPIRED le offerte PENDING quando si esce da OFFERTE_PRE_RINNOVO', async () => {
    mockPrisma.marketSession.findUnique.mockResolvedValue(makeSession({ currentPhase: 'OFFERTE_PRE_RINNOVO' }))
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdmin())

    const result = await auctionService.setMarketPhase('session-1', 'user-admin', 'PREMI')

    expect(result.success).toBe(true)
    expect(mockPrisma.tradeOffer.updateMany).toHaveBeenCalledWith({
      where: { marketSessionId: 'session-1', status: 'PENDING' },
      data: { status: 'EXPIRED' },
    })
  })

  it('marca EXPIRED le offerte PENDING quando si esce da OFFERTE_POST_ASTA_SVINCOLATI', async () => {
    mockPrisma.marketSession.findUnique.mockResolvedValue(makeSession({ currentPhase: 'OFFERTE_POST_ASTA_SVINCOLATI' }))
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdmin())

    const result = await auctionService.setMarketPhase('session-1', 'user-admin', 'RUBATA')

    expect(result.success).toBe(true)
    expect(mockPrisma.tradeOffer.updateMany).toHaveBeenCalledWith({
      where: { marketSessionId: 'session-1', status: 'PENDING' },
      data: { status: 'EXPIRED' },
    })
  })

  it('NON tocca le offerte quando la fase cambia ma non si esce da una fase Scambi', async () => {
    mockPrisma.marketSession.findUnique.mockResolvedValue(makeSession({ currentPhase: 'RUBATA' }))
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdmin())

    const result = await auctionService.setMarketPhase('session-1', 'user-admin', 'ASTA_SVINCOLATI')

    expect(result.success).toBe(true)
    expect(mockPrisma.tradeOffer.updateMany).not.toHaveBeenCalled()
  })

  it('NON tocca le offerte se la fase resta OFFERTE_PRE_RINNOVO (nessuna uscita)', async () => {
    mockPrisma.marketSession.findUnique.mockResolvedValue(makeSession({ currentPhase: 'OFFERTE_PRE_RINNOVO' }))
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdmin())

    const result = await auctionService.setMarketPhase('session-1', 'user-admin', 'OFFERTE_PRE_RINNOVO')

    expect(result.success).toBe(true)
    expect(mockPrisma.tradeOffer.updateMany).not.toHaveBeenCalled()
  })
})
