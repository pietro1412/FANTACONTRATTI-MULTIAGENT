import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PendingItem } from '@/components/contracts/PendingItem'
import type { ContractPlayer } from '@/components/contracts/shared'

const player: ContractPlayer = {
  id: 'p1',
  name: 'Mario Rossi',
  team: 'Inter',
  position: 'A',
  age: 24,
}

function renderItem(overrides: Partial<Parameters<typeof PendingItem>[0]> = {}) {
  const props = {
    player,
    acquisitionPrice: 30,
    minSalary: 1,
    salary: 5,
    duration: 3,
    inContrattiPhase: true,
    isConsolidated: false,
    onSalaryChange: vi.fn(),
    onDurationChange: vi.fn(),
    onViewStats: vi.fn(),
    ...overrides,
  }
  render(<PendingItem {...props} />)
  return props
}

describe('PendingItem', () => {
  it('should compute clausola (salary × multiplier) and rubata (clausola + salary) in separate columns', () => {
    renderItem()
    // salary 5, duration 3 => multiplier 9 => clausola 45, rubata 50
    expect(screen.getByText('45M')).toBeInTheDocument()
    expect(screen.getByText('50M')).toBeInTheDocument()
    // identifying labels (Axiom 9)
    expect(screen.getByText('Clausola')).toBeInTheDocument()
    expect(screen.getByText('Rubata')).toBeInTheDocument()
  })

  it('should show the SCADE tag when the draft duration is 1 semester', () => {
    renderItem({ duration: 1 })
    expect(screen.getByText('SCADE')).toBeInTheDocument()
    // duration 1 => multiplier 3 => clausola 15, rubata 20
    expect(screen.getByText('15M')).toBeInTheDocument()
    expect(screen.getByText('20M')).toBeInTheDocument()
  })

  it('should not show the SCADE tag when duration is greater than 1', () => {
    renderItem()
    expect(screen.queryByText('SCADE')).not.toBeInTheDocument()
  })

  it('should keep the rubata column visible even when the clause has a validation error', () => {
    renderItem({ validationError: 'Bilancio insufficiente' })
    expect(screen.getByTitle('Bilancio insufficiente')).toBeInTheDocument()
    expect(screen.getByText('50M')).toBeInTheDocument()
  })

  it('should render read-only values (no steppers) when consolidated', () => {
    renderItem({ isConsolidated: true })
    expect(screen.queryByLabelText('Aumenta')).not.toBeInTheDocument()
    expect(screen.getByText('5M')).toBeInTheDocument()
    expect(screen.getByText('3s')).toBeInTheDocument()
  })
})
