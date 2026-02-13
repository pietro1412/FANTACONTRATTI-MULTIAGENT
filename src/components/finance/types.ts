// Shared types for the finance dashboard components

export interface PlayerData {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  age: number | null
  salary: number
  duration: number
  clause: number
  preRenewalSalary: number
  postRenewalSalary: number | null
  draftDuration: number | null
  draftReleased: boolean
}

export interface TeamData {
  memberId: string
  teamName: string
  username: string
  budget: number
  annualContractCost: number
  totalContractCost: number
  totalAcquisitionCost: number
  slotCount: number
  slotsFree: number
  maxSlots: number
  ageDistribution: {
    under20: number
    under25: number
    under30: number
    over30: number
    unknown: number
  }
  positionDistribution: {
    P: number
    D: number
    C: number
    A: number
  }
  players: PlayerData[]
  preRenewalContractCost: number
  postRenewalContractCost: number | null
  costByPosition: {
    P: { preRenewal: number; postRenewal: number | null }
    D: { preRenewal: number; postRenewal: number | null }
    C: { preRenewal: number; postRenewal: number | null }
    A: { preRenewal: number; postRenewal: number | null }
  }
  isConsolidated: boolean
  consolidatedAt: string | null
  preConsolidationBudget: number | null
  totalReleaseCosts: number | null
  totalIndemnities: number | null
  totalRenewalCosts: number | null
  tradeBudgetIn: number
  tradeBudgetOut: number
}

export interface SessionInfo {
  id: string
  sessionType: string
  currentPhase: string | null
  status: string
  createdAt: string
}

export interface FinancialsData {
  leagueName: string
  maxSlots: number
  teams: TeamData[]
  isAdmin: boolean
  inContrattiPhase: boolean
  availableSessions: SessionInfo[]
  isHistorical?: boolean
  historicalSessionType?: string
  historicalPhase?: string
}

// Computed totals for the league
export interface LeagueTotals {
  totalBudget: number
  totalAcquisitions: number
  totalContracts: number
  totalBalance: number
  totalPlayers: number
  avgAge: number
  totalPreRenewal: number
  totalPostRenewal: number | null
  contractsDelta: number | null
  totalReleaseCosts: number | null
  totalIndemnities: number | null
  hasFinancialDetails: boolean
  totalTradeBudgetIn: number
  totalTradeBudgetOut: number
  hasTradeData: boolean
  // Level 1 KPI additions
  liquidityAvg: number
  liquidityMin: number
  liquidityMax: number
  totalSlots: number
  maxTotalSlots: number
  healthyTeams: number
  warningTeams: number
  criticalTeams: number
  giniIndex: number
}

// Health thresholds
export const HEALTH_THRESHOLDS = {
  balance: { good: 200, warning: 100 },
  salaryPct: { good: 25, warning: 40 },
  concentration: { good: 60, warning: 80 },
  expiringContracts: { good: 2, warning: 4 },
  freeSlots: { good: 3, warning: 1 },
} as const

export type HealthStatus = 'good' | 'warning' | 'critical'

export function getHealthStatus(balance: number): HealthStatus {
  if (balance > HEALTH_THRESHOLDS.balance.good) return 'good'
  if (balance >= HEALTH_THRESHOLDS.balance.warning) return 'warning'
  return 'critical'
}

export const HEALTH_COLORS: Record<HealthStatus, string> = {
  good: 'text-green-400',
  warning: 'text-amber-400',
  critical: 'text-danger-400',
}

export const HEALTH_BG_COLORS: Record<HealthStatus, string> = {
  good: 'bg-green-500/20',
  warning: 'bg-amber-500/20',
  critical: 'bg-danger-500/20',
}

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  good: 'OK',
  warning: 'Attenzione',
  critical: 'Critico',
}

// Position chart colors (hex for recharts)
export const POSITION_CHART_COLORS: Record<string, string> = {
  P: '#eab308',
  D: '#22c55e',
  C: '#3b82f6',
  A: '#ef4444',
}

export const POSITION_NAMES: Record<string, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}

export const POSITION_COLORS: Record<string, string> = {
  P: 'bg-yellow-500/20 text-yellow-400',
  D: 'bg-green-500/20 text-green-400',
  C: 'bg-blue-500/20 text-blue-400',
  A: 'bg-red-500/20 text-red-400',
}

// Utility: calculate Gini coefficient
export function calculateGini(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((s, v) => s + v, 0) / n
  if (mean === 0) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i]!
  }
  return sum / (n * n * mean)
}

// Compute league totals from team data
export function computeLeagueTotals(data: FinancialsData): LeagueTotals {
  const teams = data.teams

  const totalBudget = teams.reduce((sum, t) => sum + t.budget + t.totalAcquisitionCost, 0)
  const totalAcquisitions = teams.reduce((sum, t) => sum + t.totalAcquisitionCost, 0)
  const totalContracts = teams.reduce((sum, t) => sum + t.annualContractCost, 0)

  const totalPreRenewal = teams.reduce((sum, t) => sum + t.preRenewalContractCost, 0)
  const hasPostRenewal = data.inContrattiPhase && teams.some(t => t.postRenewalContractCost !== null)
  const totalPostRenewal = hasPostRenewal
    ? teams.reduce((sum, t) => sum + (t.postRenewalContractCost ?? t.preRenewalContractCost), 0)
    : null

  const totalTradeBudgetIn = teams.reduce((sum, t) => sum + t.tradeBudgetIn, 0)
  const totalTradeBudgetOut = teams.reduce((sum, t) => sum + t.tradeBudgetOut, 0)
  const hasTradeData = totalTradeBudgetIn > 0 || totalTradeBudgetOut > 0

  const rawHasFinancialDetails = teams.some(t => t.totalReleaseCosts !== null || t.totalIndemnities !== null)
  const hasFinancialDetails = rawHasFinancialDetails && !data.inContrattiPhase

  const totalReleaseCosts = hasFinancialDetails
    ? teams.reduce((sum, t) => sum + (t.totalReleaseCosts ?? 0), 0)
    : null
  const totalIndemnities = hasFinancialDetails
    ? teams.reduce((sum, t) => sum + (t.totalIndemnities ?? 0), 0)
    : null

  const totalBalance = hasFinancialDetails
    ? totalBudget - totalAcquisitions - totalContracts - (totalReleaseCosts ?? 0) + (totalIndemnities ?? 0)
    : totalBudget - totalAcquisitions - totalContracts

  // Per-team balances for KPIs
  const teamBalances = teams.map(t => {
    const bal = hasFinancialDetails
      ? t.budget - t.annualContractCost - (t.totalReleaseCosts ?? 0) + (t.totalIndemnities ?? 0)
      : t.budget - t.annualContractCost
    return bal
  })

  const liquidityAvg = teamBalances.length > 0
    ? teamBalances.reduce((s, b) => s + b, 0) / teamBalances.length
    : 0
  const liquidityMin = teamBalances.length > 0 ? Math.min(...teamBalances) : 0
  const liquidityMax = teamBalances.length > 0 ? Math.max(...teamBalances) : 0

  const totalSlots = teams.reduce((sum, t) => sum + t.slotCount, 0)
  const maxTotalSlots = teams.length * (data.maxSlots || 25)

  // Health classification
  let healthyTeams = 0, warningTeams = 0, criticalTeams = 0
  for (const bal of teamBalances) {
    const status = getHealthStatus(bal)
    if (status === 'good') healthyTeams++
    else if (status === 'warning') warningTeams++
    else criticalTeams++
  }

  const giniIndex = calculateGini(teamBalances.map(b => Math.max(0, b)))

  const allPlayers = teams.flatMap(t => t.players).filter(p => p.age != null)
  const avgAge = allPlayers.length > 0
    ? allPlayers.reduce((sum, p) => sum + (p.age || 0), 0) / allPlayers.length
    : 0

  return {
    totalBudget,
    totalAcquisitions,
    totalContracts,
    totalBalance,
    totalPlayers: totalSlots,
    avgAge,
    totalPreRenewal,
    totalPostRenewal,
    contractsDelta: totalPostRenewal !== null ? totalPostRenewal - totalPreRenewal : null,
    totalReleaseCosts,
    totalIndemnities,
    hasFinancialDetails,
    totalTradeBudgetIn,
    totalTradeBudgetOut,
    hasTradeData,
    liquidityAvg,
    liquidityMin,
    liquidityMax,
    totalSlots,
    maxTotalSlots,
    healthyTeams,
    warningTeams,
    criticalTeams,
    giniIndex,
  }
}

// Get team balance
export function getTeamBalance(team: TeamData, hasFinancialDetails: boolean): number {
  return hasFinancialDetails
    ? team.budget - team.annualContractCost - (team.totalReleaseCosts ?? 0) + (team.totalIndemnities ?? 0)
    : team.budget - team.annualContractCost
}
