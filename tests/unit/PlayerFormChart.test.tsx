/**
 * Unit Tests for PlayerFormChart Component
 *
 * Tests the sparkline chart component for displaying player form.
 */

import { describe, it, expect } from 'vitest'
import { extractRatingsFromStats } from '../../src/components/PlayerFormChart'

describe('PlayerFormChart', () => {
  describe('extractRatingsFromStats', () => {
    it('should return empty array for null input', () => {
      const result = extractRatingsFromStats(null)
      expect(result).toEqual([])
    })

    it('should return empty array for undefined input', () => {
      const result = extractRatingsFromStats(undefined)
      expect(result).toEqual([])
    })

    it('should return empty array for non-object input', () => {
      expect(extractRatingsFromStats('string')).toEqual([])
      expect(extractRatingsFromStats(123)).toEqual([])
      expect(extractRatingsFromStats(true)).toEqual([])
    })

    it('should extract rating from games.rating as number', () => {
      const stats = {
        games: {
          rating: 7.5,
        },
      }
      const result = extractRatingsFromStats(stats)
      expect(result).toEqual([7.5])
    })

    it('should extract rating from games.rating as string', () => {
      const stats = {
        games: {
          rating: '6.8',
        },
      }
      const result = extractRatingsFromStats(stats)
      expect(result).toEqual([6.8])
    })

    it('should extract ratings from fixtures array', () => {
      const stats = {
        fixtures: [
          { games: { rating: 6.5 } },
          { games: { rating: 7.0 } },
          { games: { rating: '7.5' } },
          { games: { rating: 6.0 } },
          { games: { rating: 8.0 } },
          { games: { rating: 7.2 } }, // 6th match
          { games: { rating: 6.8 } }, // 7th match
        ],
      }
      const result = extractRatingsFromStats(stats)
      // Should return last 5 matches
      expect(result).toHaveLength(5)
      expect(result).toEqual([7.5, 6.0, 8.0, 7.2, 6.8])
    })

    it('should extract ratings from fixtures with direct rating property', () => {
      const stats = {
        fixtures: [
          { rating: 6.5 },
          { rating: '7.0' },
          { rating: 7.5 },
        ],
      }
      const result = extractRatingsFromStats(stats)
      expect(result).toEqual([6.5, 7.0, 7.5])
    })

    it('should extract from simple ratings array', () => {
      const stats = {
        ratings: [6.0, 6.5, 7.0, 7.5, 8.0, 8.5],
      }
      const result = extractRatingsFromStats(stats)
      // Should return last 5
      expect(result).toEqual([6.5, 7.0, 7.5, 8.0, 8.5])
    })

    it('should extract from recentForm array', () => {
      const stats = {
        recentForm: [6.0, 6.5, 7.0, 7.5],
      }
      const result = extractRatingsFromStats(stats)
      expect(result).toEqual([6.0, 6.5, 7.0, 7.5])
    })

    it('should filter out non-numeric values', () => {
      const stats = {
        ratings: [6.5, 'invalid', null, 7.0, undefined, 7.5],
      }
      const result = extractRatingsFromStats(stats)
      expect(result).toEqual([6.5, 7.0, 7.5])
    })

    it('should handle empty fixtures array', () => {
      const stats = {
        fixtures: [],
      }
      const result = extractRatingsFromStats(stats)
      expect(result).toEqual([])
    })

    it('should handle fixtures with missing rating data', () => {
      const stats = {
        fixtures: [
          { games: {} },
          { games: { rating: 7.0 } },
          {},
          { rating: 6.5 },
        ],
      }
      const result = extractRatingsFromStats(stats)
      expect(result).toEqual([7.0, 6.5])
    })

    it('should prioritize fixtures over simple arrays', () => {
      const stats = {
        fixtures: [
          { games: { rating: 7.0 } },
          { games: { rating: 7.5 } },
        ],
        ratings: [5.0, 5.5, 6.0], // Should be ignored
      }
      const result = extractRatingsFromStats(stats)
      expect(result).toEqual([7.0, 7.5])
    })

    it('should handle deeply nested empty objects', () => {
      const stats = {
        games: {},
        fixtures: null,
        ratings: null,
      }
      const result = extractRatingsFromStats(stats)
      expect(result).toEqual([])
    })
  })
})
