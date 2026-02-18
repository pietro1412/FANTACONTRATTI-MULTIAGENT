/**
 * player-stats.service.test.ts - Unit Tests for Player Stats Service
 *
 * Tests for season stats computation, batch stats, auto-tags, and rating data.
 *
 * Creato il: 19/02/2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    playerMatchRating: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    serieAPlayer: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    }
  }

  // Create a proper class constructor
  const MockClass = function(this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

// Mock Prisma with hoisted mock
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  Prisma: {
    DbNull: 'DbNull'
  }
}))

// Import after mocking
import * as playerStatsService from '../services/player-stats.service'

describe('Player Stats Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== computeSeasonStats ====================

  describe('computeSeasonStats', () => {
    it('returns null when no ratings and no apiFootballStats', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({
        id: 'player-1',
        apiFootballStats: null
      })

      const result = await playerStatsService.computeSeasonStats('player-1')

      expect(result).toBeNull()
    })

    it('returns null when no ratings and apiFootballStats has zero appearances', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({
        id: 'player-1',
        apiFootballStats: {
          games: { appearences: 0, minutes: 0, rating: null },
          goals: { total: 0, assists: 0 }
        }
      })

      const result = await playerStatsService.computeSeasonStats('player-1')

      expect(result).toBeNull()
    })

    it('returns fallback stats from apiFootballStats when no match ratings', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({
        id: 'player-1',
        apiFootballStats: {
          games: { appearences: 20, minutes: 1500, rating: 6.8 },
          goals: { total: 5, assists: 3 }
        }
      })

      const result = await playerStatsService.computeSeasonStats('player-1')

      expect(result).not.toBeNull()
      expect(result!.season).toBe('2024-2025')
      expect(result!.appearances).toBe(20)
      expect(result!.totalMinutes).toBe(1500)
      expect(result!.avgRating).toBe(6.8)
      expect(result!.totalGoals).toBe(5)
      expect(result!.totalAssists).toBe(3)
      // 1500/20 = 75 >= 60, so estimatedStartingXI = 20
      expect(result!.startingXI).toBe(20)
    })

    it('estimates startingXI as 0 from fallback when avg minutes < 60', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({
        id: 'player-1',
        apiFootballStats: {
          games: { appearences: 10, minutes: 400, rating: 6.2 },
          goals: { total: 1, assists: 0 }
        }
      })

      const result = await playerStatsService.computeSeasonStats('player-1')

      expect(result).not.toBeNull()
      // 400/10 = 40 < 60, so estimatedStartingXI = 0
      expect(result!.startingXI).toBe(0)
    })

    it('computes stats correctly from match ratings', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([
        { rating: 7.5, minutesPlayed: 90, goals: 1, assists: 0 },
        { rating: 6.0, minutesPlayed: 45, goals: 0, assists: 1 },
        { rating: 8.0, minutesPlayed: 90, goals: 2, assists: 0 },
        { rating: null, minutesPlayed: 0, goals: 0, assists: 0 }  // not played
      ])

      const result = await playerStatsService.computeSeasonStats('player-1')

      expect(result).not.toBeNull()
      expect(result!.season).toBe('2025-2026')
      expect(result!.appearances).toBe(3)           // 3 matches with minutes > 0
      expect(result!.totalMinutes).toBe(225)         // 90 + 45 + 90
      expect(result!.totalGoals).toBe(3)             // 1 + 0 + 2
      expect(result!.totalAssists).toBe(1)           // 0 + 1 + 0
      expect(result!.startingXI).toBe(2)             // 2 matches with >= 60 min
      expect(result!.matchesInSquad).toBe(4)         // all records
      // avgRating = (7.5 + 6.0 + 8.0) / 3 = 7.166... rounded to 7.17
      expect(result!.avgRating).toBe(7.17)
    })

    it('returns null avgRating when all ratings are zero or null', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([
        { rating: null, minutesPlayed: 45, goals: 0, assists: 0 },
        { rating: 0, minutesPlayed: 30, goals: 0, assists: 0 }
      ])

      const result = await playerStatsService.computeSeasonStats('player-1')

      expect(result).not.toBeNull()
      expect(result!.appearances).toBe(2)
      expect(result!.avgRating).toBeNull()
    })

    it('accepts a custom season parameter', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([
        { rating: 7.0, minutesPlayed: 90, goals: 0, assists: 0 }
      ])

      const result = await playerStatsService.computeSeasonStats('player-1', '2024-2025')

      expect(result).not.toBeNull()
      expect(result!.season).toBe('2024-2025')
      expect(mockPrisma.playerMatchRating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: 'player-1', season: '2024-2025' }
        })
      )
    })
  })

  // ==================== computeSeasonStatsBatch ====================

  describe('computeSeasonStatsBatch', () => {
    it('returns empty map for empty playerIds', async () => {
      const result = await playerStatsService.computeSeasonStatsBatch([])

      expect(result.size).toBe(0)
      expect(mockPrisma.playerMatchRating.findMany).not.toHaveBeenCalled()
    })

    it('computes stats for multiple players', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([
        { playerId: 'p1', rating: 7.0, minutesPlayed: 90, goals: 1, assists: 0 },
        { playerId: 'p1', rating: 6.5, minutesPlayed: 70, goals: 0, assists: 1 },
        { playerId: 'p2', rating: 8.0, minutesPlayed: 90, goals: 2, assists: 1 }
      ])

      const result = await playerStatsService.computeSeasonStatsBatch(['p1', 'p2'])

      expect(result.size).toBe(2)

      const p1 = result.get('p1')!
      expect(p1.appearances).toBe(2)
      expect(p1.totalGoals).toBe(1)
      expect(p1.totalAssists).toBe(1)

      const p2 = result.get('p2')!
      expect(p2.appearances).toBe(1)
      expect(p2.totalGoals).toBe(2)
    })

    it('falls back to apiFootballStats for players without match ratings', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([
        { playerId: 'p1', rating: 7.0, minutesPlayed: 90, goals: 1, assists: 0 }
      ])
      mockPrisma.serieAPlayer.findMany.mockResolvedValue([
        {
          id: 'p2',
          apiFootballStats: {
            games: { appearences: 15, minutes: 1200, rating: 6.5 },
            goals: { total: 3, assists: 2 }
          }
        }
      ])

      const result = await playerStatsService.computeSeasonStatsBatch(['p1', 'p2'])

      expect(result.size).toBe(2)

      const p1 = result.get('p1')!
      expect(p1.season).toBe('2025-2026')
      expect(p1.appearances).toBe(1)

      const p2 = result.get('p2')!
      expect(p2.season).toBe('2024-2025')
      expect(p2.appearances).toBe(15)
      expect(p2.totalGoals).toBe(3)
      // 1200/15 = 80 >= 60, so startingXI = 15
      expect(p2.startingXI).toBe(15)
    })

    it('skips fallback players with no apiFootballStats data', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])
      mockPrisma.serieAPlayer.findMany.mockResolvedValue([])

      const result = await playerStatsService.computeSeasonStatsBatch(['p1'])

      expect(result.size).toBe(0)
    })
  })

  // ==================== hasRatingData ====================

  describe('hasRatingData', () => {
    it('returns true when player has rating data', async () => {
      mockPrisma.playerMatchRating.count.mockResolvedValue(5)

      const result = await playerStatsService.hasRatingData('player-1')

      expect(result).toBe(true)
    })

    it('returns false when player has no rating data', async () => {
      mockPrisma.playerMatchRating.count.mockResolvedValue(0)

      const result = await playerStatsService.hasRatingData('player-1')

      expect(result).toBe(false)
    })

    it('uses custom season parameter', async () => {
      mockPrisma.playerMatchRating.count.mockResolvedValue(3)

      await playerStatsService.hasRatingData('player-1', '2024-2025')

      expect(mockPrisma.playerMatchRating.count).toHaveBeenCalledWith({
        where: { playerId: 'player-1', season: '2024-2025' }
      })
    })
  })

  // ==================== getAutoTagDef ====================

  describe('getAutoTagDef', () => {
    it('returns tag definition for TITOLARE', () => {
      const tag = playerStatsService.getAutoTagDef('TITOLARE')

      expect(tag.id).toBe('TITOLARE')
      expect(tag.label).toBe('Titolare')
      expect(tag.color).toBe('text-green-400')
    })

    it('returns tag definition for TOP_PERFORMER', () => {
      const tag = playerStatsService.getAutoTagDef('TOP_PERFORMER')

      expect(tag.id).toBe('TOP_PERFORMER')
      expect(tag.label).toBe('Top Performer')
    })
  })

  // ==================== computeAutoTagsBatch ====================

  describe('computeAutoTagsBatch', () => {
    it('returns empty map for empty players array', async () => {
      const result = await playerStatsService.computeAutoTagsBatch([])

      expect(result.size).toBe(0)
    })

    it('assigns GIOVANE tag for players under 25', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])

      const result = await playerStatsService.computeAutoTagsBatch([
        { playerId: 'p1', age: 22, position: 'A', apiFootballStats: null }
      ])

      expect(result.get('p1')).toContain('GIOVANE')
    })

    it('assigns ANZIANO tag for players over 30', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])

      const result = await playerStatsService.computeAutoTagsBatch([
        { playerId: 'p1', age: 33, position: 'D', apiFootballStats: null }
      ])

      expect(result.get('p1')).toContain('ANZIANO')
    })

    it('does not assign age tags when age is null', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])

      const result = await playerStatsService.computeAutoTagsBatch([
        { playerId: 'p1', age: null, position: 'C', apiFootballStats: null }
      ])

      // No tags at all since no ratings and no age
      expect(result.has('p1')).toBe(false)
    })

    it('assigns RIGORISTA tag from apiFootballStats', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])

      const result = await playerStatsService.computeAutoTagsBatch([
        {
          playerId: 'p1',
          age: 27,
          position: 'A',
          apiFootballStats: { penalty: { scored: 3 } }
        }
      ])

      expect(result.get('p1')).toContain('RIGORISTA')
    })

    it('assigns INFORTUNATO tag from apiFootballStats', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([])

      const result = await playerStatsService.computeAutoTagsBatch([
        {
          playerId: 'p1',
          age: 28,
          position: 'C',
          apiFootballStats: { injured: true }
        }
      ])

      expect(result.get('p1')).toContain('INFORTUNATO')
    })

    it('assigns TITOLARE tag when player starts 70%+ of matches', async () => {
      // 4 matches, 3 with >= 60 minutes = 75% -> TITOLARE
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([
        { playerId: 'p1', rating: 6.5, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-01-01') },
        { playerId: 'p1', rating: 6.8, minutesPlayed: 80, goals: 0, matchDate: new Date('2026-01-08') },
        { playerId: 'p1', rating: 6.2, minutesPlayed: 70, goals: 0, matchDate: new Date('2026-01-15') },
        { playerId: 'p1', rating: 5.8, minutesPlayed: 20, goals: 0, matchDate: new Date('2026-01-22') }
      ])

      const result = await playerStatsService.computeAutoTagsBatch([
        { playerId: 'p1', age: 27, position: 'C', apiFootballStats: null }
      ])

      expect(result.get('p1')).toContain('TITOLARE')
    })

    it('assigns TOP_PERFORMER tag when avg rating >= 7.0', async () => {
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([
        { playerId: 'p1', rating: 7.5, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-01-01') },
        { playerId: 'p1', rating: 7.2, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-01-08') },
        { playerId: 'p1', rating: 7.0, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-01-15') }
      ])

      const result = await playerStatsService.computeAutoTagsBatch([
        { playerId: 'p1', age: 27, position: 'C', apiFootballStats: null }
      ])

      expect(result.get('p1')).toContain('TOP_PERFORMER')
    })

    it('assigns IN_CRESCITA tag when last 3 ratings are above season avg + 0.2', async () => {
      // Season avg will include all 6 matches. First 3 are low, last 3 are high.
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([
        { playerId: 'p1', rating: 5.5, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-01-01') },
        { playerId: 'p1', rating: 5.8, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-01-08') },
        { playerId: 'p1', rating: 5.5, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-01-15') },
        { playerId: 'p1', rating: 7.0, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-01-22') },
        { playerId: 'p1', rating: 7.2, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-01-29') },
        { playerId: 'p1', rating: 7.5, minutesPlayed: 90, goals: 0, matchDate: new Date('2026-02-05') }
      ])

      const result = await playerStatsService.computeAutoTagsBatch([
        { playerId: 'p1', age: 27, position: 'C', apiFootballStats: null }
      ])

      // Season avg = (5.5+5.8+5.5+7.0+7.2+7.5)/6 = 6.42
      // Last 3 avg = (7.0+7.2+7.5)/3 = 7.23
      // 7.23 > 6.42 + 0.2 = 6.62 -> IN_CRESCITA
      expect(result.get('p1')).toContain('IN_CRESCITA')
    })

    it('assigns GOLEADOR tag when goals >= 1.5x position average', async () => {
      // Two players same position: p1 has 6 goals, p2 has 2 goals
      // Position avg = (6+2)/2 = 4
      // p1: 6 >= 4*1.5 = 6 -> GOLEADOR
      mockPrisma.playerMatchRating.findMany.mockResolvedValue([
        { playerId: 'p1', rating: 7.0, minutesPlayed: 90, goals: 3, matchDate: new Date('2026-01-01') },
        { playerId: 'p1', rating: 7.0, minutesPlayed: 90, goals: 3, matchDate: new Date('2026-01-08') },
        { playerId: 'p2', rating: 6.5, minutesPlayed: 90, goals: 1, matchDate: new Date('2026-01-01') },
        { playerId: 'p2', rating: 6.5, minutesPlayed: 90, goals: 1, matchDate: new Date('2026-01-08') }
      ])

      const result = await playerStatsService.computeAutoTagsBatch([
        { playerId: 'p1', age: 27, position: 'A', apiFootballStats: null },
        { playerId: 'p2', age: 26, position: 'A', apiFootballStats: null }
      ])

      expect(result.get('p1')).toContain('GOLEADOR')
      // p2 has 2 goals, avg is 4, 2 < 4*1.5=6, no GOLEADOR
      expect(result.get('p2')?.includes('GOLEADOR')).toBeFalsy()
    })
  })

  // ==================== AUTO_TAG_DEFS ====================

  describe('AUTO_TAG_DEFS', () => {
    it('contains all expected tag definitions', () => {
      const defs = playerStatsService.AUTO_TAG_DEFS
      const expectedIds = [
        'TITOLARE', 'RIGORISTA', 'IN_CRESCITA', 'IN_CALO',
        'GIOVANE', 'ANZIANO', 'TOP_PERFORMER', 'GOLEADOR', 'INFORTUNATO'
      ]

      for (const id of expectedIds) {
        expect(defs[id as keyof typeof defs]).toBeDefined()
        expect(defs[id as keyof typeof defs].label).toBeTruthy()
      }
    })
  })

  // ==================== CURRENT_SEASON ====================

  describe('CURRENT_SEASON', () => {
    it('exports the current season constant via playerStatsService object', () => {
      expect(playerStatsService.playerStatsService.CURRENT_SEASON).toBe('2025-2026')
    })
  })
})
