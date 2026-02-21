/**
 * Bug reproduction: setRubataOrder rejects when orderDraft includes non-ACTIVE members.
 *
 * The frontend (useRubataState) builds orderDraft from ALL members returned by
 * leagueApi.getMembers(), which includes PENDING/KICKED members. But setRubataOrder()
 * validates against only ACTIVE members, causing a 400 "Ordine non valido".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    leagueMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    marketSession: {
      findFirst: vi.fn(),
      update: vi.fn(),
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
  AuctionStatus: { ACTIVE: 'ACTIVE' },
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
  computeSeasonStatsBatch: vi.fn(),
  computeAutoTagsBatch: vi.fn(),
}))

import { setRubataOrder } from '../services/rubata.service'

describe('setRubataOrder bug: non-ACTIVE members in order', () => {
  const leagueId = 'league1'
  const adminUserId = 'admin-user'

  const activeMember1 = { id: 'member1', leagueId, userId: 'user1', role: 'MANAGER', status: 'ACTIVE' }
  const activeMember2 = { id: 'member2', leagueId, userId: 'user2', role: 'MANAGER', status: 'ACTIVE' }
  const adminMember = { id: 'admin-member', leagueId, userId: adminUserId, role: 'ADMIN', status: 'ACTIVE' }
  const pendingMember = { id: 'pending-member', leagueId, userId: 'user3', role: 'MANAGER', status: 'PENDING' }

  const activeSession = { id: 'session1', leagueId, status: 'ACTIVE' }

  beforeEach(() => {
    vi.clearAllMocks()

    // Admin is valid
    mockPrisma.leagueMember.findFirst.mockResolvedValue(adminMember)

    // Active session exists
    mockPrisma.marketSession.findFirst.mockResolvedValue(activeSession)
  })

  it('should reject order that includes a PENDING member (BUG REPRODUCTION)', async () => {
    // getMembers returns ALL members (including PENDING) — this is what the frontend receives
    const allMembers = [activeMember1, activeMember2, adminMember, pendingMember]

    // But setRubataOrder only validates against ACTIVE members
    mockPrisma.leagueMember.findMany.mockResolvedValue(
      allMembers.filter(m => m.status === 'ACTIVE')
    )

    // The frontend sends ALL member IDs (the bug)
    const orderFromFrontend = allMembers.map(m => m.id)

    const result = await setRubataOrder(leagueId, adminUserId, orderFromFrontend)

    // This currently returns 400 "Ordine non valido"
    expect(result.success).toBe(false)
    expect(result.message).toContain('non valido')
  })

  it('should accept order with only ACTIVE members (expected behavior after fix)', async () => {
    const activeMembers = [activeMember1, activeMember2, adminMember]

    mockPrisma.leagueMember.findMany.mockResolvedValue(activeMembers)

    // After the fix, frontend should only send ACTIVE member IDs
    const orderFromFrontend = activeMembers.map(m => m.id)

    const result = await setRubataOrder(leagueId, adminUserId, orderFromFrontend)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Ordine rubata impostato')
  })
})
