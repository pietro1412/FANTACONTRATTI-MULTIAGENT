/**
 * Unit tests for SeasonalitySparkbar component
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SeasonalitySparkbar, HotMonthsBadge } from '../../src/components/SeasonalitySparkbar'

describe('SeasonalitySparkbar', () => {
  it('renders bars for each month', () => {
    const breakdown = {
      sep: 6.5,
      oct: 6.8,
      nov: 7.0,
      dec: 6.2,
      jan: 6.9,
      feb: 7.2,
      mar: 7.5,
      apr: 6.7,
      may: 6.4,
    }

    render(
      <SeasonalitySparkbar
        monthlyBreakdown={breakdown}
        hotMonths={['mar']}
        showLabels
      />
    )

    // Should render 9 bars (Sep-May)
    const bars = document.querySelectorAll('.rounded-t')
    expect(bars.length).toBe(9)
  })

  it('highlights hot months with green color', () => {
    const breakdown = {
      sep: 6.5,
      mar: 7.8, // hot month
    }

    render(
      <SeasonalitySparkbar
        monthlyBreakdown={breakdown}
        hotMonths={['mar']}
        showLabels
      />
    )

    // The hot month bar should have green color class
    const bars = document.querySelectorAll('.rounded-t')
    const marBar = Array.from(bars)[6] // March is at index 6 in SEASON_MONTHS
    expect(marBar?.className).toContain('bg-green')
  })

  it('shows N/D when no data', () => {
    render(
      <SeasonalitySparkbar
        monthlyBreakdown={{}}
        hotMonths={[]}
        showLabels
      />
    )

    expect(screen.getByText('N/D')).toBeDefined()
  })

  it('shows current month with purple highlight', () => {
    const breakdown = { feb: 6.8 }

    render(
      <SeasonalitySparkbar
        monthlyBreakdown={breakdown}
        hotMonths={[]}
        currentMonth="feb"
        showLabels
      />
    )

    // Current month label should have purple color
    const labels = document.querySelectorAll('.text-\\[8px\\]')
    const febLabel = Array.from(labels)[5] // Feb is at index 5 in SEASON_MONTHS
    expect(febLabel?.className).toContain('text-purple')
  })

  it('hides labels when showLabels is false', () => {
    const breakdown = { sep: 6.5 }

    render(
      <SeasonalitySparkbar
        monthlyBreakdown={breakdown}
        hotMonths={[]}
        showLabels={false}
      />
    )

    // Should not find any month labels
    const labels = document.querySelectorAll('.text-\\[8px\\]')
    expect(labels.length).toBe(0)
  })

  it('applies custom className', () => {
    const breakdown = { sep: 6.5 }

    const { container } = render(
      <SeasonalitySparkbar
        monthlyBreakdown={breakdown}
        hotMonths={[]}
        className="custom-class"
      />
    )

    // The className is applied to the wrapper div
    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('HotMonthsBadge', () => {
  it('returns null when no hot months', () => {
    const { container } = render(<HotMonthsBadge hotMonths={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows Spring Player for spring hot months', () => {
    render(<HotMonthsBadge hotMonths={['mar', 'apr']} />)
    expect(screen.getByText(/Spring Player/)).toBeDefined()
  })

  it('shows Autumn Starter for autumn hot months', () => {
    render(<HotMonthsBadge hotMonths={['sep', 'oct']} />)
    expect(screen.getByText(/Autumn Starter/)).toBeDefined()
  })

  it('shows Winter Warrior for winter hot months', () => {
    render(<HotMonthsBadge hotMonths={['dec', 'jan']} />)
    expect(screen.getByText(/Winter Warrior/)).toBeDefined()
  })

  it('shows multiple month labels for mixed hot months', () => {
    render(<HotMonthsBadge hotMonths={['sep', 'mar']} />)
    // Should show something like "Sep-Mar"
    const badge = document.querySelector('.rounded-full')
    expect(badge).toBeDefined()
  })

  it('applies correct colors for spring', () => {
    render(<HotMonthsBadge hotMonths={['apr']} />)
    const badge = document.querySelector('.rounded-full')
    expect(badge?.className).toContain('bg-orange')
    expect(badge?.className).toContain('text-orange')
  })

  it('applies correct colors for autumn', () => {
    render(<HotMonthsBadge hotMonths={['oct']} />)
    const badge = document.querySelector('.rounded-full')
    expect(badge?.className).toContain('bg-amber')
    expect(badge?.className).toContain('text-amber')
  })

  it('applies correct colors for winter', () => {
    render(<HotMonthsBadge hotMonths={['jan']} />)
    const badge = document.querySelector('.rounded-full')
    expect(badge?.className).toContain('bg-cyan')
    expect(badge?.className).toContain('text-cyan')
  })
})
