/**
 * history.service.test.ts - Unit Tests for History Service
 *
 * Tests for the history service functions: sessions overview, session details,
 * first market history, session trades, session prizes, rubata history,
 * svincolati history, timeline events, player career, prophecies, and player search.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    leagueMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    marketSession: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    tradeOffer: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    auction: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    playerMovement: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    prophecy: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    serieAPlayer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    playerRoster: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    prizeCategory: {
      findMany: vi.fn(),
    },
  }

  // Create a proper class constructor
  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

// Mock Prisma with hoisted mock
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  MemberStatus: {
    ACTIVE: 'ACTIVE',
    PENDING: 'PENDING',
    REMOVED: 'REMOVED',
  },
}))

// Import after mocking
import * as historyService from '../services/history.service'

// ==================== Test types for assertions ====================

interface SessionOverviewData {
  sessions: Array<{
    counts: { auctions: number; movements: number; trades: number; prizes: number }
    prizesFinalized: boolean
  }>
}

interface SessionDetailsData {
  session: { id: string }
  summary: {
    auctions: Record<string, number>
    trades: Record<string, number>
    movements: Record<string, number>
    prizesFinalized: boolean
  }
}

interface TimelineEventData {
  events: Array<{
    type: string
    player: { name: string }
    to: { teamName: string }
    contract: { salary: number; duration: number; clause: number | null }
  }>
  hasMore: boolean
}

interface PlayerCareerData {
  player: { id: string }
  currentOwner: {
    teamName: string
    contract: { salary: number; duration: number; rescissionClause: number }
  } | null
  timeline: unknown[]
  stats: {
    totalMovements: number
    trades: number
    acquisitions: number
    totalValue: number
    teams: string[]
  }
}

interface RubataHistoryData {
  auctions: Array<{
    wasStolen: boolean
    noBids: boolean
    player: { id: string }
  }>
  stats: { total: number; stolen: number; retained: number; noBids: number }
}

interface SvincolatiHistoryData {
  auctions: Array<{
    player: { id: string }
  }>
  stats: { total: number; totalSpent: number; avgPrice: number }
}

interface ProphecyData {
  prophecies: Array<{
    content: string
    author: { username: string }
  }>
  pagination: { total: number; hasMore: boolean }
}

interface ProphecyStatsData {
  total: number
  byAuthor: Array<{ username: string; count: number }>
  topPlayers: Array<{ name: string }>
}

interface SearchPlayersData {
  players: Array<{
    id: string
    isActive: boolean
    currentOwner: unknown | null
  }>
}

interface FirstMarketData {
  auctions: Array<{
    finalPrice: number
    winner: { username: string }
  }>
  members: Array<{
    totalSpent: number
  }>
  stats: {
    totalAuctions: number
    avgPrice: number
    maxPrice: number
  }
}

// ==================== Test helpers ====================

const LEAGUE_ID = 'league-1'
const USER_ID = 'user-1'
const SESSION_ID = 'session-1'
const MEMBER_ID = 'member-1'
const PLAYER_ID = 'player-1'

function mockActiveMember(overrides?: Record<string, unknown>) {
  const member = { id: MEMBER_ID, leagueId: LEAGUE_ID, userId: USER_ID, status: 'ACTIVE', teamName: 'Team Alpha', currentBudget: 200, ...overrides }
  mockPrisma.leagueMember.findFirst.mockResolvedValue(member)
  return member
}

function mockNoMember() {
  mockPrisma.leagueMember.findFirst.mockResolvedValue(null)
}

function makePlayer(id: string, overrides?: Record<string, unknown>) {
  return { id, name: `Player ${id}`, position: 'A', team: 'Milan', quotation: 20, listStatus: 'IN_LIST', exitReason: null, ...overrides }
}

// ==================== Tests ====================

describe('History Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== getSessionsOverview ====================

  describe('getSessionsOverview', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getSessionsOverview(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns sessions overview with counts', async () => {
      mockActiveMember()

      mockPrisma.marketSession.findMany.mockResolvedValue([
        {
          id: SESSION_ID,
          type: 'REGULAR',
          season: 1,
          semester: 1,
          status: 'COMPLETED',
          currentPhase: null,
          createdAt: new Date('2025-01-01'),
          startsAt: new Date('2025-01-01'),
          endsAt: new Date('2025-06-01'),
          _count: { auctions: 10, movements: 25, prizeCategories: 3 },
          prizePhaseConfig: { isFinalized: true, finalizedAt: new Date('2025-06-01') },
        },
      ])

      mockPrisma.tradeOffer.groupBy.mockResolvedValue([
        { marketSessionId: SESSION_ID, _count: { id: 5 } },
      ])

      const result = await historyService.getSessionsOverview(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as SessionOverviewData
      expect(data.sessions).toHaveLength(1)
      const firstSession = data.sessions[0] as SessionOverviewData['sessions'][number]
      expect(firstSession.counts).toEqual({
        auctions: 10,
        movements: 25,
        trades: 5,
        prizes: 3,
      })
      expect(firstSession.prizesFinalized).toBe(true)
    })

    it('returns empty sessions list when none exist', async () => {
      mockActiveMember()
      mockPrisma.marketSession.findMany.mockResolvedValue([])
      mockPrisma.tradeOffer.groupBy.mockResolvedValue([])

      const result = await historyService.getSessionsOverview(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as SessionOverviewData
      expect(data.sessions).toHaveLength(0)
    })
  })

  // ==================== getSessionDetails ====================

  describe('getSessionDetails', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getSessionDetails(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns error when session not found', async () => {
      mockActiveMember()
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await historyService.getSessionDetails(LEAGUE_ID, 'non-existent', USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Sessione non trovata')
    })

    it('returns session details with summary counts', async () => {
      mockActiveMember()
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        type: 'REGULAR',
        season: 1,
        semester: 1,
        status: 'COMPLETED',
        currentPhase: null,
        createdAt: new Date('2025-01-01'),
        startsAt: new Date('2025-01-01'),
        endsAt: new Date('2025-06-01'),
        prizePhaseConfig: { isFinalized: false },
      })

      mockPrisma.auction.groupBy.mockResolvedValue([
        { type: 'FREE_BID', _count: { id: 8 } },
        { type: 'RUBATA', _count: { id: 4 } },
      ])
      mockPrisma.tradeOffer.groupBy.mockResolvedValue([
        { status: 'ACCEPTED', _count: { id: 3 } },
        { status: 'REJECTED', _count: { id: 1 } },
      ])
      mockPrisma.playerMovement.groupBy.mockResolvedValue([
        { movementType: 'FIRST_MARKET', _count: { id: 15 } },
      ])

      const result = await historyService.getSessionDetails(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as SessionDetailsData
      expect(data.session.id).toBe(SESSION_ID)
      expect(data.summary.auctions).toEqual({ FREE_BID: 8, RUBATA: 4 })
      expect(data.summary.trades).toEqual({ ACCEPTED: 3, REJECTED: 1 })
      expect(data.summary.movements).toEqual({ FIRST_MARKET: 15 })
      expect(data.summary.prizesFinalized).toBe(false)
    })
  })

  // ==================== getTimelineEvents ====================

  describe('getTimelineEvents', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getTimelineEvents(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns timeline events with default pagination', async () => {
      mockActiveMember()

      const movDate = new Date('2025-03-15')
      mockPrisma.playerMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          movementType: 'FIRST_MARKET',
          createdAt: movDate,
          price: 15,
          newSalary: 5,
          newDuration: 3,
          newClause: null,
          player: makePlayer(PLAYER_ID),
          fromMember: null,
          toMember: {
            id: MEMBER_ID,
            teamName: 'Team Alpha',
            user: { username: 'alice' },
          },
          marketSession: { type: 'REGULAR', season: 1, semester: 1 },
        },
      ])

      const result = await historyService.getTimelineEvents(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as TimelineEventData
      expect(data.events).toHaveLength(1)
      const firstEvent = data.events[0] as TimelineEventData['events'][number]
      expect(firstEvent.type).toBe('FIRST_MARKET')
      expect(firstEvent.player.name).toBe(`Player ${PLAYER_ID}`)
      expect(firstEvent.to.teamName).toBe('Team Alpha')
      expect(firstEvent.contract).toEqual({ salary: 5, duration: 3, clause: null })
      expect(data.hasMore).toBe(false)
    })

    it('returns hasMore true when events fill the limit', async () => {
      mockActiveMember()

      // Create exactly 5 events to fill the limit
      const events = Array.from({ length: 5 }, (_, i) => ({
        id: `mov-${i}`,
        movementType: 'TRADE',
        createdAt: new Date(),
        price: 10,
        newSalary: null,
        player: makePlayer(`p-${i}`),
        fromMember: null,
        toMember: null,
        marketSession: null,
      }))
      mockPrisma.playerMovement.findMany.mockResolvedValue(events)

      const result = await historyService.getTimelineEvents(LEAGUE_ID, USER_ID, { limit: 5 })

      expect(result.success).toBe(true)
      const data = result.data as TimelineEventData
      expect(data.hasMore).toBe(true)
    })
  })

  // ==================== getPlayerCareer ====================

  describe('getPlayerCareer', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getPlayerCareer(LEAGUE_ID, PLAYER_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns error when player not found', async () => {
      mockActiveMember()
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue(null)

      const result = await historyService.getPlayerCareer(LEAGUE_ID, 'non-existent', USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Giocatore non trovato')
    })

    it('returns player career with timeline and stats', async () => {
      mockActiveMember()
      const player = makePlayer(PLAYER_ID)
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue(player)

      mockPrisma.playerMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          movementType: 'FIRST_MARKET',
          createdAt: new Date('2025-01-10'),
          price: 20,
          oldSalary: null,
          oldDuration: null,
          oldClause: null,
          newSalary: 5,
          newDuration: 3,
          newClause: null,
          fromMember: null,
          toMember: { id: 'm-1', teamName: 'Team Alpha', user: { username: 'alice' } },
          marketSession: { type: 'REGULAR', season: 1, semester: 1 },
        },
        {
          id: 'mov-2',
          movementType: 'TRADE',
          createdAt: new Date('2025-03-15'),
          price: 25,
          oldSalary: 5,
          oldDuration: 2,
          oldClause: null,
          newSalary: 7,
          newDuration: 2,
          newClause: 50,
          fromMember: { id: 'm-1', teamName: 'Team Alpha', user: { username: 'alice' } },
          toMember: { id: 'm-2', teamName: 'Team Beta', user: { username: 'bob' } },
          marketSession: { type: 'REGULAR', season: 1, semester: 1 },
        },
      ])

      mockPrisma.playerRoster.findFirst.mockResolvedValue({
        playerId: PLAYER_ID,
        status: 'ACTIVE',
        leagueMember: { id: 'm-2', teamName: 'Team Beta', user: { username: 'bob' } },
        contract: { salary: 7, duration: 2, rescissionClause: 50 },
      })

      const result = await historyService.getPlayerCareer(LEAGUE_ID, PLAYER_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as PlayerCareerData
      expect(data.player.id).toBe(PLAYER_ID)
      expect(data.currentOwner).not.toBeNull()
      expect(data.currentOwner?.teamName).toBe('Team Beta')
      expect(data.currentOwner?.contract.salary).toBe(7)
      expect(data.timeline).toHaveLength(2)
      expect(data.stats.totalMovements).toBe(2)
      expect(data.stats.trades).toBe(1)
      expect(data.stats.acquisitions).toBe(1)
      expect(data.stats.totalValue).toBe(45)
      expect(data.stats.teams).toEqual(['Team Alpha', 'Team Beta'])
    })

    it('returns null currentOwner when player is not on any roster', async () => {
      mockActiveMember()
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue(makePlayer(PLAYER_ID))
      mockPrisma.playerMovement.findMany.mockResolvedValue([])
      mockPrisma.playerRoster.findFirst.mockResolvedValue(null)

      const result = await historyService.getPlayerCareer(LEAGUE_ID, PLAYER_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as PlayerCareerData
      expect(data.currentOwner).toBeNull()
      expect(data.timeline).toHaveLength(0)
      expect(data.stats.totalMovements).toBe(0)
    })
  })

  // ==================== getSessionRubataHistory ====================

  describe('getSessionRubataHistory', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getSessionRubataHistory(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns rubata auctions with stats', async () => {
      mockActiveMember()

      mockPrisma.auction.findMany.mockResolvedValue([
        {
          id: 'auc-1',
          playerId: 'p-1',
          player: makePlayer('p-1'),
          basePrice: 10,
          currentPrice: 15,
          status: 'COMPLETED',
          seller: { id: 'm-1', teamName: 'Team Alpha', user: { username: 'alice' } },
          winner: { id: 'm-2', teamName: 'Team Beta', user: { username: 'bob' } },
          bids: [
            { amount: 15, bidder: { id: 'm-2', teamName: 'Team Beta', user: { username: 'bob' } } },
          ],
          endsAt: new Date('2025-02-01'),
        },
        {
          id: 'auc-2',
          playerId: 'p-2',
          player: makePlayer('p-2'),
          basePrice: 5,
          currentPrice: 5,
          status: 'NO_BIDS',
          seller: null,
          winner: null,
          bids: [],
          endsAt: new Date('2025-02-02'),
        },
      ])

      const result = await historyService.getSessionRubataHistory(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as RubataHistoryData
      expect(data.auctions).toHaveLength(2)
      const firstAuction = data.auctions[0] as RubataHistoryData['auctions'][number]
      const secondAuction = data.auctions[1] as RubataHistoryData['auctions'][number]
      expect(firstAuction.wasStolen).toBe(true)
      expect(secondAuction.noBids).toBe(true)
      expect(data.stats.total).toBe(2)
      expect(data.stats.stolen).toBe(1)
      expect(data.stats.noBids).toBe(1)
    })

    it('returns empty list when no rubata auctions exist', async () => {
      mockActiveMember()
      mockPrisma.auction.findMany.mockResolvedValue([])

      const result = await historyService.getSessionRubataHistory(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as RubataHistoryData
      expect(data.auctions).toHaveLength(0)
      expect(data.stats).toEqual({ total: 0, stolen: 0, retained: 0, noBids: 0 })
    })
  })

  // ==================== getSessionSvincolatiHistory ====================

  describe('getSessionSvincolatiHistory', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getSessionSvincolatiHistory(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns svincolati auctions matched by movement playerIds', async () => {
      mockActiveMember()

      mockPrisma.playerMovement.findMany.mockResolvedValue([
        { playerId: 'p-1' },
        { playerId: 'p-2' },
      ])

      mockPrisma.auction.findMany.mockResolvedValue([
        {
          id: 'auc-1',
          playerId: 'p-1',
          player: makePlayer('p-1'),
          basePrice: 1,
          currentPrice: 8,
          status: 'COMPLETED',
          winner: { id: 'm-1', teamName: 'Team Alpha', user: { username: 'alice' } },
          nominator: null,
          bids: [],
          endsAt: new Date('2025-04-01'),
        },
        {
          id: 'auc-3',
          playerId: 'p-3',
          player: makePlayer('p-3'),
          basePrice: 1,
          currentPrice: 5,
          status: 'COMPLETED',
          winner: null,
          nominator: null,
          bids: [],
          endsAt: new Date('2025-04-02'),
        },
      ])

      const result = await historyService.getSessionSvincolatiHistory(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as SvincolatiHistoryData
      // Only auc-1 matches because p-1 is in svincolati movements; p-3 is not
      expect(data.auctions).toHaveLength(1)
      const firstAuction = data.auctions[0] as SvincolatiHistoryData['auctions'][number]
      expect(firstAuction.player.id).toBe('p-1')
      expect(data.stats.total).toBe(1)
      expect(data.stats.totalSpent).toBe(8)
      expect(data.stats.avgPrice).toBe(8)
    })
  })

  // ==================== getProphecies ====================

  describe('getProphecies', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getProphecies(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns prophecies with pagination', async () => {
      mockActiveMember()

      mockPrisma.prophecy.count.mockResolvedValue(1)
      mockPrisma.prophecy.findMany.mockResolvedValue([
        {
          id: 'proph-1',
          content: 'This player will score 20 goals',
          authorRole: 'BUYER',
          createdAt: new Date('2025-01-15'),
          player: makePlayer(PLAYER_ID),
          author: { id: 'm-1', teamName: 'Team Alpha', user: { username: 'alice' } },
          movement: {
            movementType: 'FIRST_MARKET',
            price: 20,
            marketSession: { type: 'REGULAR', season: 1, semester: 1 },
          },
        },
      ])

      const result = await historyService.getProphecies(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as ProphecyData
      expect(data.prophecies).toHaveLength(1)
      const firstProphecy = data.prophecies[0] as ProphecyData['prophecies'][number]
      expect(firstProphecy.content).toBe('This player will score 20 goals')
      expect(firstProphecy.author.username).toBe('alice')
      expect(data.pagination.total).toBe(1)
      expect(data.pagination.hasMore).toBe(false)
    })

    it('returns empty list when no prophecies exist', async () => {
      mockActiveMember()
      mockPrisma.prophecy.count.mockResolvedValue(0)
      mockPrisma.prophecy.findMany.mockResolvedValue([])

      const result = await historyService.getProphecies(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as ProphecyData
      expect(data.prophecies).toHaveLength(0)
      expect(data.pagination.total).toBe(0)
    })
  })

  // ==================== getProphecyStats ====================

  describe('getProphecyStats', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getProphecyStats(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns prophecy stats by author and by player', async () => {
      mockActiveMember()

      mockPrisma.prophecy.groupBy
        .mockResolvedValueOnce([
          { authorId: 'm-1', _count: { id: 5 } },
          { authorId: 'm-2', _count: { id: 3 } },
        ])
        .mockResolvedValueOnce([
          { playerId: 'p-1', _count: { id: 4 } },
        ])

      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'm-1', teamName: 'Team Alpha', user: { username: 'alice' } },
        { id: 'm-2', teamName: 'Team Beta', user: { username: 'bob' } },
      ])

      mockPrisma.serieAPlayer.findMany.mockResolvedValue([
        makePlayer('p-1'),
      ])

      mockPrisma.prophecy.count.mockResolvedValue(8)

      const result = await historyService.getProphecyStats(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as ProphecyStatsData
      expect(data.total).toBe(8)
      expect(data.byAuthor).toHaveLength(2)
      const firstAuthor = data.byAuthor[0] as ProphecyStatsData['byAuthor'][number]
      expect(firstAuthor.username).toBe('alice')
      expect(firstAuthor.count).toBe(5)
      expect(data.topPlayers).toHaveLength(1)
      const firstPlayer = data.topPlayers[0] as ProphecyStatsData['topPlayers'][number]
      expect(firstPlayer.name).toBe('Player p-1')
    })
  })

  // ==================== searchPlayersForHistory ====================

  describe('searchPlayersForHistory', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.searchPlayersForHistory(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns active players by default (excludes released)', async () => {
      mockActiveMember()

      mockPrisma.playerMovement.findMany.mockResolvedValue([
        { playerId: 'p-1' },
        { playerId: 'p-2' },
      ])

      mockPrisma.serieAPlayer.findMany.mockResolvedValue([
        makePlayer('p-1'),
        makePlayer('p-2'),
      ])

      // p-1 is on a roster, p-2 is not
      mockPrisma.playerRoster.findMany.mockResolvedValue([
        {
          playerId: 'p-1',
          leagueMember: { id: 'm-1', user: { username: 'alice' } },
        },
      ])

      const result = await historyService.searchPlayersForHistory(LEAGUE_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as SearchPlayersData
      // Without includeReleased, only active players returned
      expect(data.players).toHaveLength(1)
      const firstPlayer = data.players[0] as SearchPlayersData['players'][number]
      expect(firstPlayer.id).toBe('p-1')
      expect(firstPlayer.isActive).toBe(true)
    })

    it('includes released players when option is set', async () => {
      mockActiveMember()

      mockPrisma.playerMovement.findMany.mockResolvedValue([
        { playerId: 'p-1' },
        { playerId: 'p-2' },
      ])

      mockPrisma.serieAPlayer.findMany.mockResolvedValue([
        makePlayer('p-1'),
        makePlayer('p-2'),
      ])

      mockPrisma.playerRoster.findMany.mockResolvedValue([
        {
          playerId: 'p-1',
          leagueMember: { id: 'm-1', user: { username: 'alice' } },
        },
      ])

      const result = await historyService.searchPlayersForHistory(LEAGUE_ID, USER_ID, undefined, { includeReleased: true })

      expect(result.success).toBe(true)
      const data = result.data as SearchPlayersData
      expect(data.players).toHaveLength(2)
      const released = data.players.find((p) => p.id === 'p-2')
      expect(released?.isActive).toBe(false)
      expect(released?.currentOwner).toBeNull()
    })
  })

  // ==================== getFirstMarketHistory ====================

  describe('getFirstMarketHistory', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getFirstMarketHistory(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns auctions, members, and stats for first market', async () => {
      mockActiveMember()

      const player = makePlayer('p-1')
      mockPrisma.auction.findMany.mockResolvedValue([
        {
          id: 'auc-1',
          playerId: 'p-1',
          player,
          basePrice: 1,
          currentPrice: 12,
          status: 'COMPLETED',
          winnerId: 'm-1',
          winner: { id: 'm-1', teamName: 'Team Alpha', user: { username: 'alice' } },
          bids: [
            {
              amount: 12,
              isWinning: true,
              placedAt: new Date(),
              bidder: { id: 'm-1', teamName: 'Team Alpha', user: { username: 'alice' } },
            },
          ],
          acknowledgments: [],
          endsAt: new Date('2025-01-15'),
        },
      ])

      mockPrisma.prophecy.findMany.mockResolvedValue([])

      mockPrisma.leagueMember.findMany.mockResolvedValue([
        {
          id: 'm-1',
          teamName: 'Team Alpha',
          currentBudget: 188,
          status: 'ACTIVE',
          user: { username: 'alice' },
          roster: [
            {
              playerId: 'p-1',
              player,
              contract: { salary: 3, duration: 3 },
            },
          ],
        },
      ])

      const result = await historyService.getFirstMarketHistory(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(true)
      const data = result.data as FirstMarketData
      expect(data.auctions).toHaveLength(1)
      const firstAuction = data.auctions[0] as FirstMarketData['auctions'][number]
      expect(firstAuction.finalPrice).toBe(12)
      expect(firstAuction.winner.username).toBe('alice')
      expect(data.members).toHaveLength(1)
      const firstMember = data.members[0] as FirstMarketData['members'][number]
      expect(firstMember.totalSpent).toBe(12)
      expect(data.stats.totalAuctions).toBe(1)
      expect(data.stats.avgPrice).toBe(12)
      expect(data.stats.maxPrice).toBe(12)
    })
  })

  // ==================== getSessionTrades ====================

  describe('getSessionTrades', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getSessionTrades(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })
  })

  // ==================== getSessionPrizes ====================

  describe('getSessionPrizes', () => {
    it('returns error when user is not a member', async () => {
      mockNoMember()

      const result = await historyService.getSessionPrizes(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns error when session not found', async () => {
      mockActiveMember()
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await historyService.getSessionPrizes(LEAGUE_ID, SESSION_ID, USER_ID)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Sessione non trovata')
    })
  })
})
