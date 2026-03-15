/**
 * Unit tests for rubata heartbeat, connection status, and setup/config functions.
 *
 * Covers:
 * - registerRubataHeartbeat (in-memory Map)
 * - getRubataConnectionStatus (timeout logic at 45s)
 * - clearRubataHeartbeats (cleanup)
 * - setRubataOrder (admin-only, order validation, DB transaction)
 * - getRubataOrder (membership check, ordered members)
 * - getCurrentRubataTurn (phase check, turn resolution)
 * - updateRubataTimers (admin-only, timer config)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ==================== MOCK SETUP ====================

const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    leagueMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    marketSession: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auction: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: typeof mock) => Promise<unknown>) => cb(mock)),
  }
  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock
  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  MemberStatus: { ACTIVE: 'ACTIVE', PENDING: 'PENDING', KICKED: 'KICKED' },
  RosterStatus: { ACTIVE: 'ACTIVE' },
  AuctionStatus: { ACTIVE: 'ACTIVE', PENDING: 'PENDING' },
  Prisma: { JsonNull: null },
}))

vi.mock('../services/movement.service', () => ({ recordMovement: vi.fn() }))
vi.mock('../services/pusher.service', () => ({
  triggerRubataBidPlaced: vi.fn(),
  triggerRubataStealDeclared: vi.fn(),
  triggerRubataReadyChanged: vi.fn(),
  triggerAuctionClosed: vi.fn(),
}))
vi.mock('../services/player-stats.service', () => ({
  computeSeasonStatsBatch: vi.fn().mockResolvedValue([]),
  computeAutoTagsBatch: vi.fn().mockResolvedValue([]),
}))

import {
  registerRubataHeartbeat,
  getRubataConnectionStatus,
  clearRubataHeartbeats,
  setRubataOrder,
  getRubataOrder,
  getCurrentRubataTurn,
  updateRubataTimers,
} from '../services/rubata.service'

// ==================== FIXTURES ====================

const LEAGUE_ID = 'league-1'
const ADMIN_USER_ID = 'admin-user-id'
const USER_ID = 'user-1'
const MEMBER_1_ID = 'member-1'
const MEMBER_2_ID = 'member-2'
const ADMIN_MEMBER_ID = 'admin-member'

const adminMember = {
  id: ADMIN_MEMBER_ID,
  leagueId: LEAGUE_ID,
  userId: ADMIN_USER_ID,
  role: 'ADMIN',
  status: 'ACTIVE',
  teamName: 'Admin FC',
  user: { username: 'admin' },
}

const member1 = {
  id: MEMBER_1_ID,
  leagueId: LEAGUE_ID,
  userId: USER_ID,
  role: 'MANAGER',
  status: 'ACTIVE',
  teamName: 'Team Uno',
  rubataOrder: 1,
  currentBudget: 100,
  user: { username: 'user1' },
}

const member2 = {
  id: MEMBER_2_ID,
  leagueId: LEAGUE_ID,
  userId: 'user-2',
  role: 'MANAGER',
  status: 'ACTIVE',
  teamName: 'Team Due',
  rubataOrder: 2,
  currentBudget: 200,
  user: { username: 'user2' },
}

const activeSession = {
  id: 'session-1',
  leagueId: LEAGUE_ID,
  status: 'ACTIVE',
  currentPhase: 'RUBATA',
  rubataOrder: [MEMBER_1_ID, MEMBER_2_ID, ADMIN_MEMBER_ID],
  rubataOfferTimerSeconds: 30,
  rubataAuctionTimerSeconds: 60,
}

// ==================== HEARTBEAT FUNCTIONS ====================

describe('registerRubataHeartbeat', () => {
  beforeEach(() => {
    clearRubataHeartbeats(LEAGUE_ID)
    clearRubataHeartbeats('other-league')
  })

  it('should register a heartbeat for a member in a league', () => {
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)

    const status = getRubataConnectionStatus(LEAGUE_ID)
    expect(status.get(MEMBER_1_ID)).toBe(true)
  })

  it('should create a new league map if it does not exist', () => {
    registerRubataHeartbeat('new-league', MEMBER_1_ID)

    const status = getRubataConnectionStatus('new-league')
    expect(status.size).toBe(1)
    expect(status.get(MEMBER_1_ID)).toBe(true)

    clearRubataHeartbeats('new-league')
  })

  it('should update the timestamp when called multiple times', () => {
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)

    const status = getRubataConnectionStatus(LEAGUE_ID)
    expect(status.size).toBe(1)
    expect(status.get(MEMBER_1_ID)).toBe(true)
  })

  it('should track multiple members independently', () => {
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_2_ID)

    const status = getRubataConnectionStatus(LEAGUE_ID)
    expect(status.size).toBe(2)
    expect(status.get(MEMBER_1_ID)).toBe(true)
    expect(status.get(MEMBER_2_ID)).toBe(true)
  })
})

describe('getRubataConnectionStatus', () => {
  beforeEach(() => {
    clearRubataHeartbeats(LEAGUE_ID)
  })

  it('should return empty map for unknown league', () => {
    const status = getRubataConnectionStatus('nonexistent-league')
    expect(status.size).toBe(0)
  })

  it('should return true for recently registered heartbeats', () => {
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)

    const status = getRubataConnectionStatus(LEAGUE_ID)
    expect(status.get(MEMBER_1_ID)).toBe(true)
  })

  it('should return false for heartbeats older than 45 seconds', () => {
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)

    // Advance Date.now() by 46 seconds to exceed the 45s threshold
    const originalNow = Date.now
    const frozenTime = originalNow()
    vi.spyOn(Date, 'now').mockReturnValue(frozenTime + 46000)

    const status = getRubataConnectionStatus(LEAGUE_ID)
    expect(status.get(MEMBER_1_ID)).toBe(false)

    // Restore
    vi.spyOn(Date, 'now').mockRestore()
  })

  it('should return true for heartbeats within 45 seconds', () => {
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)

    const originalNow = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(originalNow + 44000)

    const status = getRubataConnectionStatus(LEAGUE_ID)
    expect(status.get(MEMBER_1_ID)).toBe(true)

    vi.spyOn(Date, 'now').mockRestore()
  })

  it('should show mixed connected/disconnected status', () => {
    // Register member1 first, then advance time, then register member2
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)

    const baseTime = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 46000)

    // Member2 registers after the time shift (so it's "recent" at the shifted time)
    // We need to mock Date.now for registerRubataHeartbeat to use the shifted time
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_2_ID)

    const status = getRubataConnectionStatus(LEAGUE_ID)
    expect(status.get(MEMBER_1_ID)).toBe(false)
    expect(status.get(MEMBER_2_ID)).toBe(true)

    vi.spyOn(Date, 'now').mockRestore()
  })
})

describe('clearRubataHeartbeats', () => {
  it('should remove all heartbeats for a league', () => {
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_2_ID)

    clearRubataHeartbeats(LEAGUE_ID)

    const status = getRubataConnectionStatus(LEAGUE_ID)
    expect(status.size).toBe(0)
  })

  it('should not affect other leagues', () => {
    registerRubataHeartbeat(LEAGUE_ID, MEMBER_1_ID)
    registerRubataHeartbeat('other-league', MEMBER_2_ID)

    clearRubataHeartbeats(LEAGUE_ID)

    const status = getRubataConnectionStatus('other-league')
    expect(status.size).toBe(1)
    expect(status.get(MEMBER_2_ID)).toBe(true)

    clearRubataHeartbeats('other-league')
  })

  it('should be safe to call on nonexistent league', () => {
    expect(() => {
      clearRubataHeartbeats('nonexistent')
    }).not.toThrow()
  })
})

// ==================== setRubataOrder ====================

describe('setRubataOrder', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma))
  })

  it('should set order successfully when admin provides valid member list', async () => {
    const activeMembers = [adminMember, member1, member2]
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.leagueMember.findMany.mockResolvedValue(activeMembers)
    mockPrisma.marketSession.findFirst.mockResolvedValue(activeSession)

    const order = [ADMIN_MEMBER_ID, MEMBER_1_ID, MEMBER_2_ID]
    const result = await setRubataOrder(LEAGUE_ID, ADMIN_USER_ID, order)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Ordine rubata impostato')
    const data = result.data as { order: string[] }
    expect(data.order).toEqual(order)
  })

  it('should reject when caller is not admin', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await setRubataOrder(LEAGUE_ID, 'random-user', [MEMBER_1_ID])

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should reject when order contains invalid member ids', async () => {
    const activeMembers = [adminMember, member1, member2]
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.leagueMember.findMany.mockResolvedValue(activeMembers)
    mockPrisma.marketSession.findFirst.mockResolvedValue(activeSession)

    const order = [ADMIN_MEMBER_ID, MEMBER_1_ID, 'invalid-member']
    const result = await setRubataOrder(LEAGUE_ID, ADMIN_USER_ID, order)

    expect(result.success).toBe(false)
    expect(result.message).toContain('non valido')
  })

  it('should reject when order has wrong number of members', async () => {
    const activeMembers = [adminMember, member1, member2]
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.leagueMember.findMany.mockResolvedValue(activeMembers)
    mockPrisma.marketSession.findFirst.mockResolvedValue(activeSession)

    // Only 2 out of 3 active members
    const order = [ADMIN_MEMBER_ID, MEMBER_1_ID]
    const result = await setRubataOrder(LEAGUE_ID, ADMIN_USER_ID, order)

    expect(result.success).toBe(false)
    expect(result.message).toContain('non valido')
  })

  it('should reject when no active session exists', async () => {
    const activeMembers = [adminMember, member1, member2]
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.leagueMember.findMany.mockResolvedValue(activeMembers)
    mockPrisma.marketSession.findFirst.mockResolvedValue(null)

    const order = [ADMIN_MEMBER_ID, MEMBER_1_ID, MEMBER_2_ID]
    const result = await setRubataOrder(LEAGUE_ID, ADMIN_USER_ID, order)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione di mercato attiva')
  })

  it('should call $transaction to update session and member order', async () => {
    const activeMembers = [adminMember, member1, member2]
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.leagueMember.findMany.mockResolvedValue(activeMembers)
    mockPrisma.marketSession.findFirst.mockResolvedValue(activeSession)

    const order = [MEMBER_2_ID, MEMBER_1_ID, ADMIN_MEMBER_ID]
    await setRubataOrder(LEAGUE_ID, ADMIN_USER_ID, order)

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    // Verify session update was called with the order
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: activeSession.id },
        data: { rubataOrder: order },
      })
    )
    // Verify each member got their rubataOrder index (1-based)
    expect(mockPrisma.leagueMember.update).toHaveBeenCalledTimes(3)
    expect(mockPrisma.leagueMember.update).toHaveBeenCalledWith({
      where: { id: MEMBER_2_ID },
      data: { rubataOrder: 1 },
    })
    expect(mockPrisma.leagueMember.update).toHaveBeenCalledWith({
      where: { id: MEMBER_1_ID },
      data: { rubataOrder: 2 },
    })
    expect(mockPrisma.leagueMember.update).toHaveBeenCalledWith({
      where: { id: ADMIN_MEMBER_ID },
      data: { rubataOrder: 3 },
    })
  })
})

// ==================== getRubataOrder ====================

describe('getRubataOrder', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return ordered members when user is a league member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(member1)
    mockPrisma.leagueMember.findMany.mockResolvedValue([member1, member2, adminMember])

    const result = await getRubataOrder(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(true)
    const data = result.data as Array<{
      id: string
      username: string
      teamName: string
      rubataOrder: number
      currentBudget: number
    }>
    expect(data).toHaveLength(3)
    const firstMember = data[0] as { id: string; username: string; teamName: string; rubataOrder: number; currentBudget: number }
    expect(firstMember.id).toBe(MEMBER_1_ID)
    expect(firstMember.username).toBe('user1')
    expect(firstMember.teamName).toBe('Team Uno')
  })

  it('should reject when user is not a member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await getRubataOrder(LEAGUE_ID, 'stranger')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })
})

// ==================== getCurrentRubataTurn ====================

describe('getCurrentRubataTurn', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return current turn info when in RUBATA phase', async () => {
    // First call: membership check
    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(member1) // membership check
      .mockResolvedValueOnce(activeSession) // isInRubataPhase (marketSession.findFirst)

    // isInRubataPhase calls marketSession.findFirst
    mockPrisma.marketSession.findFirst
      .mockResolvedValueOnce(activeSession) // isInRubataPhase
      .mockResolvedValueOnce(activeSession) // main session query

    // findUnique for current turn member
    mockPrisma.leagueMember.findUnique.mockResolvedValue(member1)

    // No active auction
    mockPrisma.auction.findFirst.mockResolvedValue(null)

    const result = await getCurrentRubataTurn(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(true)
    const data = result.data as {
      currentTurn: { memberId: string; username: string; teamName: string } | null
      activeAuction: unknown
      isMyTurn: boolean
    }
    expect(data.currentTurn).not.toBeNull()
    expect(data.currentTurn?.memberId).toBe(MEMBER_1_ID)
    expect(data.currentTurn?.username).toBe('user1')
    expect(data.isMyTurn).toBe(true)
  })

  it('should reject when user is not a member', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await getCurrentRubataTurn(LEAGUE_ID, 'stranger')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should reject when not in RUBATA phase', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(member1)
    // isInRubataPhase returns null (no active RUBATA session)
    mockPrisma.marketSession.findFirst.mockResolvedValue(null)

    const result = await getCurrentRubataTurn(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non siamo in fase RUBATA')
  })

  it('should reject when rubata order is not set', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(member1)
    const sessionNoOrder = { ...activeSession, rubataOrder: null }
    mockPrisma.marketSession.findFirst
      .mockResolvedValueOnce(activeSession) // isInRubataPhase
      .mockResolvedValueOnce(sessionNoOrder) // main query

    const result = await getCurrentRubataTurn(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Ordine rubata non impostato')
  })

  it('should set isMyTurn to false when it is not the user turn', async () => {
    // member2 is checking, but member1 is first in order
    mockPrisma.leagueMember.findFirst.mockResolvedValue(member2)
    mockPrisma.marketSession.findFirst
      .mockResolvedValueOnce(activeSession) // isInRubataPhase
      .mockResolvedValueOnce(activeSession) // main query
    mockPrisma.leagueMember.findUnique.mockResolvedValue(member1) // current turn is member1
    mockPrisma.auction.findFirst.mockResolvedValue(null)

    const result = await getCurrentRubataTurn(LEAGUE_ID, 'user-2')

    expect(result.success).toBe(true)
    const data = result.data as { isMyTurn: boolean }
    expect(data.isMyTurn).toBe(false)
  })
})

// ==================== updateRubataTimers ====================

describe('updateRubataTimers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should update both timers when admin provides them', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.marketSession.findFirst.mockResolvedValue(activeSession)
    mockPrisma.marketSession.update.mockResolvedValue({
      ...activeSession,
      rubataOfferTimerSeconds: 45,
      rubataAuctionTimerSeconds: 90,
    })

    const result = await updateRubataTimers(LEAGUE_ID, ADMIN_USER_ID, 45, 90)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Timer aggiornati')
    const data = result.data as { offerTimerSeconds: number; auctionTimerSeconds: number }
    expect(data.offerTimerSeconds).toBe(45)
    expect(data.auctionTimerSeconds).toBe(90)

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith({
      where: { id: activeSession.id },
      data: {
        rubataOfferTimerSeconds: 45,
        rubataAuctionTimerSeconds: 90,
      },
    })
  })

  it('should update only offerTimer when auctionTimer is omitted', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.marketSession.findFirst.mockResolvedValue(activeSession)
    mockPrisma.marketSession.update.mockResolvedValue(activeSession)

    const result = await updateRubataTimers(LEAGUE_ID, ADMIN_USER_ID, 20, undefined)

    expect(result.success).toBe(true)
    const data = result.data as { offerTimerSeconds: number; auctionTimerSeconds: number }
    expect(data.offerTimerSeconds).toBe(20)
    // Falls back to session value when not provided
    expect(data.auctionTimerSeconds).toBe(activeSession.rubataAuctionTimerSeconds)

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith({
      where: { id: activeSession.id },
      data: { rubataOfferTimerSeconds: 20 },
    })
  })

  it('should update only auctionTimer when offerTimer is omitted', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.marketSession.findFirst.mockResolvedValue(activeSession)
    mockPrisma.marketSession.update.mockResolvedValue(activeSession)

    const result = await updateRubataTimers(LEAGUE_ID, ADMIN_USER_ID, undefined, 120)

    expect(result.success).toBe(true)
    const data = result.data as { offerTimerSeconds: number; auctionTimerSeconds: number }
    expect(data.offerTimerSeconds).toBe(activeSession.rubataOfferTimerSeconds)
    expect(data.auctionTimerSeconds).toBe(120)

    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith({
      where: { id: activeSession.id },
      data: { rubataAuctionTimerSeconds: 120 },
    })
  })

  it('should reject when caller is not admin', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await updateRubataTimers(LEAGUE_ID, 'random-user', 30, 60)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should reject when no active session exists', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.marketSession.findFirst.mockResolvedValue(null)

    const result = await updateRubataTimers(LEAGUE_ID, ADMIN_USER_ID, 30, 60)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione attiva')
  })

  it('should send empty update data when both timers are omitted', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)
    mockPrisma.marketSession.findFirst.mockResolvedValue(activeSession)
    mockPrisma.marketSession.update.mockResolvedValue(activeSession)

    const result = await updateRubataTimers(LEAGUE_ID, ADMIN_USER_ID, undefined, undefined)

    expect(result.success).toBe(true)
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith({
      where: { id: activeSession.id },
      data: {},
    })
  })
})
