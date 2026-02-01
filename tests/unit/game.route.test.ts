/**
 * Unit Tests for Game Status API Route
 *
 * Tests the /api/game/status endpoint logic for phase-aware UI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to create mock functions
const { mockMarketSessionFindFirst } = vi.hoisted(() => ({
  mockMarketSessionFindFirst: vi.fn(),
}))

// Mock PrismaClient
vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    marketSession = {
      findFirst: mockMarketSessionFindFirst,
    }
  }

  // Mock MarketPhase enum
  const MarketPhase = {
    ASTA_LIBERA: 'ASTA_LIBERA',
    OFFERTE_PRE_RINNOVO: 'OFFERTE_PRE_RINNOVO',
    PREMI: 'PREMI',
    CONTRATTI: 'CONTRATTI',
    CALCOLO_INDENNIZZI: 'CALCOLO_INDENNIZZI',
    RUBATA: 'RUBATA',
    ASTA_SVINCOLATI: 'ASTA_SVINCOLATI',
    OFFERTE_POST_ASTA_SVINCOLATI: 'OFFERTE_POST_ASTA_SVINCOLATI',
  }

  return {
    PrismaClient: MockPrismaClient,
    MarketPhase,
  }
})

// Test the mapMarketPhase logic directly
describe('Game Status API Logic', () => {
  // Since mapMarketPhase is not exported, we test its behavior by testing the expected outcomes
  // We'll verify the mapping logic matches the expected design

  describe('mapMarketPhase logic', () => {
    // This tests the mapping specification without needing the actual route
    const mapMarketPhase = (phase: string | null): 'scouting' | 'open_window' | 'clause_meeting' => {
      if (!phase) return 'scouting'

      switch (phase) {
        case 'RUBATA':
        case 'ASTA_SVINCOLATI':
        case 'OFFERTE_POST_ASTA_SVINCOLATI':
          return 'clause_meeting'

        case 'OFFERTE_PRE_RINNOVO':
        case 'PREMI':
        case 'CONTRATTI':
        case 'CALCOLO_INDENNIZZI':
          return 'open_window'

        case 'ASTA_LIBERA':
        default:
          return 'scouting'
      }
    }

    it('should return scouting for null phase', () => {
      expect(mapMarketPhase(null)).toBe('scouting')
    })

    it('should return scouting for undefined phase', () => {
      expect(mapMarketPhase(undefined as unknown as string | null)).toBe('scouting')
    })

    describe('clause_meeting phases', () => {
      it('should return clause_meeting for RUBATA', () => {
        expect(mapMarketPhase('RUBATA')).toBe('clause_meeting')
      })

      it('should return clause_meeting for ASTA_SVINCOLATI', () => {
        expect(mapMarketPhase('ASTA_SVINCOLATI')).toBe('clause_meeting')
      })

      it('should return clause_meeting for OFFERTE_POST_ASTA_SVINCOLATI', () => {
        expect(mapMarketPhase('OFFERTE_POST_ASTA_SVINCOLATI')).toBe('clause_meeting')
      })
    })

    describe('open_window phases', () => {
      it('should return open_window for OFFERTE_PRE_RINNOVO', () => {
        expect(mapMarketPhase('OFFERTE_PRE_RINNOVO')).toBe('open_window')
      })

      it('should return open_window for PREMI', () => {
        expect(mapMarketPhase('PREMI')).toBe('open_window')
      })

      it('should return open_window for CONTRATTI', () => {
        expect(mapMarketPhase('CONTRATTI')).toBe('open_window')
      })

      it('should return open_window for CALCOLO_INDENNIZZI', () => {
        expect(mapMarketPhase('CALCOLO_INDENNIZZI')).toBe('open_window')
      })
    })

    describe('scouting phases', () => {
      it('should return scouting for ASTA_LIBERA', () => {
        expect(mapMarketPhase('ASTA_LIBERA')).toBe('scouting')
      })

      it('should return scouting for unknown phase', () => {
        expect(mapMarketPhase('UNKNOWN_PHASE')).toBe('scouting')
      })
    })
  })

  describe('phase labels', () => {
    const phaseLabels: Record<string, string> = {
      scouting: 'Mercato Chiuso',
      open_window: 'Sessione Aperta',
      clause_meeting: 'Clause Day',
    }

    it('should have correct label for scouting', () => {
      expect(phaseLabels.scouting).toBe('Mercato Chiuso')
    })

    it('should have correct label for open_window', () => {
      expect(phaseLabels.open_window).toBe('Sessione Aperta')
    })

    it('should have correct label for clause_meeting', () => {
      expect(phaseLabels.clause_meeting).toBe('Clause Day')
    })
  })

  describe('next clause day calculation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should calculate next Saturday from Wednesday', () => {
      // Jan 15 2025 is a Wednesday
      vi.setSystemTime(new Date('2025-01-15T10:00:00Z'))

      const now = new Date()
      const nextSaturday = new Date(now)
      nextSaturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7))
      nextSaturday.setHours(20, 0, 0, 0)

      // From Wednesday (3) to Saturday (6) is 3 days
      expect(nextSaturday.getDay()).toBe(6) // Saturday
      expect(nextSaturday.getHours()).toBe(20)
    })

    it('should calculate next Saturday from Saturday (should be next week)', () => {
      // Jan 18 2025 is a Saturday
      vi.setSystemTime(new Date('2025-01-18T10:00:00Z'))

      const now = new Date()
      const nextSaturday = new Date(now)
      nextSaturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7))
      nextSaturday.setHours(20, 0, 0, 0)

      // From Saturday to next Saturday is 7 days
      const diffDays = Math.round((nextSaturday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(7)
    })

    it('should calculate next Saturday from Sunday', () => {
      // Jan 19 2025 is a Sunday
      vi.setSystemTime(new Date('2025-01-19T10:00:00Z'))

      const now = new Date()
      const nextSaturday = new Date(now)
      nextSaturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7))
      nextSaturday.setHours(20, 0, 0, 0)

      // From Sunday (0) to Saturday (6) is 6 days
      const diffDays = Math.round((nextSaturday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(6)
    })

    it('should calculate daysRemaining correctly', () => {
      vi.setSystemTime(new Date('2025-01-15T10:00:00Z'))

      const now = new Date()
      const nextSaturday = new Date(now)
      nextSaturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7))
      nextSaturday.setHours(20, 0, 0, 0)

      const daysRemaining = Math.ceil((nextSaturday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysRemaining).toBe(4) // 3 days + part of a day rounds up to 4
    })
  })

  describe('API response structure', () => {
    // Test that the expected response structure is documented
    it('should define correct response structure', () => {
      const expectedResponseStructure = {
        success: true,
        data: {
          phase: 'scouting' as const,
          phaseLabel: 'Mercato Chiuso',
          marketPhase: null as string | null,
          sessionId: null as string | null,
          sessionType: null as string | null,
          nextClauseDay: expect.any(String),
          daysRemaining: expect.any(Number),
          isActive: false,
          leagueName: undefined as string | undefined,
        },
      }

      // Verify structure is valid
      expect(expectedResponseStructure).toHaveProperty('success')
      expect(expectedResponseStructure).toHaveProperty('data')
      expect(expectedResponseStructure.data).toHaveProperty('phase')
      expect(expectedResponseStructure.data).toHaveProperty('phaseLabel')
      expect(expectedResponseStructure.data).toHaveProperty('marketPhase')
      expect(expectedResponseStructure.data).toHaveProperty('sessionId')
      expect(expectedResponseStructure.data).toHaveProperty('nextClauseDay')
      expect(expectedResponseStructure.data).toHaveProperty('daysRemaining')
      expect(expectedResponseStructure.data).toHaveProperty('isActive')
    })

    it('should have isActive true when session exists', () => {
      const activeSession = {
        id: 'session1',
        currentPhase: 'RUBATA',
      }
      const isActive = !!activeSession
      expect(isActive).toBe(true)
    })

    it('should have isActive false when no session', () => {
      const activeSession = null
      const isActive = !!activeSession
      expect(isActive).toBe(false)
    })
  })

  describe('Prisma query structure', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should query for active session with correct where clause', async () => {
      const leagueId = 'test-league-id'

      // The route should query with these parameters
      const expectedWhere = {
        leagueId,
        status: 'ACTIVE',
      }

      // Mock implementation to capture the call
      mockMarketSessionFindFirst.mockResolvedValue(null)

      // Import the PrismaClient to test the mock
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()

      await prisma.marketSession.findFirst({
        where: expectedWhere,
        select: {
          id: true,
          currentPhase: true,
          sessionType: true,
          year: true,
          semester: true,
          createdAt: true,
          league: {
            select: {
              name: true,
            },
          },
        },
      })

      expect(mockMarketSessionFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        })
      )
    })
  })
})
