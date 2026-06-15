import { describe, it, expect } from 'vitest'
import { formatStat, NOT_AVAILABLE, NOT_DISPONIBILE } from '@/utils/stat-format'

describe('stat-format', () => {
  describe('constants', () => {
    it('should expose ND for missing stats and N.D. for anagraphic fields', () => {
      expect(NOT_AVAILABLE).toBe('ND')
      expect(NOT_DISPONIBILE).toBe('N.D.')
    })
  })

  describe('formatStat', () => {
    it('should return ND fallback for null', () => {
      expect(formatStat(null)).toBe('ND')
    })

    it('should return ND fallback for undefined', () => {
      expect(formatStat(undefined)).toBe('ND')
    })

    it('should return ND fallback for NaN', () => {
      expect(formatStat(Number.NaN)).toBe('ND')
    })

    it('should NOT fall back to dash or zero', () => {
      const result = formatStat(null)
      expect(result).not.toBe('-')
      expect(result).not.toBe('0')
    })

    it('should render zero as a real value, not the fallback', () => {
      expect(formatStat(0)).toBe('0')
    })

    it('should render a plain number', () => {
      expect(formatStat(12)).toBe('12')
    })

    it('should append the suffix to a value', () => {
      expect(formatStat(12, { suffix: 'M' })).toBe('12M')
    })

    it('should NOT append the suffix to the fallback', () => {
      expect(formatStat(null, { suffix: 'M' })).toBe('ND')
    })

    it('should apply fixed decimals', () => {
      expect(formatStat(6.789, { decimals: 1 })).toBe('6.8')
    })

    it('should support a custom fallback', () => {
      expect(formatStat(null, { fallback: NOT_DISPONIBILE })).toBe('N.D.')
    })
  })
})
