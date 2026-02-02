/**
 * Unit Tests for PlannerWidget Component
 *
 * Tests the budget planner widget for Clause Day planning.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlannerWidget } from '../../src/components/PlannerWidget'

// Mock strategy data
const mockStrategiesData = [
  {
    rosterId: 'roster-1',
    memberId: 'member-1',
    playerId: 'player-1',
    playerName: 'Vlahovic',
    playerPosition: 'A',
    playerTeam: 'Juventus',
    playerQuotation: 30,
    ownerUsername: 'mario',
    ownerTeamName: 'FC Mario',
    ownerRubataOrder: 1,
    rubataPrice: 15,
    contractSalary: 10,
    contractDuration: 2,
    contractClause: 15,
    preference: {
      maxBid: 20,
      priority: 1,
      notes: 'Top target',
      isWatchlist: true,
      isAutoPass: false,
    },
  },
  {
    rosterId: 'roster-2',
    memberId: 'member-2',
    playerId: 'player-2',
    playerName: 'Leao',
    playerPosition: 'A',
    playerTeam: 'Milan',
    playerQuotation: 35,
    ownerUsername: 'luigi',
    ownerTeamName: 'AC Luigi',
    ownerRubataOrder: 2,
    rubataPrice: 18,
    contractSalary: 12,
    contractDuration: 3,
    contractClause: 18,
    preference: {
      maxBid: 15,
      priority: 2,
      notes: 'Good option',
      isWatchlist: true,
      isAutoPass: false,
    },
  },
  {
    rosterId: 'roster-3',
    memberId: 'member-3',
    playerId: 'player-3',
    playerName: 'Kvaratskhelia',
    playerPosition: 'A',
    playerTeam: 'Napoli',
    playerQuotation: 40,
    ownerUsername: 'peach',
    ownerTeamName: 'AS Peach',
    ownerRubataOrder: 3,
    rubataPrice: 22,
    contractSalary: 8,
    contractDuration: 4,
    contractClause: 22,
    preference: undefined, // No preference set
  },
]

const mockSvincolatiData = [
  {
    id: 'player-4',
    name: 'Svincolato Star',
    team: 'Svincolato FC',
    position: 'C',
    quotation: 25,
    status: 'SVINCOLATO',
    preference: {
      maxBid: 10,
      priority: 3,
      notes: 'Backup option',
      isWatchlist: true,
      isAutoPass: false,
    },
  },
]

describe('PlannerWidget', () => {
  describe('Expanded state', () => {
    it('should render header with title', () => {
      render(<PlannerWidget />)
      expect(screen.getByText('Planner Clausole')).toBeInTheDocument()
    })

    it('should display budget summary', () => {
      render(<PlannerWidget budgetTotal={100} budgetUsed={40} />)
      expect(screen.getByText('100M')).toBeInTheDocument()
      expect(screen.getByText('-40M')).toBeInTheDocument()
      // 60M appears in multiple places (available and remaining)
      const budgetValues = screen.getAllByText('60M')
      expect(budgetValues.length).toBeGreaterThanOrEqual(1)
    })

    it('should show empty state when no planned players', () => {
      render(<PlannerWidget />)
      expect(screen.getByText('Nessun obiettivo pianificato')).toBeInTheDocument()
    })

    it('should render collapse button when callback provided', () => {
      const onToggle = vi.fn()
      render(<PlannerWidget onToggleCollapse={onToggle} />)
      expect(screen.getByTitle('Comprimi planner')).toBeInTheDocument()
    })

    it('should call onToggleCollapse when clicking collapse', () => {
      const onToggle = vi.fn()
      render(<PlannerWidget onToggleCollapse={onToggle} />)
      fireEvent.click(screen.getByTitle('Comprimi planner'))
      expect(onToggle).toHaveBeenCalled()
    })
  })

  describe('Collapsed state', () => {
    it('should render collapsed view with icon', () => {
      render(<PlannerWidget isCollapsed={true} />)
      expect(screen.getByTitle('Espandi planner')).toBeInTheDocument()
    })

    it('should show budget in collapsed view', () => {
      render(<PlannerWidget isCollapsed={true} budgetTotal={100} budgetUsed={30} />)
      expect(screen.getByText('70M')).toBeInTheDocument()
    })

    it('should show planned count in collapsed view', () => {
      render(
        <PlannerWidget
          isCollapsed={true}
          strategiesData={mockStrategiesData}
        />
      )
      expect(screen.getByText('2')).toBeInTheDocument() // Only 2 have preferences with maxBid
    })

    it('should call onToggleCollapse when clicking expand', () => {
      const onToggle = vi.fn()
      render(<PlannerWidget isCollapsed={true} onToggleCollapse={onToggle} />)
      fireEvent.click(screen.getByTitle('Espandi planner'))
      expect(onToggle).toHaveBeenCalled()
    })
  })

  describe('Planned players display', () => {
    it('should display planned players with maxBid', () => {
      render(<PlannerWidget strategiesData={mockStrategiesData} />)
      expect(screen.getByText('Vlahovic')).toBeInTheDocument()
      expect(screen.getByText('Leao')).toBeInTheDocument()
    })

    it('should not display players without preference', () => {
      render(<PlannerWidget strategiesData={mockStrategiesData} />)
      expect(screen.queryByText('Kvaratskhelia')).not.toBeInTheDocument()
    })

    it('should display svincolati with preference', () => {
      render(<PlannerWidget svincolatiData={mockSvincolatiData} />)
      expect(screen.getByText('Svincolato Star')).toBeInTheDocument()
    })

    it('should sort players by priority', () => {
      render(<PlannerWidget strategiesData={mockStrategiesData} />)
      const players = screen.getAllByText(/Vlahovic|Leao/)
      expect(players[0].textContent).toBe('Vlahovic') // Priority 1
    })

    it('should show maxBid for each player', () => {
      render(<PlannerWidget strategiesData={mockStrategiesData} />)
      expect(screen.getByText('20M')).toBeInTheDocument()
      expect(screen.getByText('15M')).toBeInTheDocument()
    })

    it('should show priority sections', () => {
      render(<PlannerWidget strategiesData={mockStrategiesData} svincolatiData={mockSvincolatiData} />)
      expect(screen.getByText(/Priorità Alta/)).toBeInTheDocument()
      expect(screen.getByText(/Priorità Media/)).toBeInTheDocument()
      expect(screen.getByText(/Altre priorità/)).toBeInTheDocument()
    })
  })

  describe('Budget calculation', () => {
    it('should calculate total committed from maxBids', () => {
      render(
        <PlannerWidget
          budgetTotal={100}
          budgetUsed={40}
          strategiesData={mockStrategiesData}
        />
      )
      // Total committed: 20 + 15 = 35
      expect(screen.getByText('-35M')).toBeInTheDocument()
    })

    it('should calculate remaining budget', () => {
      render(
        <PlannerWidget
          budgetTotal={100}
          budgetUsed={40}
          strategiesData={mockStrategiesData}
        />
      )
      // Available: 100 - 40 = 60
      // Committed: 35
      // Remaining: 60 - 35 = 25
      // 25M appears in multiple places
      const remainingValues = screen.getAllByText('25M')
      expect(remainingValues.length).toBeGreaterThanOrEqual(1)
    })

    it('should include svincolati in budget calculation', () => {
      render(
        <PlannerWidget
          budgetTotal={100}
          budgetUsed={40}
          strategiesData={mockStrategiesData}
          svincolatiData={mockSvincolatiData}
        />
      )
      // Total committed: 20 + 15 + 10 = 45
      expect(screen.getByText('-45M')).toBeInTheDocument()
    })
  })

  describe('Risk indicators', () => {
    it('should show OK status when budget is safe', () => {
      render(
        <PlannerWidget
          budgetTotal={100}
          budgetUsed={20}
          strategiesData={[mockStrategiesData[0]]} // Only 20M committed
        />
      )
      expect(screen.getByText('OK')).toBeInTheDocument()
    })

    it('should show warning when budget is tight', () => {
      render(
        <PlannerWidget
          budgetTotal={100}
          budgetUsed={20}
          strategiesData={[
            { ...mockStrategiesData[0], preference: { ...mockStrategiesData[0].preference!, maxBid: 75 } },
          ]}
        />
      )
      // 75 / 80 = 93.75% - should be warning or critical
      const riskLabel = screen.getByText(/Critico|Attenzione/)
      expect(riskLabel).toBeInTheDocument()
    })

    it('should show danger when budget exceeded', () => {
      render(
        <PlannerWidget
          budgetTotal={100}
          budgetUsed={20}
          strategiesData={[
            { ...mockStrategiesData[0], preference: { ...mockStrategiesData[0].preference!, maxBid: 90 } },
          ]}
        />
      )
      // 90 / 80 = 112.5% - should be danger
      expect(screen.getByText('Superato')).toBeInTheDocument()
    })
  })

  describe('Player interaction', () => {
    it('should call onPlayerClick when clicking a player', () => {
      const onPlayerClick = vi.fn()
      render(
        <PlannerWidget
          strategiesData={mockStrategiesData}
          onPlayerClick={onPlayerClick}
        />
      )

      fireEvent.click(screen.getByText('Vlahovic').closest('button')!)
      expect(onPlayerClick).toHaveBeenCalledWith('player-1')
    })
  })

  describe('Footer stats', () => {
    it('should display objective count', () => {
      render(
        <PlannerWidget
          strategiesData={mockStrategiesData}
          svincolatiData={mockSvincolatiData}
        />
      )
      // 2 from strategies + 1 from svincolati = 3
      const counts = screen.getAllByText('3')
      expect(counts.length).toBeGreaterThan(0)
    })

    it('should display total committed in footer', () => {
      render(
        <PlannerWidget
          strategiesData={mockStrategiesData}
        />
      )
      // Total committed: 20 + 15 = 35
      // Should appear in footer as "35M"
      const totals = screen.getAllByText('35M')
      expect(totals.length).toBeGreaterThan(0)
    })
  })

  describe('Default values', () => {
    it('should use default budgetTotal of 100', () => {
      render(<PlannerWidget budgetUsed={30} />)
      expect(screen.getByText('100M')).toBeInTheDocument()
    })

    it('should use default budgetUsed of 0', () => {
      render(<PlannerWidget budgetTotal={100} />)
      expect(screen.getByText('-0M')).toBeInTheDocument()
    })

    it('should default to expanded state', () => {
      render(<PlannerWidget />)
      expect(screen.getByText('Planner Clausole')).toBeInTheDocument()
      expect(screen.getByText('Budget Totale')).toBeInTheDocument()
    })
  })

  describe('Player card details', () => {
    it('should show position badge', () => {
      render(<PlannerWidget strategiesData={mockStrategiesData} />)
      const positionBadges = screen.getAllByText('A')
      expect(positionBadges.length).toBeGreaterThan(0)
    })

    it('should show player team', () => {
      render(<PlannerWidget strategiesData={mockStrategiesData} />)
      expect(screen.getByText(/Juventus/)).toBeInTheDocument()
    })

    it('should show owner team for owned players', () => {
      render(<PlannerWidget strategiesData={mockStrategiesData} />)
      expect(screen.getByText(/FC Mario/)).toBeInTheDocument()
    })

    it('should show Svincolato for free agents', () => {
      render(<PlannerWidget svincolatiData={mockSvincolatiData} />)
      // Multiple "Svincolato" text elements (player name, team, badge)
      const svincolatoTexts = screen.getAllByText(/Svincolato/)
      expect(svincolatoTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('should show price comparison', () => {
      render(<PlannerWidget strategiesData={mockStrategiesData} />)
      // Vlahovic: maxBid 20 vs rubataPrice 15
      expect(screen.getByText(/vs 15M/)).toBeInTheDocument()
    })
  })
})
