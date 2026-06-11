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
  // Budget reservation during primo mercato (ASTA_LIBERA)
  slotReserve?: number
  availableBilancio?: number
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
  inAstaLiberaPhase?: boolean
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
  good: 'text-secondary-400',
  warning: 'text-warning-400',
  critical: 'text-danger-400',
}

export const HEALTH_BG_COLORS: Record<HealthStatus, string> = {
  good: 'bg-secondary-500/20',
  warning: 'bg-warning-500/20',
  critical: 'bg-danger-500/20',
}

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  good: 'OK',
  warning: 'Attenzione',
  critical: 'Critico',
}

// Centralized Stadium Nights hex tokens for recharts (single source for chart colors)
export const CHART_COLORS = {
  primary: '#3b82f6',      // primary-500 (blu stadio)
  primaryDark: '#2563eb',  // primary-600
  secondary: '#22c55e',    // secondary-500 (verde campo)
  accent: '#f59e0b',       // accent-500 (oro trofeo)
  accentLight: '#fbbf24',  // accent-400
  danger: '#ef4444',       // danger-500
  grid: '#2d3139',         // surface-50 (bordi)
  axis: '#9ca3af',         // gray-400
  muted: '#8b919d',        // gray-500
  neutralLine: '#4b5563',  // gray-700 (linee non evidenziate)
  tooltipBg: '#1a1c20',    // surface-200
  tooltipBorder: '#2d3139',
} as const

// Recharts tooltip style shared across finance charts
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.tooltipBg,
  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
  borderRadius: 8,
  fontSize: 12,
} as const

// Humanized labels for market session phases (no raw enums in UI)
export const SESSION_PHASE_LABELS: Record<string, string> = {
  ASTA_LIBERA: 'Asta libera',
  OFFERTE_PRE_RINNOVO: 'Offerte pre-rinnovo',
  PREMI: 'Premi',
  CONTRATTI: 'Contratti',
  CALCOLO_INDENNIZZI: 'Calcolo indennizzi',
  RUBATA: 'Rubata',
  ASTA_SVINCOLATI: 'Asta svincolati',
  OFFERTE_POST_ASTA_SVINCOLATI: 'Offerte post-asta',
}

export function formatPhaseLabel(phase: string | null | undefined): string {
  if (!phase) return ''
  return SESSION_PHASE_LABELS[phase] ?? phase.replaceAll('_', ' ').toLowerCase()
}

const MONTH_SHORT_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'] as const

// Humanized session label: "Primo Mercato 2025/26", "Mercato Riparazione · Gen 2026"
export function formatSessionLabel(session: SessionInfo): string {
  const date = new Date(session.createdAt)
  const year = date.getFullYear()
  const month = date.getMonth()
  if (session.sessionType === 'PRIMO_MERCATO') {
    // Football season: July-June
    const startYear = month >= 6 ? year : year - 1
    const endShort = String((startYear + 1) % 100).padStart(2, '0')
    return `Primo Mercato ${startYear}/${endShort}`
  }
  return `Mercato Riparazione · ${MONTH_SHORT_IT[month] ?? ''} ${year}`
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

// Re-exported from canonical source
export { POSITION_FILTER_COLORS as POSITION_COLORS } from '@/components/ui/PositionBadge'

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
