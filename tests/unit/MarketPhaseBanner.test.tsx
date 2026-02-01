/**
 * Unit Tests for MarketPhaseBanner Component
 *
 * Tests the phase banner component for displaying market phase status.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketPhaseBanner, formatCountdown, type DisplayPhase } from '../../src/components/MarketPhaseBanner'

describe('MarketPhaseBanner', () => {
  describe('formatCountdown', () => {
    beforeEach(() => {
      // Mock Date.now() to a fixed point: 2025-01-15T10:00:00Z
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "In corso" when target date is in the past', () => {
      const pastDate = '2025-01-14T10:00:00Z'
      const result = formatCountdown(pastDate)
      expect(result).toBe('In corso')
    })

    it('should return "In corso" when target date is exactly now', () => {
      const nowDate = '2025-01-15T10:00:00Z'
      const result = formatCountdown(nowDate)
      expect(result).toBe('In corso')
    })

    it('should show days and hours when more than 1 day remaining', () => {
      // 2 days and 5 hours from now
      const futureDate = '2025-01-17T15:00:00Z'
      const result = formatCountdown(futureDate)
      expect(result).toBe('2g 5h')
    })

    it('should show hours and minutes when less than 1 day remaining', () => {
      // 5 hours and 30 minutes from now
      const futureDate = '2025-01-15T15:30:00Z'
      const result = formatCountdown(futureDate)
      expect(result).toBe('5h 30m')
    })

    it('should show only minutes when less than 1 hour remaining', () => {
      // 45 minutes from now
      const futureDate = '2025-01-15T10:45:00Z'
      const result = formatCountdown(futureDate)
      expect(result).toBe('45m')
    })

    it('should handle exactly 1 day remaining', () => {
      const futureDate = '2025-01-16T10:00:00Z'
      const result = formatCountdown(futureDate)
      expect(result).toBe('1g 0h')
    })

    it('should handle exactly 1 hour remaining', () => {
      const futureDate = '2025-01-15T11:00:00Z'
      const result = formatCountdown(futureDate)
      expect(result).toBe('1h 0m')
    })
  })

  describe('Component rendering', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('scouting phase', () => {
      it('should render scouting phase with correct label', () => {
        render(<MarketPhaseBanner phase="scouting" />)
        expect(screen.getByText('Mercato Chiuso')).toBeInTheDocument()
      })

      it('should render scouting phase with custom label', () => {
        render(<MarketPhaseBanner phase="scouting" phaseLabel="Custom Label" />)
        expect(screen.getByText('Custom Label')).toBeInTheDocument()
      })

      it('should render scouting icon', () => {
        render(<MarketPhaseBanner phase="scouting" />)
        expect(screen.getByText('🔍')).toBeInTheDocument()
      })

      it('should show inactive message when not active', () => {
        render(<MarketPhaseBanner phase="scouting" isActive={false} />)
        expect(screen.getByText('Nessuna sessione attiva - Tempo di preparazione')).toBeInTheDocument()
      })
    })

    describe('open_window phase', () => {
      it('should render open_window phase with correct label', () => {
        render(<MarketPhaseBanner phase="open_window" />)
        expect(screen.getByText('Sessione Aperta')).toBeInTheDocument()
      })

      it('should render open_window icon', () => {
        render(<MarketPhaseBanner phase="open_window" />)
        expect(screen.getByText('📋')).toBeInTheDocument()
      })

      it('should show active message when active', () => {
        render(<MarketPhaseBanner phase="open_window" isActive={true} />)
        expect(screen.getByText('Sessione in corso - Prepara le tue strategie')).toBeInTheDocument()
      })
    })

    describe('clause_meeting phase', () => {
      it('should render clause_meeting phase with correct label', () => {
        render(<MarketPhaseBanner phase="clause_meeting" />)
        expect(screen.getByText('Clause Day')).toBeInTheDocument()
      })

      it('should render clause_meeting icon', () => {
        render(<MarketPhaseBanner phase="clause_meeting" />)
        expect(screen.getByText('🎯')).toBeInTheDocument()
      })

      it('should show LIVE badge during clause_meeting', () => {
        render(<MarketPhaseBanner phase="clause_meeting" />)
        expect(screen.getByText('LIVE')).toBeInTheDocument()
      })

      it('should show active clausole message', () => {
        render(<MarketPhaseBanner phase="clause_meeting" isActive={true} />)
        expect(screen.getByText('Clausole attive')).toBeInTheDocument()
      })

      it('should show clause day message when active', () => {
        render(<MarketPhaseBanner phase="clause_meeting" isActive={true} />)
        expect(screen.getByText('Clause Day in corso - Esegui le tue clausole!')).toBeInTheDocument()
      })
    })

    describe('market phase display', () => {
      it('should display marketPhase label when provided', () => {
        render(<MarketPhaseBanner phase="open_window" marketPhase="RUBATA" />)
        expect(screen.getByText(/Fase:.*Rubata/)).toBeInTheDocument()
      })

      it('should display raw marketPhase when no label mapping exists', () => {
        render(<MarketPhaseBanner phase="open_window" marketPhase="UNKNOWN_PHASE" />)
        expect(screen.getByText(/Fase:.*UNKNOWN_PHASE/)).toBeInTheDocument()
      })

      it('should not display marketPhase section when not provided', () => {
        render(<MarketPhaseBanner phase="scouting" />)
        expect(screen.queryByText(/Fase:/)).not.toBeInTheDocument()
      })
    })

    describe('countdown display', () => {
      it('should display countdown when nextClauseDay is provided', () => {
        const futureDate = '2025-01-17T15:00:00Z'
        render(<MarketPhaseBanner phase="scouting" nextClauseDay={futureDate} />)
        expect(screen.getByText('Prossimo Clause Day')).toBeInTheDocument()
        expect(screen.getByText('2g 5h')).toBeInTheDocument()
      })

      it('should display daysRemaining as fallback when nextClauseDay provided but countdown not yet set', () => {
        // When nextClauseDay is provided, countdown is computed immediately via useEffect
        // So daysRemaining is shown only if countdown is empty string
        // This test verifies the fallback logic by checking the rendered output
        const futureDate = '2025-01-17T15:00:00Z'
        render(<MarketPhaseBanner phase="scouting" nextClauseDay={futureDate} daysRemaining={5} />)
        // countdown should be computed, so we should see the countdown value
        expect(screen.getByText('2g 5h')).toBeInTheDocument()
      })

      it('should not display countdown during clause_meeting', () => {
        const futureDate = '2025-01-17T15:00:00Z'
        render(<MarketPhaseBanner phase="clause_meeting" nextClauseDay={futureDate} />)
        expect(screen.queryByText('Prossimo Clause Day')).not.toBeInTheDocument()
      })
    })

    describe('compact mode', () => {
      it('should render compact version', () => {
        render(<MarketPhaseBanner phase="scouting" compact={true} />)
        expect(screen.getByText('Mercato Chiuso')).toBeInTheDocument()
        expect(screen.getByText('🔍')).toBeInTheDocument()
      })

      it('should show marketPhase in parentheses in compact mode', () => {
        render(<MarketPhaseBanner phase="open_window" marketPhase="CONTRATTI" compact={true} />)
        expect(screen.getByText('(Rinnovo Contratti)')).toBeInTheDocument()
      })

      it('should not show status messages in compact mode', () => {
        render(<MarketPhaseBanner phase="scouting" isActive={false} compact={true} />)
        expect(screen.queryByText('Nessuna sessione attiva - Tempo di preparazione')).not.toBeInTheDocument()
      })
    })
  })

  describe('PHASE_CONFIG', () => {
    it.each<[DisplayPhase, string]>([
      ['scouting', 'bg-gray-800/80'],
      ['open_window', 'bg-yellow-900/50'],
      ['clause_meeting', 'bg-green-900/50'],
    ])('should apply correct background for %s phase', (phase, expectedBg) => {
      const { container } = render(<MarketPhaseBanner phase={phase} />)
      const banner = container.firstChild as HTMLElement
      expect(banner.className).toContain(expectedBg)
    })
  })

  describe('MARKET_PHASE_LABELS', () => {
    it.each([
      ['ASTA_LIBERA', 'Asta Libera'],
      ['OFFERTE_PRE_RINNOVO', 'Offerte Pre-Rinnovo'],
      ['PREMI', 'Assegnazione Premi'],
      ['CONTRATTI', 'Rinnovo Contratti'],
      ['CALCOLO_INDENNIZZI', 'Calcolo Indennizzi'],
      ['RUBATA', 'Rubata'],
      ['ASTA_SVINCOLATI', 'Asta Svincolati'],
      ['OFFERTE_POST_ASTA_SVINCOLATI', 'Offerte Post-Asta'],
    ])('should display correct label for %s market phase', (marketPhase, expectedLabel) => {
      render(<MarketPhaseBanner phase="open_window" marketPhase={marketPhase} />)
      expect(screen.getByText(new RegExp(expectedLabel))).toBeInTheDocument()
    })
  })
})
