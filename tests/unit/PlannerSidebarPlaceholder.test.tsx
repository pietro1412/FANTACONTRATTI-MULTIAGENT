/**
 * Unit Tests for PlannerSidebarPlaceholder Component
 *
 * Tests the placeholder for the Planner Widget in the right sidebar.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlannerSidebarPlaceholder } from '../../src/components/PlannerSidebarPlaceholder'

describe('PlannerSidebarPlaceholder', () => {
  describe('Expanded state', () => {
    it('should render header with title', () => {
      render(<PlannerSidebarPlaceholder />)
      // "Planner Clausole" appears both in header (h3) and content (h4)
      const titles = screen.getAllByText(/Planner Clausole/)
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })

    it('should display budget available', () => {
      render(<PlannerSidebarPlaceholder budgetAvailable={50} />)
      expect(screen.getByText('50M')).toBeInTheDocument()
    })

    it('should display planned count', () => {
      render(<PlannerSidebarPlaceholder plannedCount={5} />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('should display coming soon message', () => {
      render(<PlannerSidebarPlaceholder />)
      expect(screen.getByText(/In arrivo nello Sprint 3/)).toBeInTheDocument()
    })

    it('should display placeholder description', () => {
      render(<PlannerSidebarPlaceholder />)
      expect(screen.getByText(/Pianifica i tuoi acquisti/)).toBeInTheDocument()
    })

    it('should display future features list', () => {
      render(<PlannerSidebarPlaceholder />)
      expect(screen.getByText(/Drag & drop priorità/)).toBeInTheDocument()
      expect(screen.getByText(/Simulazione budget/)).toBeInTheDocument()
      expect(screen.getByText(/Alert budget superato/)).toBeInTheDocument()
    })

    it('should display budget progress bar', () => {
      const { container } = render(<PlannerSidebarPlaceholder budgetAvailable={50} />)
      const progressBar = container.querySelector('[class*="bg-gradient-to-r from-green-500"]')
      expect(progressBar).toBeInTheDocument()
    })

    it('should render collapse button when callback provided', () => {
      const onToggle = vi.fn()
      render(<PlannerSidebarPlaceholder onToggleCollapse={onToggle} />)
      expect(screen.getByTitle('Comprimi planner')).toBeInTheDocument()
    })

    it('should call onToggleCollapse when clicking collapse', () => {
      const onToggle = vi.fn()
      render(<PlannerSidebarPlaceholder onToggleCollapse={onToggle} />)
      fireEvent.click(screen.getByTitle('Comprimi planner'))
      expect(onToggle).toHaveBeenCalled()
    })
  })

  describe('Collapsed state', () => {
    it('should render collapsed view with icon', () => {
      render(<PlannerSidebarPlaceholder isCollapsed={true} />)
      expect(screen.getByTitle('Espandi planner')).toBeInTheDocument()
    })

    it('should show budget in collapsed view', () => {
      render(<PlannerSidebarPlaceholder isCollapsed={true} budgetAvailable={75} />)
      expect(screen.getByText('75M')).toBeInTheDocument()
    })

    it('should show planned count in collapsed view', () => {
      render(<PlannerSidebarPlaceholder isCollapsed={true} plannedCount={3} />)
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should not show full description in collapsed view', () => {
      render(<PlannerSidebarPlaceholder isCollapsed={true} />)
      expect(screen.queryByText(/Pianifica i tuoi acquisti/)).not.toBeInTheDocument()
    })

    it('should call onToggleCollapse when clicking expand', () => {
      const onToggle = vi.fn()
      render(<PlannerSidebarPlaceholder isCollapsed={true} onToggleCollapse={onToggle} />)
      fireEvent.click(screen.getByTitle('Espandi planner'))
      expect(onToggle).toHaveBeenCalled()
    })
  })

  describe('Budget display', () => {
    it('should handle zero budget', () => {
      render(<PlannerSidebarPlaceholder budgetAvailable={0} />)
      expect(screen.getByText('0M')).toBeInTheDocument()
    })

    it('should handle large budget', () => {
      render(<PlannerSidebarPlaceholder budgetAvailable={150} />)
      expect(screen.getByText('150M')).toBeInTheDocument()
    })
  })

  describe('Quick stats section', () => {
    it('should display planned players count', () => {
      render(<PlannerSidebarPlaceholder plannedCount={8} />)
      // Look for the count in the stats section
      const statValue = screen.getByText('8')
      expect(statValue).toBeInTheDocument()
    })

    it('should display placeholder for total offers', () => {
      render(<PlannerSidebarPlaceholder />)
      expect(screen.getByText('Totale offerte')).toBeInTheDocument()
      expect(screen.getByText('-')).toBeInTheDocument()
    })
  })

  describe('Default values', () => {
    it('should use default budgetAvailable of 0', () => {
      render(<PlannerSidebarPlaceholder />)
      expect(screen.getByText('0M')).toBeInTheDocument()
    })

    it('should use default plannedCount of 0', () => {
      render(<PlannerSidebarPlaceholder />)
      // The 0 count should be visible
      const zeros = screen.getAllByText('0')
      expect(zeros.length).toBeGreaterThan(0)
    })

    it('should default to expanded state', () => {
      render(<PlannerSidebarPlaceholder />)
      // In expanded state, full title is visible (appears in header and content)
      const titles = screen.getAllByText(/Planner Clausole/)
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })
  })
})
