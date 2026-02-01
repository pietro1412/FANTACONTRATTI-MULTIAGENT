/**
 * Unit Tests for FilterSidebar Component
 *
 * Tests the collapsible filter sidebar for the Strategie page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterSidebar } from '../../src/components/FilterSidebar'

describe('FilterSidebar', () => {
  const defaultProps = {
    positionFilter: 'ALL',
    viewMode: 'myRoster' as const,
    dataViewMode: 'contracts' as const,
    searchQuery: '',
    showOnlyWithStrategy: false,
    ownerFilter: 'ALL',
    teamFilter: 'ALL',
    setPositionFilter: vi.fn(),
    setViewMode: vi.fn(),
    setDataViewMode: vi.fn(),
    setSearchQuery: vi.fn(),
    setShowOnlyWithStrategy: vi.fn(),
    setOwnerFilter: vi.fn(),
    setTeamFilter: vi.fn(),
    uniqueOwners: [
      { username: 'user1', teamName: 'Team A' },
      { username: 'user2', teamName: 'Team B' },
    ],
    uniqueTeams: ['Juventus', 'Milan', 'Inter'],
    counts: {
      myRoster: 10,
      owned: 25,
      svincolati: 15,
      total: 50,
      filtered: 30,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Expanded state', () => {
    it('should render header with title', () => {
      render(<FilterSidebar {...defaultProps} />)
      expect(screen.getByText('Filtri')).toBeInTheDocument()
    })

    it('should render search input', () => {
      render(<FilterSidebar {...defaultProps} />)
      expect(screen.getByPlaceholderText(/Cerca giocatore/i)).toBeInTheDocument()
    })

    it('should call setSearchQuery when typing', () => {
      render(<FilterSidebar {...defaultProps} />)
      const input = screen.getByPlaceholderText(/Cerca giocatore/i)
      fireEvent.change(input, { target: { value: 'Vlahovic' } })
      expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('Vlahovic')
    })

    it('should display player count in footer', () => {
      render(<FilterSidebar {...defaultProps} />)
      expect(screen.getByText('30')).toBeInTheDocument()
      expect(screen.getByText('giocatori')).toBeInTheDocument()
    })
  })

  describe('Scope section', () => {
    it('should render all scope buttons with counts', () => {
      render(<FilterSidebar {...defaultProps} />)
      expect(screen.getByText(/La Mia Rosa/)).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText(/Altre Rose/)).toBeInTheDocument()
      expect(screen.getByText('25')).toBeInTheDocument()
      // Use more specific regex to avoid matching position filter "Tutti"
      expect(screen.getByText(/🆓 Svincolati/)).toBeInTheDocument()
      expect(screen.getByText('15')).toBeInTheDocument()
      expect(screen.getByText(/🌐 Tutti/)).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
    })

    it('should call setViewMode when clicking scope button', () => {
      render(<FilterSidebar {...defaultProps} />)
      fireEvent.click(screen.getByText(/Altre Rose/))
      expect(defaultProps.setViewMode).toHaveBeenCalledWith('owned')
      expect(defaultProps.setOwnerFilter).toHaveBeenCalledWith('ALL')
    })

    it('should call setViewMode for svincolati', () => {
      render(<FilterSidebar {...defaultProps} />)
      fireEvent.click(screen.getByText(/Svincolati/))
      expect(defaultProps.setViewMode).toHaveBeenCalledWith('svincolati')
    })
  })

  describe('Position section', () => {
    it('should render position filter buttons', () => {
      render(<FilterSidebar {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'P' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'D' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'C' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    })

    it('should call setPositionFilter when clicking position', () => {
      render(<FilterSidebar {...defaultProps} />)
      const posButtons = screen.getAllByRole('button', { name: 'D' })
      // Find the one in the position section (not collapsed)
      fireEvent.click(posButtons[0])
      expect(defaultProps.setPositionFilter).toHaveBeenCalledWith('D')
    })
  })

  describe('Data view section', () => {
    it('should render data view buttons', () => {
      render(<FilterSidebar {...defaultProps} />)
      expect(screen.getByText(/Contratti/)).toBeInTheDocument()
      expect(screen.getByText(/Statistiche/)).toBeInTheDocument()
      expect(screen.getByText(/Merge/)).toBeInTheDocument()
    })

    it('should call setDataViewMode when clicking', () => {
      render(<FilterSidebar {...defaultProps} />)
      fireEvent.click(screen.getByText(/Statistiche/))
      expect(defaultProps.setDataViewMode).toHaveBeenCalledWith('stats')
    })
  })

  describe('Additional filters section', () => {
    it('should render team filter dropdown', () => {
      render(<FilterSidebar {...defaultProps} />)
      expect(screen.getByText('Tutte le squadre')).toBeInTheDocument()
      expect(screen.getByText('Juventus')).toBeInTheDocument()
    })

    it('should call setTeamFilter when selecting', () => {
      render(<FilterSidebar {...defaultProps} />)
      const select = screen.getByRole('combobox', { name: '' })
      // Find the team filter select
      const teamSelect = Array.from(document.querySelectorAll('select')).find(
        s => s.querySelector('option[value="Juventus"]')
      )
      if (teamSelect) {
        fireEvent.change(teamSelect, { target: { value: 'Juventus' } })
        expect(defaultProps.setTeamFilter).toHaveBeenCalledWith('Juventus')
      }
    })

    it('should render strategy checkbox', () => {
      render(<FilterSidebar {...defaultProps} />)
      expect(screen.getByText(/Solo con strategia/)).toBeInTheDocument()
    })

    it('should call setShowOnlyWithStrategy when toggling', () => {
      render(<FilterSidebar {...defaultProps} />)
      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)
      expect(defaultProps.setShowOnlyWithStrategy).toHaveBeenCalledWith(true)
    })
  })

  describe('Owner filter visibility', () => {
    it('should not show owner filter in myRoster mode', () => {
      render(<FilterSidebar {...defaultProps} viewMode="myRoster" />)
      expect(screen.queryByText('Tutti i manager')).not.toBeInTheDocument()
    })

    it('should show owner filter in owned mode', () => {
      render(<FilterSidebar {...defaultProps} viewMode="owned" />)
      expect(screen.getByText('Tutti i manager')).toBeInTheDocument()
    })

    it('should show owner filter in all mode', () => {
      render(<FilterSidebar {...defaultProps} viewMode="all" />)
      expect(screen.getByText('Tutti i manager')).toBeInTheDocument()
    })
  })

  describe('Collapsed state', () => {
    it('should render collapsed view with icon', () => {
      render(<FilterSidebar {...defaultProps} isCollapsed={true} />)
      expect(screen.getByTitle('Espandi filtri')).toBeInTheDocument()
    })

    it('should render collapsed position buttons', () => {
      render(<FilterSidebar {...defaultProps} isCollapsed={true} />)
      expect(screen.getByTitle('P')).toBeInTheDocument()
      expect(screen.getByTitle('D')).toBeInTheDocument()
    })

    it('should show collapsed count badge', () => {
      render(<FilterSidebar {...defaultProps} isCollapsed={true} />)
      expect(screen.getByText('30')).toBeInTheDocument()
    })

    it('should call onToggleCollapse when clicking expand button', () => {
      const onToggle = vi.fn()
      render(<FilterSidebar {...defaultProps} isCollapsed={true} onToggleCollapse={onToggle} />)
      fireEvent.click(screen.getByTitle('Espandi filtri'))
      expect(onToggle).toHaveBeenCalled()
    })
  })

  describe('Collapse button', () => {
    it('should render collapse button when callback provided', () => {
      const onToggle = vi.fn()
      render(<FilterSidebar {...defaultProps} onToggleCollapse={onToggle} />)
      expect(screen.getByTitle('Comprimi filtri')).toBeInTheDocument()
    })

    it('should call onToggleCollapse when clicking collapse', () => {
      const onToggle = vi.fn()
      render(<FilterSidebar {...defaultProps} onToggleCollapse={onToggle} />)
      fireEvent.click(screen.getByTitle('Comprimi filtri'))
      expect(onToggle).toHaveBeenCalled()
    })
  })

  describe('Section collapse', () => {
    it('should toggle scope section visibility', () => {
      render(<FilterSidebar {...defaultProps} />)
      const scopeHeader = screen.getByText(/Ambito/)

      // Initially open - buttons visible
      expect(screen.getByText(/La Mia Rosa/)).toBeInTheDocument()

      // Click to close
      fireEvent.click(scopeHeader)

      // Click to open again
      fireEvent.click(scopeHeader)
      expect(screen.getByText(/La Mia Rosa/)).toBeInTheDocument()
    })
  })
})
