import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DealTable } from '../components/trades/deal-room/DealTable'
import type { RosterEntry, LeagueMember } from '../components/trades/types'

const withAge: RosterEntry = {
  id: 'r1',
  player: { id: 'p1', name: 'Con Età', team: 'Roma', position: 'A', age: 21, contract: { salary: 1, duration: 2 } },
  acquisitionPrice: 1,
}

const withoutAge: RosterEntry = {
  id: 'r2',
  player: { id: 'p2', name: 'Senza Età', team: 'Napoli', position: 'A', age: null, contract: { salary: 1, duration: 2 } },
  acquisitionPrice: 1,
}

const member: LeagueMember = { id: 'm1', currentBudget: 350, user: { username: 'Sim03' } }

function baseProps(overrides: Partial<React.ComponentProps<typeof DealTable>> = {}): React.ComponentProps<typeof DealTable> {
  return {
    members: [member],
    selectedMemberId: 'm1',
    targetMember: member,
    onMemberChange: vi.fn(),
    myBudget: 400,
    selectedOfferedPlayers: ['r1', 'r2'],
    myRoster: [withAge, withoutAge],
    onRemoveOffered: vi.fn(),
    offeredBudget: 0,
    onOfferedBudgetChange: vi.fn(),
    selectedRequestedPlayers: [],
    allOtherPlayers: [],
    onRemoveRequested: vi.fn(),
    requestedBudget: 0,
    onRequestedBudgetChange: vi.fn(),
    offerDuration: 24,
    onDurationChange: vi.fn(),
    message: '',
    onMessageChange: vi.fn(),
    budgetNow: 400,
    budgetNext: 400,
    salaryNow: 25,
    salaryNext: 25,
    rosterNow: 25,
    rosterNext: 25,
    isSubmitting: false,
    canSubmit: true,
    onSubmit: vi.fn(),
    onOpenMyRoster: vi.fn(),
    onOpenPartnerRoster: vi.fn(),
    ...overrides,
  }
}

describe('DealTable', () => {
  it('mostra sempre l\'eta\' del giocatore (o N.D. se assente) nelle righe Cedo/Ottengo', () => {
    render(<DealTable {...baseProps()} />)

    expect(screen.getByText('· 21a')).toBeInTheDocument()
    expect(screen.getByText('· N.D.')).toBeInTheDocument()
  })

  it('permette di cambiare il destinatario gia\' selezionato azzerandolo', async () => {
    const onMemberChange = vi.fn()
    render(<DealTable {...baseProps({ onMemberChange })} />)

    expect(screen.getByText('Sim03')).toBeInTheDocument()
    await userEvent.click(screen.getByTitle(/Cambia destinatario/i))
    expect(onMemberChange).toHaveBeenCalledWith('')
  })

  it('senza destinatario selezionato mostra la select per sceglierne uno', () => {
    render(<DealTable {...baseProps({ selectedMemberId: '', targetMember: undefined })} />)

    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.queryByTitle(/Cambia destinatario/i)).not.toBeInTheDocument()
  })
})
