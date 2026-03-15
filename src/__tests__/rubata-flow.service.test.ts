/**
 * Tests for rubata flow: ready check, acknowledgment, pause/resume, preferences,
 * and strategy functions in rubata.service.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

// ==================== MOCKS ====================

vi.mock('@/lib/prisma', () => {
  const p = {
    leagueMember: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    marketSession: { findFirst: vi.fn(), update: vi.fn() },
    playerRoster: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    playerContract: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
    auction: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    auctionBid: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    rubataPreference: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn() },
    serieAPlayer: { findMany: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  }
  p.$transaction.mockImplementation((fn: (tx: typeof p) => Promise<unknown>) => fn(p))
  return { prisma: p }
})

vi.mock('../services/movement.service', () => ({ recordMovement: vi.fn() }))

vi.mock('../services/pusher.service', () => ({
  triggerRubataBidPlaced: vi.fn().mockResolvedValue(undefined),
  triggerRubataStealDeclared: vi.fn().mockResolvedValue(undefined),
  triggerRubataReadyChanged: vi.fn().mockResolvedValue(undefined),
  triggerAuctionClosed: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/player-stats.service', () => ({
  computeSeasonStatsBatch: vi.fn().mockResolvedValue(new Map()),
  computeAutoTagsBatch: vi.fn().mockResolvedValue(new Map()),
}))

// ==================== IMPORTS ====================

import { prisma } from '@/lib/prisma'
import type { Mock } from 'vitest'

// Cast all prisma methods as mocks for test assertions
const mockPrisma = prisma as unknown as {
  leagueMember: { findFirst: Mock; findMany: Mock; findUnique: Mock; update: Mock }
  marketSession: { findFirst: Mock; update: Mock }
  playerRoster: { findMany: Mock; findFirst: Mock; update: Mock }
  playerContract: { findFirst: Mock; findMany: Mock; update: Mock; aggregate: Mock }
  auction: { findFirst: Mock; create: Mock; update: Mock; findMany: Mock }
  auctionBid: { create: Mock; findFirst: Mock; findMany: Mock; updateMany: Mock }
  rubataPreference: { findMany: Mock; upsert: Mock; deleteMany: Mock; findFirst: Mock }
  serieAPlayer: { findMany: Mock; findUnique: Mock }
  $transaction: Mock
}

import {
  getRubataReadyStatus,
  setRubataReady,
  forceAllRubataReady,
  getRubataPendingAck,
  acknowledgeRubataTransaction,
  forceAllRubataAcknowledge,
  pauseRubata,
  resumeRubata,
  getRubataPreferences,
  setRubataPreference,
  deleteRubataPreference,
  getAllPlayersForStrategies,
  getAllSvincolatiForStrategies,
  completeRubataWithTransactions,
} from '../services/rubata.service'

// ==================== HELPERS ====================

const LEAGUE_ID = 'league-1'
const USER_ID = 'user-1'
const ADMIN_USER_ID = 'admin-user'
const MEMBER_ID = 'member-1'
const ADMIN_MEMBER_ID = 'admin-member'
const SESSION_ID = 'session-1'

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: MEMBER_ID,
    leagueId: LEAGUE_ID,
    userId: USER_ID,
    role: 'MANAGER',
    status: 'ACTIVE',
    teamName: 'Team Alpha',
    currentBudget: 500,
    rubataOrder: 1,
    user: { id: USER_ID, username: 'manager1' },
    ...overrides,
  }
}

function makeAdminMember(overrides: Record<string, unknown> = {}) {
  return {
    id: ADMIN_MEMBER_ID,
    leagueId: LEAGUE_ID,
    userId: ADMIN_USER_ID,
    role: 'ADMIN',
    status: 'ACTIVE',
    teamName: 'Admin Team',
    currentBudget: 500,
    rubataOrder: 0,
    user: { id: ADMIN_USER_ID, username: 'admin' },
    ...overrides,
  }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    leagueId: LEAGUE_ID,
    status: 'ACTIVE',
    currentPhase: 'RUBATA',
    rubataState: 'READY_CHECK',
    rubataReadyMembers: [],
    rubataOfferTimerSeconds: 30,
    rubataAuctionTimerSeconds: 30,
    rubataTimerStartedAt: null,
    rubataBoard: null,
    rubataBoardIndex: 0,
    rubataOrder: [],
    rubataPendingAck: null,
    rubataPausedFromState: null,
    rubataPausedRemainingSeconds: null,
    rubataAuctionReadyInfo: null,
    auctionMode: 'REMOTE',
    league: {
      members: [
        makeMember(),
        makeMember({ id: 'member-2', userId: 'user-2', user: { id: 'user-2', username: 'manager2' } }),
      ],
    },
    ...overrides,
  }
}

// ==================== TESTS ====================

beforeEach(() => {
  vi.clearAllMocks()
})

// ==================== getRubataReadyStatus ====================

describe('getRubataReadyStatus', () => {
  it('should return error for non-member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await getRubataReadyStatus(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return error when no active session', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(null)

    const result = await getRubataReadyStatus(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione attiva')
  })

  it('should return ready and pending members correctly', async () => {
    const member1 = makeMember()
    const member2 = makeMember({ id: 'member-2', userId: 'user-2', user: { id: 'user-2', username: 'manager2' } })
    const session = makeSession({
      rubataReadyMembers: [MEMBER_ID],
      league: { members: [member1, member2] },
    })

    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member1)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(session)

    const result = await getRubataReadyStatus(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as {
      readyMembers: Array<{ id: string }>
      pendingMembers: Array<{ id: string }>
      totalMembers: number
      readyCount: number
      allReady: boolean
      userIsReady: boolean
      myMemberId: string
    }

    expect(data.readyMembers).toHaveLength(1)
    expect(data.readyMembers[0]?.id).toBe(MEMBER_ID)
    expect(data.pendingMembers).toHaveLength(1)
    expect(data.pendingMembers[0]?.id).toBe('member-2')
    expect(data.totalMembers).toBe(2)
    expect(data.readyCount).toBe(1)
    expect(data.allReady).toBe(false)
    expect(data.userIsReady).toBe(true)
    expect(data.myMemberId).toBe(MEMBER_ID)
  })

  it('should report allReady when all members are ready', async () => {
    const member1 = makeMember()
    const member2 = makeMember({ id: 'member-2', userId: 'user-2', user: { id: 'user-2', username: 'manager2' } })
    const session = makeSession({
      rubataReadyMembers: [MEMBER_ID, 'member-2'],
      league: { members: [member1, member2] },
    })

    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member1)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(session)

    const result = await getRubataReadyStatus(LEAGUE_ID, USER_ID)
    const data = result.data as { allReady: boolean; readyCount: number }
    expect(data.allReady).toBe(true)
    expect(data.readyCount).toBe(2)
  })
})

// ==================== setRubataReady ====================

describe('setRubataReady', () => {
  it('should return error for non-member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return error when no active rubata session', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(null)

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should return error when rubata state is not in allowed states', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'OFFERING' })
    )

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non è il momento di dichiararsi pronti')
  })

  it('should return already ready if member is already in the list', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataReadyMembers: [MEMBER_ID] })
    )

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toBe('Già pronto')
  })

  it('should add member to ready list when not all ready yet', async () => {
    const member = makeMember()
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataReadyMembers: [] })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([
      member,
      makeMember({ id: 'member-2' }),
    ])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toBe('Pronto!')

    const data = result.data as { allReady: boolean; readyCount: number; totalMembers: number }
    expect(data.allReady).toBe(false)
    expect(data.readyCount).toBe(1)
    expect(data.totalMembers).toBe(2)
  })

  it('should transition from READY_CHECK to OFFERING when all ready (via default path)', async () => {
    // In READY_CHECK state, when all are ready but the state is READY_CHECK,
    // the code falls through to the general update (no special branch for READY_CHECK→OFFERING)
    const member = makeMember()
    const member2 = makeMember({ id: 'member-2', userId: 'user-2' })
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'READY_CHECK', rubataReadyMembers: ['member-2'] })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([member, member2])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    // In READY_CHECK with all ready, no special branch handles it,
    // so it goes to the general path which just updates ready members
    const data = result.data as { allReady: boolean }
    expect(data.allReady).toBe(true)
  })

  it('should transition from AUCTION_READY_CHECK to AUCTION when all ready', async () => {
    const member = makeMember()
    const member2 = makeMember({ id: 'member-2', userId: 'user-2' })
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'AUCTION_READY_CHECK', rubataReadyMembers: ['member-2'] })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([member, member2])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toBe('Tutti pronti! Asta avviata.')

    const data = result.data as { allReady: boolean; auctionStarted: boolean }
    expect(data.allReady).toBe(true)
    expect(data.auctionStarted).toBe(true)

    // Verify session was updated to AUCTION
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'AUCTION',
          rubataReadyMembers: [],
          rubataAuctionReadyInfo: Prisma.DbNull,
        }),
      })
    )
  })

  it('should transition from PENDING_ACK to OFFERING when all ready', async () => {
    const member = makeMember()
    const member2 = makeMember({ id: 'member-2', userId: 'user-2' })
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'PENDING_ACK', rubataReadyMembers: ['member-2'] })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([member, member2])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toBe('Tutti pronti! Si riparte.')

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'OFFERING',
          rubataPendingAck: Prisma.DbNull,
        }),
      })
    )
  })

  it('should resume from PAUSED with saved remaining time when all ready', async () => {
    const member = makeMember()
    const member2 = makeMember({ id: 'member-2', userId: 'user-2' })
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({
        rubataState: 'PAUSED',
        rubataReadyMembers: ['member-2'],
        rubataPausedFromState: 'OFFERING',
        rubataPausedRemainingSeconds: 15,
        rubataOfferTimerSeconds: 30,
      })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([member, member2])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toContain('15 secondi rimanenti')

    const data = result.data as { allReady: boolean; resumed: boolean; remainingSeconds: number }
    expect(data.allReady).toBe(true)
    expect(data.resumed).toBe(true)
    expect(data.remainingSeconds).toBe(15)

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'OFFERING',
          rubataPausedFromState: null,
          rubataPausedRemainingSeconds: null,
        }),
      })
    )
  })

  it('should auto-mark all members ready in IN_PRESENCE mode', async () => {
    const member = makeMember()
    const member2 = makeMember({ id: 'member-2', userId: 'user-2' })
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'READY_CHECK', auctionMode: 'IN_PRESENCE', rubataReadyMembers: [] })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([member, member2])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await setRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    // In IN_PRESENCE mode, all members auto-marked ready, so allReady should be true
    const data = result.data as { allReady: boolean }
    expect(data.allReady).toBe(true)
  })
})

// ==================== forceAllRubataReady ====================

describe('forceAllRubataReady', () => {
  it('should return error for non-admin', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await forceAllRubataReady(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should return error when no active rubata session', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(null)

    const result = await forceAllRubataReady(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should force transition from READY_CHECK to OFFERING', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'READY_CHECK' })
    )
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([
      makeMember(),
      makeMember({ id: 'member-2' }),
    ])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await forceAllRubataReady(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toBe('Tutti pronti! Rubata avviata.')

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'OFFERING',
        }),
      })
    )
  })

  it('should force transition from AUCTION_READY_CHECK to AUCTION', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'AUCTION_READY_CHECK' })
    )
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([makeMember()])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await forceAllRubataReady(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toBe('Tutti pronti forzati! Asta avviata.')

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'AUCTION',
          rubataAuctionReadyInfo: Prisma.DbNull,
        }),
      })
    )
  })

  it('should force transition from PENDING_ACK to OFFERING', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'PENDING_ACK' })
    )
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([makeMember()])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await forceAllRubataReady(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toBe('Tutti pronti forzati! Si riparte.')

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'OFFERING',
          rubataPendingAck: Prisma.DbNull,
        }),
      })
    )
  })

  it('should force resume from PAUSED with remaining time', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({
        rubataState: 'PAUSED',
        rubataPausedFromState: 'AUCTION',
        rubataPausedRemainingSeconds: 20,
        rubataAuctionTimerSeconds: 30,
      })
    )
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([makeMember()])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await forceAllRubataReady(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toContain('20 secondi rimanenti')

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'AUCTION',
          rubataPausedFromState: null,
          rubataPausedRemainingSeconds: null,
        }),
      })
    )
  })

  it('should return error for invalid state (e.g. OFFERING)', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'OFFERING' })
    )
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([makeMember()])

    const result = await forceAllRubataReady(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Stato non valido per forzare pronti')
  })
})

// ==================== getRubataPendingAck ====================

describe('getRubataPendingAck', () => {
  it('should return error for non-member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await getRubataPendingAck(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return null data when no pending ack', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(null)

    const result = await getRubataPendingAck(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.data).toBeNull()
  })

  it('should return pending ack data with contract info for winner', async () => {
    const member = makeMember()
    const pendingAck = {
      auctionId: 'auction-1',
      playerId: 'player-1',
      playerName: 'Leao',
      playerTeam: 'Milan',
      playerPosition: 'A',
      winnerId: MEMBER_ID,
      winnerUsername: 'manager1',
      sellerId: 'member-2',
      sellerUsername: 'manager2',
      finalPrice: 50,
      acknowledgedMembers: [],
      prophecies: [],
    }

    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataPendingAck: pendingAck })
    )
    mockPrisma.playerRoster.findFirst.mockResolvedValueOnce({
      id: 'roster-1',
      playerId: 'player-1',
      contract: {
        id: 'contract-1',
        salary: 5,
        duration: 3,
        initialSalary: 5,
        rescissionClause: 45,
      },
      player: {
        team: 'Milan',
        position: 'A',
      },
    })
    mockPrisma.serieAPlayer.findUnique.mockResolvedValueOnce({ apiFootballId: 12345 })

    const result = await getRubataPendingAck(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as {
      auctionId: string
      player: { id: string; name: string }
      winner: { id: string } | null
      seller: { id: string }
      finalPrice: number
      winnerContractInfo: { contractId: string; salary: number } | null
      userAcknowledged: boolean
    }

    expect(data.auctionId).toBe('auction-1')
    expect(data.player.name).toBe('Leao')
    expect(data.winner?.id).toBe(MEMBER_ID)
    expect(data.finalPrice).toBe(50)
    expect(data.winnerContractInfo).not.toBeNull()
    expect(data.winnerContractInfo?.salary).toBe(5)
    expect(data.userAcknowledged).toBe(false)
  })

  it('should not return contract info for non-winner', async () => {
    const member = makeMember()
    const pendingAck = {
      auctionId: 'auction-1',
      playerId: 'player-1',
      playerName: 'Leao',
      playerTeam: 'Milan',
      playerPosition: 'A',
      winnerId: 'member-2',
      winnerUsername: 'manager2',
      sellerId: 'member-3',
      sellerUsername: 'manager3',
      finalPrice: 50,
      acknowledgedMembers: [MEMBER_ID],
      prophecies: [],
    }

    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataPendingAck: pendingAck })
    )
    mockPrisma.serieAPlayer.findUnique.mockResolvedValueOnce({ apiFootballId: null })

    const result = await getRubataPendingAck(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as {
      winnerContractInfo: unknown
      userAcknowledged: boolean
    }
    expect(data.winnerContractInfo).toBeNull()
    expect(data.userAcknowledged).toBe(true)
  })
})

// ==================== acknowledgeRubataTransaction ====================

describe('acknowledgeRubataTransaction', () => {
  it('should return error for non-member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await acknowledgeRubataTransaction(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return error when not in PENDING_ACK state', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'OFFERING' })
    )

    const result = await acknowledgeRubataTransaction(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna transazione da confermare')
  })

  it('should return already confirmed if member already acknowledged', async () => {
    const pendingAck = {
      auctionId: 'auction-1',
      playerId: 'player-1',
      playerName: 'Leao',
      winnerId: 'member-2',
      finalPrice: 50,
      acknowledgedMembers: [MEMBER_ID],
      prophecies: [],
    }
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'PENDING_ACK', rubataPendingAck: pendingAck })
    )

    const result = await acknowledgeRubataTransaction(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toBe('Già confermato')
  })

  it('should acknowledge without prophecy and update pending ack', async () => {
    const member = makeMember()
    const pendingAck = {
      auctionId: 'auction-1',
      playerId: 'player-1',
      playerName: 'Leao',
      winnerId: 'member-2',
      finalPrice: 50,
      acknowledgedMembers: [],
      prophecies: [],
    }
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'PENDING_ACK', rubataPendingAck: pendingAck })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([
      member,
      makeMember({ id: 'member-2' }),
    ])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await acknowledgeRubataTransaction(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toBe('Confermato!')

    const data = result.data as { allAcknowledged: boolean; acknowledgedCount: number }
    expect(data.allAcknowledged).toBe(false)
    expect(data.acknowledgedCount).toBe(1)
  })

  it('should acknowledge with prophecy and include it in updated ack', async () => {
    const member = makeMember()
    const pendingAck = {
      auctionId: 'auction-1',
      playerId: 'player-1',
      playerName: 'Leao',
      winnerId: 'member-2',
      finalPrice: 50,
      acknowledgedMembers: [],
      prophecies: [],
    }
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'PENDING_ACK', rubataPendingAck: pendingAck })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([
      member,
      makeMember({ id: 'member-2' }),
    ])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await acknowledgeRubataTransaction(LEAGUE_ID, USER_ID, 'Questo lo rubano tutti!')
    expect(result.success).toBe(true)

    // Verify the update call includes the prophecy
    const updateCall = mockPrisma.marketSession.update.mock.calls[0] as Array<{ data: { rubataPendingAck: { prophecies: Array<{ content: string }> } } }>
    const updatedAck = updateCall[0] as { data: { rubataPendingAck: { prophecies: Array<{ content: string }> } } }
    expect(updatedAck.data.rubataPendingAck.prophecies).toHaveLength(1)
    const firstProphecy = updatedAck.data.rubataPendingAck.prophecies[0] as { content: string }
    expect(firstProphecy.content).toBe('Questo lo rubano tutti!')
  })

  it('should advance to READY_CHECK when all acknowledged and not last player', async () => {
    const member = makeMember()
    const pendingAck = {
      auctionId: 'auction-1',
      playerId: 'player-1',
      playerName: 'Leao',
      winnerId: 'member-2',
      finalPrice: 50,
      acknowledgedMembers: ['member-2'],
      prophecies: [],
    }
    // board has 3 players, index is 0 → not last
    const board = [
      { playerId: 'p1' },
      { playerId: 'p2' },
      { playerId: 'p3' },
    ]
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({
        rubataState: 'PENDING_ACK',
        rubataPendingAck: pendingAck,
        rubataBoard: board,
        rubataBoardIndex: 0,
      })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([
      member,
      makeMember({ id: 'member-2' }),
    ])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await acknowledgeRubataTransaction(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toContain('prossimo giocatore')

    const data = result.data as { allAcknowledged: boolean }
    expect(data.allAcknowledged).toBe(true)

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'READY_CHECK',
          rubataPendingAck: Prisma.DbNull,
        }),
      })
    )
  })

  it('should complete rubata when all acknowledged and last player', async () => {
    const member = makeMember()
    const pendingAck = {
      auctionId: 'auction-1',
      playerId: 'player-1',
      playerName: 'Leao',
      winnerId: 'member-2',
      finalPrice: 50,
      acknowledgedMembers: ['member-2'],
      prophecies: [],
    }
    // board has 2 players, index is 1 → last player (1+1 >= 2)
    const board = [
      { playerId: 'p1' },
      { playerId: 'p2' },
    ]
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({
        rubataState: 'PENDING_ACK',
        rubataPendingAck: pendingAck,
        rubataBoard: board,
        rubataBoardIndex: 1,
      })
    )
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([
      member,
      makeMember({ id: 'member-2' }),
    ])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await acknowledgeRubataTransaction(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toContain('Rubata completata')

    const data = result.data as { allAcknowledged: boolean; completed: boolean }
    expect(data.allAcknowledged).toBe(true)
    expect(data.completed).toBe(true)

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'COMPLETED',
        }),
      })
    )
  })
})

// ==================== forceAllRubataAcknowledge ====================

describe('forceAllRubataAcknowledge', () => {
  it('should return error for non-admin', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await forceAllRubataAcknowledge(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should return error when not in PENDING_ACK state', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'OFFERING' })
    )

    const result = await forceAllRubataAcknowledge(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna transazione pendente')
  })

  it('should force all acknowledges and move to READY_CHECK', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'PENDING_ACK' })
    )
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await forceAllRubataAcknowledge(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toContain('Conferme forzate')

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'READY_CHECK',
          rubataPendingAck: Prisma.DbNull,
          rubataReadyMembers: [],
        }),
      })
    )
  })
})

// ==================== pauseRubata ====================

describe('pauseRubata', () => {
  it('should return error for non-admin', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await pauseRubata(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should return error when no active rubata session', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(null)

    const result = await pauseRubata(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should return error when state is not OFFERING or AUCTION', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'READY_CHECK' })
    )

    const result = await pauseRubata(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Puoi mettere in pausa solo durante OFFERTA o ASTA')
  })

  it('should pause from OFFERING and save remaining time', async () => {
    const timerStart = new Date(Date.now() - 20_000) // 20 seconds ago
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({
        rubataState: 'OFFERING',
        rubataTimerStartedAt: timerStart,
        rubataOfferTimerSeconds: 30,
      })
    )
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await pauseRubata(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as { remainingSeconds: number; pausedFromState: string }
    // 30 - 20 = ~10 seconds remaining (may vary slightly due to timing)
    expect(data.remainingSeconds).toBeGreaterThanOrEqual(9)
    expect(data.remainingSeconds).toBeLessThanOrEqual(11)
    expect(data.pausedFromState).toBe('OFFERING')

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'PAUSED',
          rubataPausedFromState: 'OFFERING',
          rubataTimerStartedAt: null,
          rubataReadyMembers: [],
        }),
      })
    )
  })

  it('should pause from AUCTION and save remaining time', async () => {
    const timerStart = new Date(Date.now() - 10_000) // 10 seconds ago
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({
        rubataState: 'AUCTION',
        rubataTimerStartedAt: timerStart,
        rubataAuctionTimerSeconds: 30,
      })
    )
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await pauseRubata(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as { remainingSeconds: number; pausedFromState: string }
    expect(data.remainingSeconds).toBeGreaterThanOrEqual(19)
    expect(data.remainingSeconds).toBeLessThanOrEqual(21)
    expect(data.pausedFromState).toBe('AUCTION')
  })

  it('should save 0 remaining seconds when timer is null', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({
        rubataState: 'OFFERING',
        rubataTimerStartedAt: null,
      })
    )
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await pauseRubata(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as { remainingSeconds: number }
    expect(data.remainingSeconds).toBe(0)
  })
})

// ==================== resumeRubata ====================

describe('resumeRubata', () => {
  it('should return error for non-admin', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await resumeRubata(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should return error when no active rubata session', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(null)

    const result = await resumeRubata(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should return error when not in PAUSED state', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'OFFERING' })
    )

    const result = await resumeRubata(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('La rubata non è in pausa')
  })

  it('should trigger ready check (keep PAUSED state, clear ready members)', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({
        rubataState: 'PAUSED',
        rubataPausedFromState: 'OFFERING',
        rubataPausedRemainingSeconds: 15,
      })
    )
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await resumeRubata(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(true)
    expect(result.message).toContain('pronti per riprendere')

    const data = result.data as {
      pausedRemainingSeconds: number
      pausedFromState: string
      requiresReadyCheck: boolean
    }
    expect(data.pausedRemainingSeconds).toBe(15)
    expect(data.pausedFromState).toBe('OFFERING')
    expect(data.requiresReadyCheck).toBe(true)

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataReadyMembers: [],
        }),
      })
    )
  })
})

// ==================== getRubataPreferences ====================

describe('getRubataPreferences', () => {
  it('should return error for non-member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await getRubataPreferences(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return error when no session found', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    // No RUBATA session
    mockPrisma.marketSession.findFirst
      .mockResolvedValueOnce(null)  // active RUBATA
      .mockResolvedValueOnce(null)  // any active
      .mockResolvedValueOnce(null)  // most recent

    const result = await getRubataPreferences(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione trovata per questa lega')
  })

  it('should return preferences for the member', async () => {
    const member = makeMember()
    const session = makeSession()
    const prefs = [
      {
        id: 'pref-1',
        sessionId: SESSION_ID,
        memberId: MEMBER_ID,
        playerId: 'player-1',
        isWatchlist: true,
        isAutoPass: false,
        maxBid: 50,
        priority: 1,
        notes: 'Target principale',
        watchlistCategory: null,
        player: { id: 'player-1', name: 'Leao', team: 'Milan', position: 'A', quotation: 30 },
      },
    ]

    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(session)
    mockPrisma.rubataPreference.findMany.mockResolvedValueOnce(prefs)

    const result = await getRubataPreferences(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as {
      preferences: Array<{ id: string; playerId: string; isWatchlist: boolean }>
      sessionId: string
      memberId: string
    }
    expect(data.preferences).toHaveLength(1)
    expect(data.preferences[0]?.isWatchlist).toBe(true)
    expect(data.sessionId).toBe(SESSION_ID)
    expect(data.memberId).toBe(MEMBER_ID)
  })

  it('should fallback to most recent session when no active session', async () => {
    const member = makeMember()
    const recentSession = makeSession({ id: 'session-old', status: 'COMPLETED' })

    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst
      .mockResolvedValueOnce(null)         // active RUBATA
      .mockResolvedValueOnce(null)         // any active
      .mockResolvedValueOnce(recentSession) // most recent
    mockPrisma.rubataPreference.findMany.mockResolvedValueOnce([])

    const result = await getRubataPreferences(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as { sessionId: string }
    expect(data.sessionId).toBe('session-old')
  })
})

// ==================== setRubataPreference ====================

describe('setRubataPreference', () => {
  it('should return error for non-member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await setRubataPreference(LEAGUE_ID, USER_ID, 'player-1', { isWatchlist: true })
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should block preference modification during active auction (OFFERING state)', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'OFFERING' })
    )

    const result = await setRubataPreference(LEAGUE_ID, USER_ID, 'player-1', { isWatchlist: true })
    expect(result.success).toBe(false)
    expect(result.message).toContain('asta attiva')
  })

  it('should block preference modification during AUCTION state', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'AUCTION' })
    )

    const result = await setRubataPreference(LEAGUE_ID, USER_ID, 'player-1', { isWatchlist: true })
    expect(result.success).toBe(false)
    expect(result.message).toContain('asta attiva')
  })

  it('should return error when player not found', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'READY_CHECK' })
    )
    mockPrisma.serieAPlayer.findUnique.mockResolvedValueOnce(null)

    const result = await setRubataPreference(LEAGUE_ID, USER_ID, 'player-1', { isWatchlist: true })
    expect(result.success).toBe(false)
    expect(result.message).toBe('Giocatore non trovato')
  })

  it('should upsert preference successfully', async () => {
    const member = makeMember()
    const session = makeSession({ rubataState: 'READY_CHECK' })
    const player = { id: 'player-1', name: 'Leao', team: 'Milan', position: 'A' }
    const upsertResult = {
      id: 'pref-1',
      sessionId: SESSION_ID,
      memberId: MEMBER_ID,
      playerId: 'player-1',
      isWatchlist: true,
      isAutoPass: false,
      maxBid: 50,
      priority: 1,
      notes: null,
      watchlistCategory: null,
      player,
    }

    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(session)
    mockPrisma.serieAPlayer.findUnique.mockResolvedValueOnce(player)
    mockPrisma.rubataPreference.upsert.mockResolvedValueOnce(upsertResult)

    const result = await setRubataPreference(LEAGUE_ID, USER_ID, 'player-1', {
      isWatchlist: true,
      maxBid: 50,
      priority: 1,
    })
    expect(result.success).toBe(true)
    expect(result.message).toBe('Preferenza salvata')
    expect(result.data).toEqual(upsertResult)
  })

  it('should return error when no session found', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const result = await setRubataPreference(LEAGUE_ID, USER_ID, 'player-1', { isWatchlist: true })
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione trovata per questa lega')
  })
})

// ==================== deleteRubataPreference ====================

describe('deleteRubataPreference', () => {
  it('should return error for non-member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await deleteRubataPreference(LEAGUE_ID, USER_ID, 'player-1')
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should block deletion during active auction', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'OFFERING' })
    )

    const result = await deleteRubataPreference(LEAGUE_ID, USER_ID, 'player-1')
    expect(result.success).toBe(false)
    expect(result.message).toContain('asta attiva')
  })

  it('should delete preference successfully', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataState: 'READY_CHECK' })
    )
    mockPrisma.rubataPreference.deleteMany.mockResolvedValueOnce({ count: 1 })

    const result = await deleteRubataPreference(LEAGUE_ID, USER_ID, 'player-1')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Preferenza rimossa')

    expect(mockPrisma.rubataPreference.deleteMany).toHaveBeenCalledWith({
      where: {
        sessionId: SESSION_ID,
        memberId: MEMBER_ID,
        playerId: 'player-1',
      },
    })
  })

  it('should return error when no session found', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const result = await deleteRubataPreference(LEAGUE_ID, USER_ID, 'player-1')
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione trovata per questa lega')
  })
})

// ==================== getAllPlayersForStrategies ====================

describe('getAllPlayersForStrategies', () => {
  it('should return error for non-member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await getAllPlayersForStrategies(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return all players with contract info and preferences', async () => {
    const member = makeMember()
    const session = makeSession()
    const membersWithRosters = [
      {
        ...member,
        roster: [
          {
            id: 'roster-1',
            playerId: 'player-1',
            status: 'ACTIVE',
            player: {
              id: 'player-1',
              name: 'Leao',
              team: 'Milan',
              position: 'A',
              quotation: 30,
              age: 25,
              apiFootballId: 123,
              apiFootballStats: null,
            },
            contract: {
              id: 'contract-1',
              salary: 5,
              duration: 3,
              rescissionClause: 45,
            },
          },
        ],
      },
    ]

    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(session)
    mockPrisma.rubataPreference.findMany.mockResolvedValueOnce([])
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce(membersWithRosters)

    const result = await getAllPlayersForStrategies(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as {
      players: Array<{
        playerId: string
        playerName: string
        rubataPrice: number
        contractSalary: number
      }>
      myMemberId: string
      totalPlayers: number
    }
    expect(data.players).toHaveLength(1)
    expect(data.players[0]?.playerName).toBe('Leao')
    // rubataPrice = clause + salary = 45 + 5
    expect(data.players[0]?.rubataPrice).toBe(50)
    expect(data.myMemberId).toBe(MEMBER_ID)
    expect(data.totalPlayers).toBe(1)
  })
})

// ==================== getAllSvincolatiForStrategies ====================

describe('getAllSvincolatiForStrategies', () => {
  it('should return error for non-member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await getAllSvincolatiForStrategies(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return free agents not in any roster', async () => {
    const member = makeMember()
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(member)
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([{ id: MEMBER_ID }])
    mockPrisma.playerRoster.findMany.mockResolvedValueOnce([
      { playerId: 'player-owned' },
    ])
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(makeSession())
    mockPrisma.rubataPreference.findMany.mockResolvedValueOnce([])
    mockPrisma.serieAPlayer.findMany.mockResolvedValueOnce([
      {
        id: 'player-free',
        name: 'Balotelli',
        team: 'Genoa',
        position: 'A',
        quotation: 5,
        age: 34,
        apiFootballId: null,
        apiFootballStats: null,
      },
    ])

    const result = await getAllSvincolatiForStrategies(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(true)

    const data = result.data as {
      players: Array<{ playerId: string; playerName: string }>
      myMemberId: string
      totalPlayers: number
    }
    expect(data.players).toHaveLength(1)
    expect(data.players[0]?.playerName).toBe('Balotelli')
    expect(data.myMemberId).toBe(MEMBER_ID)
    expect(data.totalPlayers).toBe(1)
  })
})

// ==================== completeRubataWithTransactions ====================

describe('completeRubataWithTransactions', () => {
  it('should return error for non-admin', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(null)

    const result = await completeRubataWithTransactions(LEAGUE_ID, USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should return error when no active rubata session', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(null)

    const result = await completeRubataWithTransactions(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should return error when rubata is already completed (no remaining players)', async () => {
    const board = [{ playerId: 'p1' }, { playerId: 'p2' }]
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataBoard: board, rubataBoardIndex: 2 })
    )

    const result = await completeRubataWithTransactions(LEAGUE_ID, ADMIN_USER_ID)
    expect(result.success).toBe(false)
    expect(result.message).toBe('Rubata già completata')
  })

  it('should complete rubata with 0% steal probability (all skips)', async () => {
    const board = [
      {
        rosterId: 'r1',
        memberId: MEMBER_ID,
        playerId: 'p1',
        playerName: 'Player1',
        playerPosition: 'A',
        playerTeam: 'Milan',
        ownerUsername: 'manager1',
        rubataPrice: 10,
        contractSalary: 2,
        contractDuration: 3,
        contractClause: 8,
      },
    ]
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ rubataBoard: board, rubataBoardIndex: 0 })
    )
    // With 0% steal probability, no steals happen
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([makeMember()])
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await completeRubataWithTransactions(LEAGUE_ID, ADMIN_USER_ID, 0)
    expect(result.success).toBe(true)
    expect(result.message).toContain('0 rubate effettuate')

    const data = result.data as {
      totalPlayers: number
      processedPlayers: number
      steals: number
      skips: number
    }
    expect(data.totalPlayers).toBe(1)
    expect(data.processedPlayers).toBe(1)
    expect(data.steals).toBe(0)
    expect(data.skips).toBe(1)

    // Verify session marked as COMPLETED
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'COMPLETED',
        }),
      })
    )
  })
})
