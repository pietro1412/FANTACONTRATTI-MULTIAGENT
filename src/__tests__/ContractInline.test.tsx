import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractInline } from '@/components/ui/ContractInline'

describe('ContractInline', () => {
  it('should render salary and duration with identifying labels (full)', () => {
    render(<ContractInline salary={12} duration={3} />)
    expect(screen.getByText('Ingaggio')).toBeInTheDocument()
    expect(screen.getByText('Durata')).toBeInTheDocument()
    expect(screen.getByText('12M')).toBeInTheDocument()
    expect(screen.getByText('3 sem')).toBeInTheDocument()
  })

  it('should render abbreviated labels in compact variant', () => {
    render(<ContractInline salary={12} duration={3} variant="compact" />)
    expect(screen.getByText('Ing')).toBeInTheDocument()
    expect(screen.getByText('Dur')).toBeInTheDocument()
    expect(screen.getByText('3 s')).toBeInTheDocument()
  })

  it('should keep an accessible extended label in compact variant', () => {
    render(<ContractInline salary={12} duration={3} variant="compact" />)
    expect(screen.getByLabelText('Ingaggio 12M')).toBeInTheDocument()
    expect(screen.getByLabelText('Durata 3 s')).toBeInTheDocument()
  })

  it('should render the clause when provided', () => {
    render(<ContractInline salary={12} duration={3} clause={84} />)
    expect(screen.getByText('Clausola')).toBeInTheDocument()
    expect(screen.getByText('84M')).toBeInTheDocument()
  })

  it('should NOT render the clause when null', () => {
    render(<ContractInline salary={12} duration={3} clause={null} />)
    expect(screen.queryByText('Clausola')).not.toBeInTheDocument()
  })

  it('should render the rubata price when provided', () => {
    render(<ContractInline salary={12} duration={3} rubataPrice={96} />)
    expect(screen.getByText('Rubata')).toBeInTheDocument()
    expect(screen.getByText('96M')).toBeInTheDocument()
  })

  it('should never show a bare number without a label', () => {
    render(<ContractInline salary={12} duration={3} clause={84} rubataPrice={96} />)
    // Every credit value sits next to its label
    expect(screen.getByLabelText('Ingaggio 12M')).toBeInTheDocument()
    expect(screen.getByLabelText('Clausola rescissoria 84M')).toBeInTheDocument()
    expect(screen.getByLabelText('Prezzo rubata 96M')).toBeInTheDocument()
  })
})
