/**
 * fantacalcio-stats.service.test.ts - Unit Tests for Fantacalcio Stats Service
 *
 * Tests per il servizio stats dedicato alla fonte fantacalcio.it
 * (FantacalcioMatchRating), completamente isolato da player-stats.service.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    fantacalcioMatchRating: {
      findMany: vi.fn(),
    },
  }
  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock
  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
}))

import * as fantacalcioStatsService from '../services/fantacalcio-stats.service'

function makeRating(overrides: Partial<{
  playerId: string
  mv: number | null
  fm: number | null
  status: string | null
  golSegnati: number
  golSubiti: number
  autoreti: number
  rigoriSegnati: number
  rigoriSbagliati: number
  rigoriParati: number
  assist: number
  potm: number
}> = {}) {
  return {
    playerId: 'player-1',
    mv: 6,
    fm: 6,
    status: null,
    golSegnati: 0,
    golSubiti: 0,
    autoreti: 0,
    rigoriSegnati: 0,
    rigoriSbagliati: 0,
    rigoriParati: 0,
    assist: 0,
    potm: 0,
    ...overrides,
  }
}

describe('Fantacalcio Stats Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('computeFantacalcioSeasonStats', () => {
    it('returns null when no ratings', async () => {
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([])

      const result = await fantacalcioStatsService.computeFantacalcioSeasonStats('player-1')

      expect(result).toBeNull()
    })

    it('computes presenze/titolare/subentrato from status', async () => {
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([
        makeRating({ status: null }),
        makeRating({ status: 'Sostituito' }),
        makeRating({ status: 'Subentrato' }),
      ])

      const result = await fantacalcioStatsService.computeFantacalcioSeasonStats('player-1')

      expect(result?.presenze).toBe(3)
      expect(result?.titolare).toBe(2)
      expect(result?.subentrato).toBe(1)
    })

    it('computes avgMv/avgFm ignoring null values', async () => {
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([
        makeRating({ mv: 6, fm: 6 }),
        makeRating({ mv: 7, fm: 8 }),
        makeRating({ mv: null, fm: null }),
      ])

      const result = await fantacalcioStatsService.computeFantacalcioSeasonStats('player-1')

      expect(result?.avgMv).toBe(6.5)
      expect(result?.avgFm).toBe(7)
    })

    it('sums bonus/malus fields correctly', async () => {
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([
        makeRating({ golSegnati: 1, assist: 1, rigoriSegnati: 1 }),
        makeRating({ golSegnati: 2, autoreti: 1, rigoriSbagliati: 1 }),
      ])

      const result = await fantacalcioStatsService.computeFantacalcioSeasonStats('player-1')

      expect(result?.golSegnati).toBe(3)
      expect(result?.assist).toBe(1)
      expect(result?.rigoriSegnati).toBe(1)
      expect(result?.autoreti).toBe(1)
      expect(result?.rigoriSbagliati).toBe(1)
    })

    it('uses custom season parameter in query', async () => {
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([])

      await fantacalcioStatsService.computeFantacalcioSeasonStats('player-1', '2026-2027')

      expect(mockPrisma.fantacalcioMatchRating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { playerId: 'player-1', season: '2026-2027' } })
      )
    })
  })

  describe('computeFantacalcioSeasonStatsBatch', () => {
    it('returns empty map for empty input', async () => {
      const result = await fantacalcioStatsService.computeFantacalcioSeasonStatsBatch([])

      expect(result.size).toBe(0)
      expect(mockPrisma.fantacalcioMatchRating.findMany).not.toHaveBeenCalled()
    })

    it('groups ratings by playerId', async () => {
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([
        makeRating({ playerId: 'player-1', golSegnati: 1 }),
        makeRating({ playerId: 'player-2', golSegnati: 2 }),
        makeRating({ playerId: 'player-1', golSegnati: 1 }),
      ])

      const result = await fantacalcioStatsService.computeFantacalcioSeasonStatsBatch(['player-1', 'player-2'])

      expect(result.size).toBe(2)
      expect(result.get('player-1')?.presenze).toBe(2)
      expect(result.get('player-1')?.golSegnati).toBe(2)
      expect(result.get('player-2')?.presenze).toBe(1)
      expect(result.get('player-2')?.golSegnati).toBe(2)
    })

    it('does not include players with no ratings in the result map', async () => {
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([
        makeRating({ playerId: 'player-1' }),
      ])

      const result = await fantacalcioStatsService.computeFantacalcioSeasonStatsBatch(['player-1', 'player-2'])

      expect(result.has('player-1')).toBe(true)
      expect(result.has('player-2')).toBe(false)
    })
  })

  describe('getFantacalcioMatchHistory', () => {
    it('returns empty array when no ratings', async () => {
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([])

      const result = await fantacalcioStatsService.getFantacalcioMatchHistory('player-1')

      expect(result).toEqual([])
    })

    it('maps matchDate to ISO string, null-safe', async () => {
      const date = new Date('2026-08-24T00:00:00.000Z')
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([
        {
          giornata: 1, season: '2026-2027', matchDate: date, opponent: 'Bologna', homeAway: 'CASA',
          mv: 6, fm: 6, status: null, golSegnati: 0, golSubiti: 0, autoreti: 0,
          rigoriSegnati: 0, rigoriSbagliati: 0, rigoriParati: 0, assist: 0, potm: 0,
        },
        {
          giornata: 2, season: '2026-2027', matchDate: null, opponent: 'Genoa', homeAway: 'TRASFERTA',
          mv: null, fm: null, status: null, golSegnati: 0, golSubiti: 0, autoreti: 0,
          rigoriSegnati: 0, rigoriSbagliati: 0, rigoriParati: 0, assist: 0, potm: 0,
        },
      ])

      const result = await fantacalcioStatsService.getFantacalcioMatchHistory('player-1')

      expect(result[0]?.matchDate).toBe('2026-08-24T00:00:00.000Z')
      expect(result[1]?.matchDate).toBeNull()
    })

    it('orders by matchDate desc (delegated to Prisma query)', async () => {
      mockPrisma.fantacalcioMatchRating.findMany.mockResolvedValue([])

      await fantacalcioStatsService.getFantacalcioMatchHistory('player-1')

      expect(mockPrisma.fantacalcioMatchRating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { playerId: 'player-1' }, orderBy: { matchDate: 'desc' } })
      )
    })
  })
})
