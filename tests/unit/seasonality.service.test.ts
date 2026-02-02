/**
 * Unit tests for seasonality service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to create mock functions that are available when vi.mock runs
const {
  mockPlayerMatchRatingFindMany,
  mockPlayerMatchRatingFindFirst,
  mockPlayerMatchRatingCreate,
  mockSerieAPlayerFindMany,
  mockSerieAPlayerFindFirst,
  mockSerieAPlayerFindUnique,
  mockSerieAPlayerUpdate,
} = vi.hoisted(() => ({
  mockPlayerMatchRatingFindMany: vi.fn(),
  mockPlayerMatchRatingFindFirst: vi.fn(),
  mockPlayerMatchRatingCreate: vi.fn(),
  mockSerieAPlayerFindMany: vi.fn(),
  mockSerieAPlayerFindFirst: vi.fn(),
  mockSerieAPlayerFindUnique: vi.fn(),
  mockSerieAPlayerUpdate: vi.fn(),
}))

// Mock PrismaClient before importing the service
vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    playerMatchRating = {
      findMany: mockPlayerMatchRatingFindMany,
      findFirst: mockPlayerMatchRatingFindFirst,
      create: mockPlayerMatchRatingCreate,
    }
    serieAPlayer = {
      findMany: mockSerieAPlayerFindMany,
      findFirst: mockSerieAPlayerFindFirst,
      findUnique: mockSerieAPlayerFindUnique,
      update: mockSerieAPlayerUpdate,
    }
  }
  return { PrismaClient: MockPrismaClient }
})

// Import after mocking
import {
  calculateSeasonalStats,
  getPlayerSeasonality,
  getCurrentMonth,
} from '../../src/services/seasonality.service'

describe('calculateSeasonalStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty stats when no ratings found', async () => {
    mockPlayerMatchRatingFindMany.mockResolvedValue([])

    const result = await calculateSeasonalStats('player-1')

    expect(result).toEqual({
      monthly_breakdown: {},
      hot_months: [],
      avg_rating: 0,
    })
  })

  it('groups ratings by month correctly', async () => {
    mockPlayerMatchRatingFindMany.mockResolvedValue([
      { id: '1', playerId: 'p1', matchDate: new Date('2024-09-15'), rating: 7.0, apiFixtureId: 1, season: '2024-2025', round: null, minutesPlayed: 90, goals: 1, assists: 0, createdAt: new Date() },
      { id: '2', playerId: 'p1', matchDate: new Date('2024-09-22'), rating: 6.5, apiFixtureId: 2, season: '2024-2025', round: null, minutesPlayed: 90, goals: 0, assists: 0, createdAt: new Date() },
      { id: '3', playerId: 'p1', matchDate: new Date('2024-10-05'), rating: 7.2, apiFixtureId: 3, season: '2024-2025', round: null, minutesPlayed: 90, goals: 0, assists: 1, createdAt: new Date() },
    ])

    const result = await calculateSeasonalStats('player-1')

    expect(result.monthly_breakdown['sep']).toBe(6.8) // avg of 7.0 and 6.5
    expect(result.monthly_breakdown['oct']).toBe(7.2)
  })

  it('calculates correct overall average', async () => {
    mockPlayerMatchRatingFindMany.mockResolvedValue([
      { id: '1', playerId: 'p1', matchDate: new Date('2024-09-15'), rating: 6.0, apiFixtureId: 1, season: '2024-2025', round: null, minutesPlayed: 90, goals: 0, assists: 0, createdAt: new Date() },
      { id: '2', playerId: 'p1', matchDate: new Date('2024-10-15'), rating: 7.0, apiFixtureId: 2, season: '2024-2025', round: null, minutesPlayed: 90, goals: 0, assists: 0, createdAt: new Date() },
      { id: '3', playerId: 'p1', matchDate: new Date('2024-11-15'), rating: 8.0, apiFixtureId: 3, season: '2024-2025', round: null, minutesPlayed: 90, goals: 0, assists: 0, createdAt: new Date() },
    ])

    const result = await calculateSeasonalStats('player-1')

    expect(result.avg_rating).toBe(7.0) // (6 + 7 + 8) / 3
  })

  it('identifies hot months correctly (> avg + 0.3)', async () => {
    mockPlayerMatchRatingFindMany.mockResolvedValue([
      { id: '1', playerId: 'p1', matchDate: new Date('2024-09-15'), rating: 6.0, apiFixtureId: 1, season: '2024-2025', round: null, minutesPlayed: 90, goals: 0, assists: 0, createdAt: new Date() },
      { id: '2', playerId: 'p1', matchDate: new Date('2024-10-15'), rating: 6.0, apiFixtureId: 2, season: '2024-2025', round: null, minutesPlayed: 90, goals: 0, assists: 0, createdAt: new Date() },
      { id: '3', playerId: 'p1', matchDate: new Date('2024-03-15'), rating: 7.5, apiFixtureId: 3, season: '2024-2025', round: null, minutesPlayed: 90, goals: 2, assists: 0, createdAt: new Date() },
    ])

    const result = await calculateSeasonalStats('player-1')

    // avg = 6.5, so hot threshold = 6.8
    // March has 7.5 which is > 6.8
    expect(result.hot_months).toContain('mar')
    expect(result.hot_months).not.toContain('sep')
    expect(result.hot_months).not.toContain('oct')
  })

  it('handles null ratings gracefully', async () => {
    mockPlayerMatchRatingFindMany.mockResolvedValue([
      { id: '1', playerId: 'p1', matchDate: new Date('2024-09-15'), rating: null, apiFixtureId: 1, season: '2024-2025', round: null, minutesPlayed: null, goals: null, assists: null, createdAt: new Date() },
      { id: '2', playerId: 'p1', matchDate: new Date('2024-10-15'), rating: 7.0, apiFixtureId: 2, season: '2024-2025', round: null, minutesPlayed: 90, goals: 0, assists: 0, createdAt: new Date() },
    ])

    const result = await calculateSeasonalStats('player-1')

    expect(result.monthly_breakdown['sep']).toBeUndefined() // null ratings excluded
    expect(result.monthly_breakdown['oct']).toBe(7.0)
    expect(result.avg_rating).toBe(7.0) // Only valid rating counted
  })
})

describe('getPlayerSeasonality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for non-existent player', async () => {
    mockSerieAPlayerFindUnique.mockResolvedValue(null)

    const result = await getPlayerSeasonality('non-existent')

    expect(result).toBeNull()
  })

  it('returns cached stats when cache is fresh', async () => {
    const cachedStats = {
      monthly_breakdown: { sep: 6.5 },
      hot_months: [],
      avg_rating: 6.5,
    }

    mockSerieAPlayerFindUnique.mockResolvedValue({
      id: 'p1',
      seasonalStatsCache: cachedStats,
      seasonalStatsCachedAt: new Date(), // Fresh cache
    })

    const result = await getPlayerSeasonality('p1')

    expect(result).toEqual(cachedStats)
    // Should not recalculate
    expect(mockPlayerMatchRatingFindMany).not.toHaveBeenCalled()
  })

  it('recalculates stats when cache is stale', async () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago

    mockSerieAPlayerFindUnique.mockResolvedValue({
      id: 'p1',
      seasonalStatsCache: { monthly_breakdown: {}, hot_months: [], avg_rating: 0 },
      seasonalStatsCachedAt: staleDate, // Stale cache
    })

    mockPlayerMatchRatingFindMany.mockResolvedValue([
      { id: '1', playerId: 'p1', matchDate: new Date('2024-09-15'), rating: 7.0, apiFixtureId: 1, season: '2024-2025', round: null, minutesPlayed: 90, goals: 0, assists: 0, createdAt: new Date() },
    ])

    mockSerieAPlayerUpdate.mockResolvedValue({})

    const result = await getPlayerSeasonality('p1')

    expect(result?.monthly_breakdown['sep']).toBe(7.0)
    expect(mockSerieAPlayerUpdate).toHaveBeenCalled() // Should update cache
  })
})

describe('getCurrentMonth', () => {
  it('returns lowercase month name', () => {
    const month = getCurrentMonth()
    const validMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    expect(validMonths).toContain(month)
  })
})
