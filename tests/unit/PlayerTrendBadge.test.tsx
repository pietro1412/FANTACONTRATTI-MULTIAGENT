/**
 * Unit Tests for PlayerTrendBadge Component
 *
 * Tests the player form trend indicator badge.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  PlayerTrendBadge,
  PlayerTrendMini,
  calculateTrend,
  getFormQuality,
} from '../../src/components/PlayerTrendBadge'

describe('calculateTrend', () => {
  it('should return stable for empty ratings', () => {
    const result = calculateTrend([])
    expect(result.direction).toBe('stable')
    expect(result.formIndex).toBe(0)
  })

  it('should return stable for single rating', () => {
    const result = calculateTrend([7.0])
    expect(result.direction).toBe('stable')
    expect(result.formIndex).toBe(7.0)
  })

  it('should detect upward trend', () => {
    // Recent matches (first in array) have higher ratings
    const result = calculateTrend([8.0, 7.5, 6.5, 6.0, 5.5])
    expect(result.direction).toBe('up')
    expect(result.label).toMatch(/crescita|ripresa/i)
  })

  it('should detect downward trend', () => {
    // Recent matches (first in array) have lower ratings
    const result = calculateTrend([5.5, 6.0, 6.5, 7.0, 7.5])
    expect(result.direction).toBe('down')
    expect(result.label).toMatch(/calo|flessione/i)
  })

  it('should detect stable trend', () => {
    const result = calculateTrend([6.5, 6.6, 6.4, 6.5, 6.5])
    expect(result.direction).toBe('stable')
    expect(result.label).toBe('Stabile')
  })

  it('should calculate correct form index', () => {
    const result = calculateTrend([7.0, 6.0, 8.0, 5.0, 9.0])
    expect(result.formIndex).toBe(7.0) // Average of 35/5
  })

  it('should calculate change percentage', () => {
    const result = calculateTrend([8.0, 7.0, 6.0, 5.0])
    expect(result.changePercent).not.toBe(0)
  })
})

describe('getFormQuality', () => {
  it('should return Eccellente for ratings >= 7.5', () => {
    const result = getFormQuality(7.5)
    expect(result.label).toBe('Eccellente')
    expect(result.color).toContain('emerald')
  })

  it('should return Ottimo for ratings 7.0-7.5', () => {
    const result = getFormQuality(7.2)
    expect(result.label).toBe('Ottimo')
    expect(result.color).toContain('green')
  })

  it('should return Buono for ratings 6.5-7.0', () => {
    const result = getFormQuality(6.7)
    expect(result.label).toBe('Buono')
    expect(result.color).toContain('teal')
  })

  it('should return Sufficiente for ratings 6.0-6.5', () => {
    const result = getFormQuality(6.2)
    expect(result.label).toBe('Sufficiente')
    expect(result.color).toContain('yellow')
  })

  it('should return Insufficiente for ratings 5.5-6.0', () => {
    const result = getFormQuality(5.7)
    expect(result.label).toBe('Insufficiente')
    expect(result.color).toContain('orange')
  })

  it('should return Scarso for ratings < 5.5', () => {
    const result = getFormQuality(5.0)
    expect(result.label).toBe('Scarso')
    expect(result.color).toContain('red')
  })
})

describe('PlayerTrendBadge', () => {
  describe('Compact variant', () => {
    it('should render with empty ratings', () => {
      render(<PlayerTrendBadge ratings={[]} />)
      expect(screen.getByText('-')).toBeInTheDocument()
    })

    it('should show upward arrow for improving trend', () => {
      render(<PlayerTrendBadge ratings={[8.0, 7.5, 6.5, 6.0]} />)
      expect(screen.getByText('↑')).toBeInTheDocument()
    })

    it('should show downward arrow for declining trend', () => {
      render(<PlayerTrendBadge ratings={[5.5, 6.0, 7.0, 7.5]} />)
      expect(screen.getByText('↓')).toBeInTheDocument()
    })

    it('should show stable arrow for consistent trend', () => {
      render(<PlayerTrendBadge ratings={[6.5, 6.6, 6.4, 6.5]} />)
      expect(screen.getByText('→')).toBeInTheDocument()
    })

    it('should display form index when showIndex is true', () => {
      render(<PlayerTrendBadge ratings={[7.0, 7.0, 7.0]} showIndex={true} />)
      expect(screen.getByText('7')).toBeInTheDocument()
    })

    it('should hide form index when showIndex is false', () => {
      render(<PlayerTrendBadge ratings={[7.0, 7.0, 7.0]} showIndex={false} />)
      // Should only show the arrow
      expect(screen.queryByText('7')).not.toBeInTheDocument()
    })
  })

  describe('Full variant', () => {
    it('should render full variant with label', () => {
      render(<PlayerTrendBadge ratings={[8.0, 7.5, 6.5, 6.0]} variant="full" />)
      expect(screen.getByText(/crescita|ripresa/i)).toBeInTheDocument()
    })

    it('should show quality label in full variant', () => {
      render(<PlayerTrendBadge ratings={[7.5, 7.5, 7.5, 7.5]} variant="full" />)
      expect(screen.getByText('Eccellente')).toBeInTheDocument()
    })

    it('should show change percentage when significant', () => {
      render(<PlayerTrendBadge ratings={[8.5, 8.0, 5.0, 5.0]} variant="full" />)
      // Should show percentage change
      const badge = screen.getByText(/\+.*%|-%/)
      expect(badge).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <PlayerTrendBadge ratings={[7.0]} className="custom-class" />
      )
      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should have green styling for upward trend', () => {
      const { container } = render(
        <PlayerTrendBadge ratings={[8.0, 7.5, 6.0, 5.5]} />
      )
      expect(container.innerHTML).toContain('green')
    })

    it('should have red styling for downward trend', () => {
      const { container } = render(
        <PlayerTrendBadge ratings={[5.5, 6.0, 7.0, 7.5]} />
      )
      expect(container.innerHTML).toContain('red')
    })

    it('should have gray styling for stable trend', () => {
      const { container } = render(
        <PlayerTrendBadge ratings={[6.5, 6.5, 6.5, 6.5]} />
      )
      expect(container.innerHTML).toContain('gray')
    })
  })
})

describe('PlayerTrendMini', () => {
  it('should render dash for empty ratings', () => {
    render(<PlayerTrendMini ratings={[]} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('should show arrow and form index', () => {
    render(<PlayerTrendMini ratings={[7.0, 7.0, 7.0]} />)
    expect(screen.getByText('→')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('should have title with trend info', () => {
    render(<PlayerTrendMini ratings={[8.0, 7.5, 6.0, 5.5]} />)
    const element = screen.getByTitle(/crescita|ripresa/i)
    expect(element).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <PlayerTrendMini ratings={[7.0]} className="test-class" />
    )
    expect(container.firstChild).toHaveClass('test-class')
  })
})
