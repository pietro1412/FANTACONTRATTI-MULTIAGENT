import { describe, it, expect } from 'vitest'
import { getTeamBalance, computeLeagueTotals, type TeamData, type FinancialsData } from '../components/finance/types'

// Fix 03/09/2026: getTeamBalance/computeLeagueTotals sommavano/sottraevano di nuovo
// totalIndemnities/totalReleaseCosts (snapshot dell'ultimo consolidamento) sopra un
// team.budget che, dopo il rework 01/09/2026, li include gia' (currentBudget e' post-
// consolidamento) — doppio conteggio. Questi test riproducono lo scenario verificato
// (budget 200, releaseCosts 5, indennizzi 40 -> bilancio mostrato 235 invece di 200)
// e verificano che il fix lo elimini.

function makeTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    memberId: 'm1',
    teamName: 'Team 1',
    username: 'user1',
    budget: 200,
    annualContractCost: 0,
    totalContractCost: 0,
    totalAcquisitionCost: 0,
    slotCount: 0,
    slotsFree: 25,
    maxSlots: 25,
    ageDistribution: { under20: 0, under25: 0, under30: 0, over30: 0, unknown: 0 },
    positionDistribution: { P: 0, D: 0, C: 0, A: 0 },
    players: [],
    preRenewalContractCost: 0,
    postRenewalContractCost: null,
    costByPosition: {
      P: { preRenewal: 0, postRenewal: null },
      D: { preRenewal: 0, postRenewal: null },
      C: { preRenewal: 0, postRenewal: null },
      A: { preRenewal: 0, postRenewal: null },
    },
    isConsolidated: true,
    consolidatedAt: null,
    preConsolidationBudget: null,
    totalReleaseCosts: null,
    totalIndemnities: null,
    totalRenewalCosts: null,
    tradeBudgetIn: 0,
    tradeBudgetOut: 0,
    ...overrides,
  }
}

describe('getTeamBalance', () => {
  it('non applica piu la correzione totalReleaseCosts/totalIndemnities (doppio conteggio)', () => {
    const team = makeTeam({ budget: 200, annualContractCost: 0, totalReleaseCosts: 5, totalIndemnities: 40 })
    // budget e' gia' post-consolidamento: il vero bilancio disponibile e' 200, non 200-5+40=235
    expect(getTeamBalance(team, true, false)).toBe(200)
  })

  it('ignora hasFinancialDetails=false allo stesso modo', () => {
    const team = makeTeam({ budget: 200, annualContractCost: 0, totalReleaseCosts: 5, totalIndemnities: 40 })
    expect(getTeamBalance(team, false, false)).toBe(200)
  })

  it('sottrae il monte ingaggi non pagato quando diverso da zero', () => {
    const team = makeTeam({ budget: 200, annualContractCost: 30 })
    expect(getTeamBalance(team, true, false)).toBe(170)
  })

  it('preConsolidation=true: ritorna il budget puro, invariato', () => {
    const team = makeTeam({ budget: 200, annualContractCost: 30, totalReleaseCosts: 5, totalIndemnities: 40 })
    expect(getTeamBalance(team, true, true)).toBe(200)
  })
})

describe('computeLeagueTotals', () => {
  function makeData(teams: TeamData[]): FinancialsData {
    return {
      leagueName: 'Test League',
      maxSlots: 25,
      teams,
      isAdmin: false,
      inContrattiPhase: false,
      availableSessions: [],
    }
  }

  it('totalBalance non applica piu il doppio conteggio', () => {
    const teams = [
      makeTeam({ memberId: 'm1', budget: 200, annualContractCost: 0, totalReleaseCosts: 5, totalIndemnities: 40 }),
      makeTeam({ memberId: 'm2', budget: 100, annualContractCost: 0, totalReleaseCosts: 0, totalIndemnities: 10 }),
    ]
    const totals = computeLeagueTotals(makeData(teams))
    expect(totals.totalBalance).toBe(300) // 200 + 100, non 200-5+40 + 100-0+10
  })

  it('hasFinancialDetails/totalReleaseCosts/totalIndemnities restano calcolati come dato informativo', () => {
    const teams = [
      makeTeam({ memberId: 'm1', totalReleaseCosts: 5, totalIndemnities: 40 }),
    ]
    const totals = computeLeagueTotals(makeData(teams))
    expect(totals.hasFinancialDetails).toBe(true)
    expect(totals.totalReleaseCosts).toBe(5)
    expect(totals.totalIndemnities).toBe(40)
  })
})
