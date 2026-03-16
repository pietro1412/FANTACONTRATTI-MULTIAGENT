/**
 * Unit tests for rubata board generation, start, status, preview, and state functions.
 *
 * Functions under test:
 *   - generateRubataBoard
 *   - startRubata
 *   - getRubataBoard (with auto-advance / auto-close)
 *   - getRubataStatus
 *   - getRubataPreviewBoard
 *   - setRubataToPreview
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ----

const prismaMock = vi.hoisted(() => ({
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
  playerRoster: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  playerContract: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  auction: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  auctionBid: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  rubataPreference: {
    findMany: vi.fn(),
  },
  serieAPlayer: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      marketSession: { update: vi.fn() },
      leagueMember: { update: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
      playerRoster: { update: vi.fn(), findFirst: vi.fn() },
      playerContract: { update: vi.fn() },
      auction: { update: vi.fn() },
    })
  ),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/services/movement.service', () => ({ recordMovement: vi.fn() }))

vi.mock('@/services/pusher.service', () => ({
  triggerRubataBidPlaced: vi.fn(),
  triggerRubataStealDeclared: vi.fn(),
  triggerRubataReadyChanged: vi.fn(),
  triggerAuctionClosed: vi.fn(),
}))

vi.mock('@/services/player-stats.service', () => ({
  computeSeasonStatsBatch: vi.fn().mockResolvedValue(new Map()),
  computeAutoTagsBatch: vi.fn().mockResolvedValue(new Map()),
}))

import {
  generateRubataBoard,
  startRubata,
  getRubataBoard,
  getRubataStatus,
  getRubataPreviewBoard,
  setRubataToPreview,
} from '@/services/rubata.service'

// ---- Helpers ----

const LEAGUE_ID = 'league-1'
const ADMIN_USER_ID = 'admin-user-1'
const MEMBER_USER_ID = 'member-user-1'
const SESSION_ID = 'session-1'

function makeAdminMember(overrides?: Record<string, unknown>) {
  return {
    id: 'admin-member-1',
    leagueId: LEAGUE_ID,
    userId: ADMIN_USER_ID,
    role: 'ADMIN',
    status: 'ACTIVE',
    teamName: 'Admin FC',
    ...overrides,
  }
}

function makeMember(overrides?: Record<string, unknown>) {
  return {
    id: 'member-1',
    leagueId: LEAGUE_ID,
    userId: MEMBER_USER_ID,
    role: 'MANAGER',
    status: 'ACTIVE',
    teamName: 'Test FC',
    ...overrides,
  }
}

function makeSession(overrides?: Record<string, unknown>) {
  return {
    id: SESSION_ID,
    leagueId: LEAGUE_ID,
    status: 'ACTIVE',
    currentPhase: 'RUBATA',
    rubataOrder: ['member-1', 'member-2'],
    rubataBoard: null,
    rubataBoardIndex: 0,
    rubataState: null,
    rubataTimerStartedAt: null,
    rubataOfferTimerSeconds: 60,
    rubataAuctionTimerSeconds: 30,
    rubataReadyMembers: [],
    rubataPendingAck: null,
    rubataPausedRemainingSeconds: null,
    rubataPausedFromState: null,
    rubataAuctionReadyInfo: null,
    ...overrides,
  }
}

function makeRosterEntry(
  memberId: string,
  playerName: string,
  position: string,
  salary: number,
  duration: number,
  clause: number
) {
  return {
    id: `roster-${playerName}`,
    leagueMemberId: memberId,
    playerId: `player-${playerName}`,
    status: 'ACTIVE',
    player: {
      id: `player-${playerName}`,
      name: playerName,
      position,
      team: 'TeamA',
      quotation: 10,
      age: 25,
      apiFootballId: null,
      apiFootballStats: null,
    },
    contract: {
      id: `contract-${playerName}`,
      leagueMemberId: memberId,
      salary,
      duration,
      rescissionClause: clause,
    },
  }
}

function makeBoardItem(
  playerName: string,
  memberId: string,
  position: string,
  salary: number,
  clause: number
) {
  return {
    rosterId: `roster-${playerName}`,
    memberId,
    playerId: `player-${playerName}`,
    playerName,
    playerPosition: position,
    playerTeam: 'TeamA',
    playerQuotation: 10,
    playerAge: 25,
    playerApiFootballId: null,
    playerApiFootballStats: null,
    ownerUsername: 'owner',
    ownerTeamName: 'Owner FC',
    rubataPrice: clause + salary,
    contractSalary: salary,
    contractDuration: 3,
    contractClause: clause,
  }
}

// ---- Tests ----

beforeEach(() => {
  vi.clearAllMocks()
})

// ==================== generateRubataBoard ====================

describe('generateRubataBoard', () => {
  it('should return error when user is not admin', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(null)

    const result = await generateRubataBoard(LEAGUE_ID, 'non-admin')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should return error when no active rubata session exists', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(null)

    const result = await generateRubataBoard(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should return error when rubataOrder is not set', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataOrder: null })
    )

    const result = await generateRubataBoard(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Ordine rubata non impostato')
  })

  it('should generate board sorted by manager order then position then name', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())

    const session = makeSession({ rubataOrder: ['member-1', 'member-2'] })
    prismaMock.marketSession.findFirst.mockResolvedValue(session)

    // Member 1 roster: two players (A before D in alphabet, but D comes first in position order)
    const member1 = {
      id: 'member-1',
      user: { username: 'user1' },
      teamName: 'Team1',
      roster: [
        makeRosterEntry('member-1', 'Zielinski', 'C', 5, 3, 45),
        makeRosterEntry('member-1', 'Bastoni', 'D', 3, 2, 21),
        makeRosterEntry('member-1', 'Acerbi', 'D', 2, 1, 6),
      ],
    }

    // Member 2 roster: goalkeeper and attacker
    const member2 = {
      id: 'member-2',
      user: { username: 'user2' },
      teamName: 'Team2',
      roster: [
        makeRosterEntry('member-2', 'Vlahovic', 'A', 10, 4, 110),
        makeRosterEntry('member-2', 'Donnarumma', 'P', 8, 3, 72),
      ],
    }

    prismaMock.leagueMember.findUnique
      .mockResolvedValueOnce(member1)
      .mockResolvedValueOnce(member2)

    prismaMock.marketSession.update.mockResolvedValue({})

    const result = await generateRubataBoard(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)

    const data = result.data as { board: Array<{ playerName: string; playerPosition: string; memberId: string; rubataPrice: number }>; totalPlayers: number }

    expect(data.totalPlayers).toBe(5)

    // Member 1 players first (rubataOrder index 0), sorted by position then name
    // D: Acerbi, Bastoni (alphabetical)
    // C: Zielinski
    type BoardEntry = { playerName: string; playerPosition: string; memberId: string }
    const b0 = data.board[0] as BoardEntry
    const b1 = data.board[1] as BoardEntry
    const b2 = data.board[2] as BoardEntry
    const b3 = data.board[3] as BoardEntry
    const b4 = data.board[4] as BoardEntry
    expect(b0.playerName).toBe('Acerbi')
    expect(b0.playerPosition).toBe('D')
    expect(b0.memberId).toBe('member-1')
    expect(b1.playerName).toBe('Bastoni')
    expect(b1.playerPosition).toBe('D')
    expect(b2.playerName).toBe('Zielinski')
    expect(b2.playerPosition).toBe('C')

    // Member 2 players next, sorted by position then name
    // P: Donnarumma
    // A: Vlahovic
    expect(b3.playerName).toBe('Donnarumma')
    expect(b3.playerPosition).toBe('P')
    expect(b3.memberId).toBe('member-2')
    expect(b4.playerName).toBe('Vlahovic')
    expect(b4.playerPosition).toBe('A')
  })

  it('should calculate rubataPrice as clausola + salary', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataOrder: ['member-1'] })
    )

    const member1 = {
      id: 'member-1',
      user: { username: 'user1' },
      teamName: 'Team1',
      roster: [
        makeRosterEntry('member-1', 'TestPlayer', 'C', 5, 3, 45),
      ],
    }

    prismaMock.leagueMember.findUnique.mockResolvedValueOnce(member1)
    prismaMock.marketSession.update.mockResolvedValue({})

    const result = await generateRubataBoard(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)

    const data = result.data as { board: Array<{ rubataPrice: number; contractSalary: number; contractClause: number }> }
    const firstPlayer = data.board[0] as { rubataPrice: number; contractSalary: number; contractClause: number }
    // rubataPrice = clause(45) + salary(5) = 50
    expect(firstPlayer.rubataPrice).toBe(50)
    expect(firstPlayer.contractSalary).toBe(5)
    expect(firstPlayer.contractClause).toBe(45)
  })

  it('should filter out players with duration 0 (expired contracts)', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataOrder: ['member-1'] })
    )

    const member1 = {
      id: 'member-1',
      user: { username: 'user1' },
      teamName: 'Team1',
      roster: [
        makeRosterEntry('member-1', 'Active', 'C', 5, 3, 45),
        makeRosterEntry('member-1', 'Expired', 'D', 2, 0, 6), // duration=0
      ],
    }

    prismaMock.leagueMember.findUnique.mockResolvedValueOnce(member1)
    prismaMock.marketSession.update.mockResolvedValue({})

    const result = await generateRubataBoard(LEAGUE_ID, ADMIN_USER_ID)

    const data = result.data as { board: Array<{ playerName: string }>; totalPlayers: number }
    expect(data.totalPlayers).toBe(1)
    const firstEntry = data.board[0] as { playerName: string }
    expect(firstEntry.playerName).toBe('Active')
  })

  it('should set rubataState to READY_CHECK after generation', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataOrder: ['member-1'] })
    )

    const member1 = {
      id: 'member-1',
      user: { username: 'user1' },
      teamName: 'Team1',
      roster: [makeRosterEntry('member-1', 'Player1', 'P', 3, 2, 9)],
    }

    prismaMock.leagueMember.findUnique.mockResolvedValueOnce(member1)
    prismaMock.marketSession.update.mockResolvedValue({})

    await generateRubataBoard(LEAGUE_ID, ADMIN_USER_ID)

    expect(prismaMock.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'READY_CHECK',
          rubataBoardIndex: 0,
          rubataReadyMembers: [],
        }),
      })
    )
  })

  it('should skip members that are not found', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataOrder: ['member-1', 'ghost-member'] })
    )

    const member1 = {
      id: 'member-1',
      user: { username: 'user1' },
      teamName: 'Team1',
      roster: [makeRosterEntry('member-1', 'Player1', 'P', 3, 2, 9)],
    }

    prismaMock.leagueMember.findUnique
      .mockResolvedValueOnce(member1)
      .mockResolvedValueOnce(null) // ghost member

    prismaMock.marketSession.update.mockResolvedValue({})

    const result = await generateRubataBoard(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)
    const data = result.data as { totalPlayers: number }
    expect(data.totalPlayers).toBe(1)
  })
})

// ==================== startRubata ====================

describe('startRubata', () => {
  it('should return error when user is not admin', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(null)

    const result = await startRubata(LEAGUE_ID, 'non-admin')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should return error when no active rubata session', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(null)

    const result = await startRubata(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should return error when board is not generated', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: null })
    )

    const result = await startRubata(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Tabellone rubata non generato')
  })

  it('should return error when board is empty', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: [] })
    )

    const result = await startRubata(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Tabellone vuoto')
  })

  it('should set state to OFFERING with index 0 and start timer', async () => {
    const board = [makeBoardItem('Player1', 'member-1', 'P', 3, 9)]

    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: board })
    )
    prismaMock.marketSession.update.mockResolvedValue({})

    const result = await startRubata(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Rubata avviata')

    const data = result.data as { currentIndex: number }
    expect(data.currentIndex).toBe(0)

    expect(prismaMock.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataBoardIndex: 0,
          rubataState: 'OFFERING',
          rubataTimerStartedAt: expect.any(Date),
        }),
      })
    )
  })
})

// ==================== getRubataBoard ====================

describe('getRubataBoard', () => {
  it('should return error when user is not a member', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(null)

    const result = await getRubataBoard(LEAGUE_ID, 'unknown-user')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return error when no active session', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(null)

    const result = await getRubataBoard(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione attiva')
  })

  it('should return board data for valid member with active session', async () => {
    const board = [
      makeBoardItem('Donnarumma', 'member-1', 'P', 8, 72),
      makeBoardItem('Bastoni', 'member-1', 'D', 3, 21),
    ]
    const session = makeSession({
      rubataBoard: board,
      rubataState: 'READY_CHECK',
      rubataBoardIndex: 0,
    })

    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(session)
    prismaMock.auction.findFirst.mockResolvedValue(null)
    prismaMock.leagueMember.findMany.mockResolvedValue([
      {
        id: 'member-1',
        teamName: 'Team1',
        currentBudget: 200,
        user: { username: 'user1' },
        contracts: [{ salary: 8 }, { salary: 3 }],
      },
    ])

    const result = await getRubataBoard(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(true)

    const data = result.data as {
      isRubataPhase: boolean
      board: Array<{ playerName: string }>
      currentIndex: number
      totalPlayers: number
      rubataState: string
      myMemberId: string
      memberBudgets: Array<{ residuo: number }>
    }

    expect(data.isRubataPhase).toBe(true)
    expect(data.totalPlayers).toBe(2)
    expect(data.currentIndex).toBe(0)
    expect(data.rubataState).toBe('READY_CHECK')
    expect(data.myMemberId).toBe('member-1')
    // Budget residuo = 200 - (8+3) = 189
    const firstBudget = data.memberBudgets[0] as { residuo: number }
    expect(firstBudget.residuo).toBe(189)
  })

  it('should auto-advance when OFFERING timer expires with no auction', async () => {
    const board = [
      makeBoardItem('Player1', 'member-1', 'P', 3, 9),
      makeBoardItem('Player2', 'member-2', 'D', 5, 35),
    ]

    // Timer started 120 seconds ago, offer timer is 60 seconds -> expired
    const expiredTimerStart = new Date(Date.now() - 120_000)

    const expiredSession = makeSession({
      rubataBoard: board,
      rubataState: 'OFFERING',
      rubataBoardIndex: 0,
      rubataTimerStartedAt: expiredTimerStart,
      rubataOfferTimerSeconds: 60,
    })

    // After auto-advance, re-fetched session has next index and READY_CHECK state
    const updatedSession = makeSession({
      rubataBoard: board,
      rubataState: 'READY_CHECK',
      rubataBoardIndex: 1,
      rubataTimerStartedAt: null,
    })

    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst
      .mockResolvedValueOnce(expiredSession)   // first fetch
      .mockResolvedValueOnce(updatedSession)   // re-fetch after auto-advance
    prismaMock.auction.findFirst
      .mockResolvedValueOnce(null)  // no existing auction during auto-advance check
      .mockResolvedValueOnce(null)  // no active auction for board response
    prismaMock.marketSession.update.mockResolvedValue({})
    prismaMock.leagueMember.findMany.mockResolvedValue([])

    const result = await getRubataBoard(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(true)

    // Verify session was updated to advance
    expect(prismaMock.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataBoardIndex: 1,
          rubataState: 'READY_CHECK',
          rubataTimerStartedAt: null,
          rubataReadyMembers: [],
        }),
      })
    )
  })

  it('should set COMPLETED when OFFERING timer expires on last player', async () => {
    const board = [makeBoardItem('Player1', 'member-1', 'P', 3, 9)]

    const expiredTimerStart = new Date(Date.now() - 120_000)

    const expiredSession = makeSession({
      rubataBoard: board,
      rubataState: 'OFFERING',
      rubataBoardIndex: 0, // last (and only) player
      rubataTimerStartedAt: expiredTimerStart,
      rubataOfferTimerSeconds: 60,
    })

    const completedSession = makeSession({
      rubataBoard: board,
      rubataState: 'COMPLETED',
      rubataBoardIndex: 0,
      rubataTimerStartedAt: null,
    })

    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst
      .mockResolvedValueOnce(expiredSession)
      .mockResolvedValueOnce(completedSession)
    prismaMock.auction.findFirst
      .mockResolvedValueOnce(null)  // no auction during auto-advance
      .mockResolvedValueOnce(null)  // no active auction for board response
    prismaMock.marketSession.update.mockResolvedValue({})
    prismaMock.leagueMember.findMany.mockResolvedValue([])

    const result = await getRubataBoard(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(true)

    expect(prismaMock.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataState: 'COMPLETED',
          rubataTimerStartedAt: null,
        }),
      })
    )
  })

  it('should not auto-advance when OFFERING timer has not expired', async () => {
    const board = [
      makeBoardItem('Player1', 'member-1', 'P', 3, 9),
      makeBoardItem('Player2', 'member-2', 'D', 5, 35),
    ]

    // Timer started 10 seconds ago, offer timer is 60 seconds -> NOT expired
    const recentTimerStart = new Date(Date.now() - 10_000)

    const session = makeSession({
      rubataBoard: board,
      rubataState: 'OFFERING',
      rubataBoardIndex: 0,
      rubataTimerStartedAt: recentTimerStart,
      rubataOfferTimerSeconds: 60,
    })

    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(session)
    prismaMock.auction.findFirst.mockResolvedValue(null)
    prismaMock.leagueMember.findMany.mockResolvedValue([])

    const result = await getRubataBoard(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(true)

    // marketSession.update should NOT have been called for auto-advance
    expect(prismaMock.marketSession.update).not.toHaveBeenCalled()

    const data = result.data as { remainingSeconds: number | null }
    expect(data.remainingSeconds).toBeGreaterThan(0)
  })

  it('should calculate remaining seconds when timer is active', async () => {
    const board = [makeBoardItem('Player1', 'member-1', 'P', 3, 9)]

    // Timer started 20 seconds ago, offer timer is 60 seconds -> 40 remaining
    const timerStart = new Date(Date.now() - 20_000)

    const session = makeSession({
      rubataBoard: board,
      rubataState: 'OFFERING',
      rubataBoardIndex: 0,
      rubataTimerStartedAt: timerStart,
      rubataOfferTimerSeconds: 60,
    })

    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(session)
    prismaMock.auction.findFirst.mockResolvedValue(null)
    prismaMock.leagueMember.findMany.mockResolvedValue([])

    const result = await getRubataBoard(LEAGUE_ID, MEMBER_USER_ID)

    const data = result.data as { remainingSeconds: number }
    // Should be approximately 40 seconds (allow 2s tolerance for test execution)
    expect(data.remainingSeconds).toBeGreaterThanOrEqual(38)
    expect(data.remainingSeconds).toBeLessThanOrEqual(41)
  })
})

// ==================== getRubataStatus ====================

describe('getRubataStatus', () => {
  it('should return error when user is not a member', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(null)

    const result = await getRubataStatus(LEAGUE_ID, 'unknown-user')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return status data when session exists', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataOrder: ['member-1', 'member-2'] })
    )
    prismaMock.auction.findFirst.mockResolvedValue(null)
    prismaMock.leagueMember.findUnique.mockResolvedValue({
      id: 'member-1',
      user: { username: 'user1' },
    })

    const result = await getRubataStatus(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(true)

    const data = result.data as {
      isRubataPhase: boolean
      rubataOrder: string[]
      currentTurn: { memberId: string; username: string; isMe: boolean } | null
      activeAuction: unknown
      remainingTurns: number
    }

    expect(data.isRubataPhase).toBe(true)
    expect(data.rubataOrder).toEqual(['member-1', 'member-2'])
    expect(data.remainingTurns).toBe(2)
    expect(data.currentTurn).not.toBeNull()
    expect(data.currentTurn?.username).toBe('user1')
  })

  it('should return isRubataPhase false when session is not in RUBATA phase', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ currentPhase: 'ASTA_SVINCOLATI', rubataOrder: [] })
    )
    prismaMock.auction.findFirst.mockResolvedValue(null)

    const result = await getRubataStatus(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(true)

    const data = result.data as { isRubataPhase: boolean }
    expect(data.isRubataPhase).toBe(false)
  })

  it('should return null currentTurn when rubataOrder is empty', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataOrder: [] })
    )
    prismaMock.auction.findFirst.mockResolvedValue(null)

    const result = await getRubataStatus(LEAGUE_ID, MEMBER_USER_ID)

    const data = result.data as { currentTurn: unknown }
    expect(data.currentTurn).toBeNull()
  })
})

// ==================== getRubataPreviewBoard ====================

describe('getRubataPreviewBoard', () => {
  it('should return error when user is not a member', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(null)

    const result = await getRubataPreviewBoard(LEAGUE_ID, 'unknown-user')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should return error when no active rubata session', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(null)

    const result = await getRubataPreviewBoard(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should return error when board is not generated yet', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: null })
    )

    const result = await getRubataPreviewBoard(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Tabellone non ancora generato')
  })

  it('should return enriched board with preferences', async () => {
    const board = [
      makeBoardItem('Bastoni', 'member-1', 'D', 3, 21),
      makeBoardItem('Vlahovic', 'member-2', 'A', 10, 110),
    ]

    prismaMock.leagueMember.findFirst.mockResolvedValue(makeMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: board, rubataState: 'PREVIEW' })
    )
    prismaMock.rubataPreference.findMany.mockResolvedValue([
      {
        id: 'pref-1',
        playerId: 'player-Bastoni',
        memberId: 'member-1',
        sessionId: SESSION_ID,
        maxBid: 30,
        priority: 1,
        notes: null,
        isWatchlist: true,
        isAutoPass: false,
        watchlistCategory: null,
      },
    ])

    const result = await getRubataPreviewBoard(LEAGUE_ID, MEMBER_USER_ID)

    expect(result.success).toBe(true)

    const data = result.data as {
      board: Array<{ playerName: string; preference: unknown }>
      totalPlayers: number
      rubataState: string
      isPreview: boolean
      watchlistCount: number
      autoPassCount: number
    }

    expect(data.totalPlayers).toBe(2)
    expect(data.rubataState).toBe('PREVIEW')
    expect(data.isPreview).toBe(true)
    expect(data.watchlistCount).toBe(1)
    expect(data.autoPassCount).toBe(0)
    // Bastoni should have preference, Vlahovic should not
    const boardFirst = data.board[0] as { playerName: string; preference: unknown }
    const boardSecond = data.board[1] as { playerName: string; preference: unknown }
    expect(boardFirst.preference).not.toBeNull()
    expect(boardSecond.preference).toBeNull()
  })
})

// ==================== setRubataToPreview ====================

describe('setRubataToPreview', () => {
  it('should return error when user is not admin', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(null)

    const result = await setRubataToPreview(LEAGUE_ID, 'non-admin')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should return error when no active rubata session', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(null)

    const result = await setRubataToPreview(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should return error when board is not generated', async () => {
    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: null })
    )

    const result = await setRubataToPreview(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Genera prima il tabellone rubata')
  })

  it('should set state to PREVIEW when board exists', async () => {
    const board = [makeBoardItem('Player1', 'member-1', 'P', 3, 9)]

    prismaMock.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    prismaMock.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: board })
    )
    prismaMock.marketSession.update.mockResolvedValue({})

    const result = await setRubataToPreview(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)
    expect(result.message).toContain('anteprima')

    expect(prismaMock.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { rubataState: 'PREVIEW' },
      })
    )
  })
})
