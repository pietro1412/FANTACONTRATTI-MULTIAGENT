import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RenewalItem, type RenewalItemContract } from '@/components/contracts/RenewalItem'
import type { ContractPlayer } from '@/components/contracts/shared'

const player: ContractPlayer = {
  id: 'p1',
  name: 'Mario Rossi',
  team: 'Inter',
  position: 'A',
  age: 24,
}

const baseContract: RenewalItemContract = {
  id: 'c1',
  salary: 8,
  duration: 2,
  initialSalary: 8,
  rescissionClause: 56,
  canRenew: true,
  canSpalmare: false,
  draftSalary: null,
  draftDuration: null,
  player,
  acquisitionType: 'FIRST_MARKET',
}

function renderItem(overrides: Partial<Parameters<typeof RenewalItem>[0]> = {}) {
  const props = {
    contract: baseContract,
    newSalary: 8,
    newDuration: 2,
    isMarkedForRelease: false,
    isKeptExited: false,
    inContrattiPhase: true,
    isConsolidated: false,
    onSalaryChange: vi.fn(),
    onDurationChange: vi.fn(),
    onToggleRelease: vi.fn(),
    onRemoveKept: vi.fn(),
    onViewStats: vi.fn(),
    ...overrides,
  }
  render(<RenewalItem {...props} />)
  return props
}

describe('RenewalItem', () => {
  it('should show current and renewal salary/duration in separate labeled columns', () => {
    renderItem({ newSalary: 10, newDuration: 3 })
    // current read-only values
    expect(screen.getByText('8M')).toBeInTheDocument()
    expect(screen.getByText('2s')).toBeInTheDocument()
    // renewal stepper values
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    // identifying labels (Axiom 9)
    expect(screen.getByText('Ingaggio attuale')).toBeInTheDocument()
    expect(screen.getByText('Durata attuale')).toBeInTheDocument()
    expect(screen.getByText('Ingaggio rinnovo')).toBeInTheDocument()
    expect(screen.getByText('Durata rinnovo')).toBeInTheDocument()
  })

  it('should compute renewal clausola and rubata from new salary/duration', () => {
    renderItem({ newSalary: 10, newDuration: 3 })
    // multiplier for 3 semestri = 9 => clausola 90, rubata 100
    expect(screen.getByText('90M')).toBeInTheDocument()
    expect(screen.getByText('100M')).toBeInTheDocument()
  })

  it('should show unchanged clausola/rubata when the draft matches the current contract', () => {
    renderItem()
    // multiplier for 2 semestri = 7 => clausola 56, rubata 64
    expect(screen.getByText('56M')).toBeInTheDocument()
    expect(screen.getByText('64M')).toBeInTheDocument()
  })

  it('should show the SCADE tag when the current contract expires in 1 semester', () => {
    renderItem({ contract: { ...baseContract, duration: 1 } })
    expect(screen.getByText('SCADE')).toBeInTheDocument()
  })

  it('should show the release cost instead of clausola/rubata when marked for release', () => {
    renderItem({ isMarkedForRelease: true })
    // release cost = ceil(8 × 2 / 2) = 8
    expect(screen.getByText('costo taglio')).toBeInTheDocument()
    expect(screen.getByText('−8M')).toBeInTheDocument()
    // clausola/rubata are hidden for released players
    expect(screen.queryByText('56M')).not.toBeInTheDocument()
    expect(screen.queryByText('64M')).not.toBeInTheDocument()
  })

  it('should show consolidated read-only values and the RINNOVATO tag after consolidation', () => {
    renderItem({
      inContrattiPhase: false,
      isConsolidated: true,
      contract: { ...baseContract, draftSalary: 9, draftDuration: 3, wasModified: true },
    })
    // consolidated: salary 9M, duration 3s, clausola 9 × 9 = 81M, rubata 90M
    expect(screen.getByText('9M')).toBeInTheDocument()
    expect(screen.getByText('3s')).toBeInTheDocument()
    expect(screen.getByText('81M')).toBeInTheDocument()
    expect(screen.getByText('90M')).toBeInTheDocument()
    expect(screen.getByText('RINNOVATO')).toBeInTheDocument()
  })
})
