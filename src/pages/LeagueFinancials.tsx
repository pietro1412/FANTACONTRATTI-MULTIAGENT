import { useState, useEffect, useMemo } from 'react'
import { Navigation } from '../components/Navigation'
import { leagueApi } from '../services/api'

// ============================================================================
// SVG Chart Components (no external dependencies)
// ============================================================================

// Donut Chart for position distribution
interface DonutChartProps {
  data: { label: string; value: number; color: string }[]
  size?: number
  innerRadius?: number
}

function DonutChart({ data, size = 180, innerRadius = 50 }: DonutChartProps) {
  const center = size / 2
  const outerRadius = (size / 2) - 10
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-gray-500 text-sm">Nessun dato</span>
      </div>
    )
  }

  let currentAngle = -Math.PI / 2 // Start from top

  const slices = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    // Calculate arc path
    const x1 = center + outerRadius * Math.cos(startAngle)
    const y1 = center + outerRadius * Math.sin(startAngle)
    const x2 = center + outerRadius * Math.cos(endAngle)
    const y2 = center + outerRadius * Math.sin(endAngle)
    const x3 = center + innerRadius * Math.cos(endAngle)
    const y3 = center + innerRadius * Math.sin(endAngle)
    const x4 = center + innerRadius * Math.cos(startAngle)
    const y4 = center + innerRadius * Math.sin(startAngle)

    const largeArc = angle > Math.PI ? 1 : 0

    const path = `
      M ${x1} ${y1}
      A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
      Z
    `

    // Calculate label position (middle of arc)
    const midAngle = startAngle + angle / 2
    const labelRadius = (outerRadius + innerRadius) / 2
    const labelX = center + labelRadius * Math.cos(midAngle)
    const labelY = center + labelRadius * Math.sin(midAngle)

    return { ...d, path, labelX, labelY, percentage: Math.round((d.value / total) * 100) }
  })

  // Responsive font sizes based on chart size
  const isSmall = size < 160
  const labelFontSize = isSmall ? 9 : 11
  const centerLabelSize = isSmall ? 8 : 10
  const centerValueSize = isSmall ? 11 : 14

  return (
    <div className="flex flex-col items-center gap-2 md:gap-3">
      <svg width={size} height={size}>
        {slices.map((slice, i) => (
          <g key={i}>
            <path
              d={slice.path}
              fill={slice.color}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="1"
              className="transition-opacity hover:opacity-80"
            />
            {slice.percentage >= (isSmall ? 15 : 10) && (
              <text
                x={slice.labelX}
                y={slice.labelY}
                fill="white"
                fontSize={labelFontSize}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {slice.percentage}%
              </text>
            )}
          </g>
        ))}
        {/* Center text */}
        <text
          x={center}
          y={center - (isSmall ? 6 : 8)}
          fill="rgba(255,255,255,0.7)"
          fontSize={centerLabelSize}
          textAnchor="middle"
        >
          Totale
        </text>
        <text
          x={center}
          y={center + (isSmall ? 6 : 8)}
          fill="white"
          fontSize={centerValueSize}
          fontWeight="bold"
          textAnchor="middle"
        >
          {total}M
        </text>
      </svg>
      {/* Legend - compact on small charts */}
      <div className={`flex flex-wrap justify-center gap-2 md:gap-3 ${isSmall ? 'text-[10px]' : 'text-xs'}`}>
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-1 md:gap-1.5">
            <div className={`${isSmall ? 'w-2 h-2' : 'w-3 h-3'} rounded`} style={{ backgroundColor: slice.color }} />
            <span className="text-gray-400">{isSmall ? slice.label.charAt(0) : slice.label}</span>
            <span className="text-white font-medium">{slice.value}M</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Bar Chart for budget comparison
interface BarChartProps {
  budget: number
  contracts: number
  height?: number
}

function BudgetBarChart({ budget, contracts, height = 120 }: BarChartProps) {
  const maxValue = Math.max(budget, contracts, 1)
  const budgetWidth = (budget / maxValue) * 100
  const contractsWidth = (contracts / maxValue) * 100
  const balance = budget - contracts

  return (
    <div className="flex flex-col gap-2 md:gap-3" style={{ minHeight: height }}>
      {/* Budget bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[10px] md:text-xs">
          <span className="text-gray-400">Budget</span>
          <span className="text-primary-400 font-medium">{budget}M</span>
        </div>
        <div className="h-5 md:h-6 bg-surface-100/50 rounded-lg overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-lg transition-all duration-500"
            style={{ width: `${budgetWidth}%` }}
          />
        </div>
      </div>

      {/* Contracts bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[10px] md:text-xs">
          <span className="text-gray-400">Contratti</span>
          <span className="text-accent-400 font-medium">{contracts}M</span>
        </div>
        <div className="h-5 md:h-6 bg-surface-100/50 rounded-lg overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-lg transition-all duration-500"
            style={{ width: `${contractsWidth}%` }}
          />
        </div>
      </div>

      {/* Balance indicator */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-50/20">
        <span className="text-[10px] md:text-xs text-gray-400">Bilancio</span>
        <span className={`text-xs md:text-sm font-bold ${balance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
          {balance >= 0 ? '+' : ''}{balance}M
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Types
// ============================================================================

interface PlayerData {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  age: number | null
  salary: number
  duration: number
  clause: number
  // #193: Pre/Post renewal values
  preRenewalSalary: number
  postRenewalSalary: number | null
  draftDuration: number | null
  draftReleased: boolean
}

interface TeamData {
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
  // #193: Pre/Post renewal aggregates
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
  // Detailed financial breakdown from session snapshot
  preConsolidationBudget: number | null
  totalReleaseCosts: number | null
  totalIndemnities: number | null
  totalRenewalCosts: number | null
}

interface SessionInfo {
  id: string
  sessionType: string
  currentPhase: string | null
  status: string
  createdAt: string
}

interface FinancialsData {
  leagueName: string
  maxSlots: number
  teams: TeamData[]
  isAdmin: boolean
  // #193: Phase info
  inContrattiPhase: boolean
  // OSS-6: Available sessions for phase selector
  availableSessions: SessionInfo[]
}

// Sort field type
type SortField = 'teamName' | 'budget' | 'totalAcquisitionCost' | 'annualContractCost' | 'balance' | 'slotCount' | 'under20' | 'under25' | 'under30' | 'over30'

// Position colors (for badges)
const POSITION_COLORS: Record<string, string> = {
  P: 'bg-yellow-500/20 text-yellow-400',
  D: 'bg-green-500/20 text-green-400',
  C: 'bg-blue-500/20 text-blue-400',
  A: 'bg-red-500/20 text-red-400',
}

// Position colors for charts (hex values)
const POSITION_CHART_COLORS: Record<string, string> = {
  P: '#eab308', // yellow-500
  D: '#22c55e', // green-500
  C: '#3b82f6', // blue-500
  A: '#ef4444', // red-500
}

// Position full names
const POSITION_NAMES: Record<string, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}

// Age color coding - younger is better
function getAgeBgColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'bg-gray-500/20 text-gray-400'
  if (age < 20) return 'bg-emerald-500/20 text-emerald-400 font-bold'
  if (age < 25) return 'bg-green-500/20 text-green-400'
  if (age < 30) return 'bg-yellow-500/20 text-yellow-400'
  if (age < 35) return 'bg-orange-500/20 text-orange-400'
  return 'bg-red-500/20 text-red-400'
}

interface LeagueFinancialsProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

export default function LeagueFinancials({ leagueId, onNavigate }: LeagueFinancialsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FinancialsData | null>(null)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('teamName')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [selectedSession, setSelectedSession] = useState<string | undefined>(undefined)

  useEffect(() => {
    loadFinancials()
  }, [leagueId, selectedSession])

  async function loadFinancials() {
    if (!leagueId) return
    setLoading(true)
    setError(null)

    try {
      const result = await leagueApi.getFinancials(leagueId, selectedSession)
      if (result.success && result.data) {
        setData(result.data)
        setIsLeagueAdmin(result.data.isAdmin || false)
      } else {
        setError(result.message || 'Errore nel caricamento dei dati finanziari')
      }
    } catch {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sorted teams
  const sortedTeams = useMemo(() => {
    if (!data?.teams) return []

    return [...data.teams].sort((a, b) => {
      let valueA: number | string
      let valueB: number | string

      switch (sortField) {
        case 'teamName':
          valueA = a.teamName.toLowerCase()
          valueB = b.teamName.toLowerCase()
          break
        case 'budget':
          valueA = a.budget
          valueB = b.budget
          break
        case 'totalAcquisitionCost':
          valueA = a.totalAcquisitionCost
          valueB = b.totalAcquisitionCost
          break
        case 'annualContractCost':
          valueA = a.annualContractCost
          valueB = b.annualContractCost
          break
        case 'balance':
          valueA = a.budget - a.annualContractCost
          valueB = b.budget - b.annualContractCost
          break
        case 'slotCount':
          valueA = a.slotCount
          valueB = b.slotCount
          break
        case 'under20':
          valueA = a.ageDistribution.under20
          valueB = b.ageDistribution.under20
          break
        case 'under25':
          valueA = a.ageDistribution.under25
          valueB = b.ageDistribution.under25
          break
        case 'under30':
          valueA = a.ageDistribution.under30
          valueB = b.ageDistribution.under30
          break
        case 'over30':
          valueA = a.ageDistribution.over30
          valueB = b.ageDistribution.over30
          break
        default:
          return 0
      }

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [data?.teams, sortField, sortDirection])

  // Calculate league totals (including pre/post renewal for #193)
  const totals = useMemo(() => {
    if (!data?.teams) return null

    const totalBudget = data.teams.reduce((sum, t) => sum + t.budget, 0)
    const totalAcquisitions = data.teams.reduce((sum, t) => sum + t.totalAcquisitionCost, 0)
    const totalContracts = data.teams.reduce((sum, t) => sum + t.annualContractCost, 0)

    // #193: Pre/Post renewal totals
    const totalPreRenewal = data.teams.reduce((sum, t) => sum + t.preRenewalContractCost, 0)
    const hasPostRenewal = data.inContrattiPhase && data.teams.some(t => t.postRenewalContractCost !== null)
    const totalPostRenewal = hasPostRenewal
      ? data.teams.reduce((sum, t) => sum + (t.postRenewalContractCost ?? t.preRenewalContractCost), 0)
      : null

    // Aggregate tagli/indennizzi
    // Durante CONTRATTI: MAI mostrare (dati congelati, niente tagli/indennizzi)
    // Dopo CONTRATTI (es. RUBATA): mostra se ci sono dati
    const rawHasFinancialDetails = data.teams.some(t => t.totalReleaseCosts !== null || t.totalIndemnities !== null)
    const hasFinancialDetails = rawHasFinancialDetails && !data?.inContrattiPhase

    const totalReleaseCosts = hasFinancialDetails
      ? data.teams.reduce((sum, t) => sum + (t.totalReleaseCosts ?? 0), 0)
      : null
    const totalIndemnities = hasFinancialDetails
      ? data.teams.reduce((sum, t) => sum + (t.totalIndemnities ?? 0), 0)
      : null

    // Bilancio: Budget - Contratti - Tagli + Indennizzi (quando disponibili)
    const totalBalance = hasFinancialDetails
      ? totalBudget - totalContracts - (totalReleaseCosts ?? 0) + (totalIndemnities ?? 0)
      : totalBudget - totalContracts

    return {
      totalBudget,
      totalAcquisitions,
      totalContracts,
      totalBalance,
      totalPlayers: data.teams.reduce((sum, t) => sum + t.slotCount, 0),
      avgAge: (() => {
        const allPlayers = data.teams.flatMap(t => t.players).filter(p => p.age != null)
        if (allPlayers.length === 0) return 0
        return allPlayers.reduce((sum, p) => sum + (p.age || 0), 0) / allPlayers.length
      })(),
      // #193: Pre/Post renewal
      totalPreRenewal,
      totalPostRenewal,
      contractsDelta: totalPostRenewal !== null ? totalPostRenewal - totalPreRenewal : null,
      // Aggregate financial details
      totalReleaseCosts,
      totalIndemnities,
      hasFinancialDetails,
    }
  }, [data?.teams, data?.inContrattiPhase])

  // Sortable header component
  const SortableHeader = ({ field, label, className = '', hideOnMobile = false }: { field: SortField; label: string; className?: string; hideOnMobile?: boolean }) => (
    <th
      className={`px-2 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${className} ${hideOnMobile ? 'hidden md:table-cell' : ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-200">
        <Navigation
          currentPage="financials"
          leagueId={leagueId}
          leagueName={data?.leagueName}
          isLeagueAdmin={isLeagueAdmin}
          onNavigate={onNavigate}
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-surface-300 rounded w-1/3"></div>
            <div className="h-64 bg-surface-300 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-200">
        <Navigation
          currentPage="financials"
          leagueId={leagueId}
          isLeagueAdmin={isLeagueAdmin}
          onNavigate={onNavigate}
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-6 text-center">
            <p className="text-danger-400">{error}</p>
            <button
              onClick={loadFinancials}
              className="mt-4 px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-200">
      <Navigation
        currentPage="financials"
        leagueId={leagueId}
        leagueName={data?.leagueName}
        isLeagueAdmin={isLeagueAdmin}
        onNavigate={onNavigate}
      />

      <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-white">Finanze Lega</h1>
          <p className="text-gray-400 mt-1 text-sm md:text-base">Panoramica finanziaria di tutte le squadre</p>
        </div>

        {/* #193: CONTRATTI Phase Banner */}
        {data?.inContrattiPhase && (
          <div className="mb-4 md:mb-6 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 text-base md:text-lg">$</span>
              </div>
              <div className="min-w-0">
                <div className="font-medium text-amber-400 text-sm md:text-base">Fase Contratti in Corso</div>
                <div className="text-xs md:text-sm text-amber-400/70">
                  Confronto costi pre/post-rinnovo
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OSS-6: Phase selector for historical data */}
        {data?.availableSessions && data.availableSessions.length > 0 && (
          <div className="mb-4 md:mb-6">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <span className="text-xs md:text-sm text-gray-400 font-medium">Fase:</span>
              <button
                onClick={() => setSelectedSession(undefined)}
                className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  !selectedSession
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                Attuale
              </button>
              {data.availableSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session.id)}
                  className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                    selectedSession === session.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                  }`}
                >
                  {session.sessionType === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                  {session.currentPhase ? ` - ${session.currentPhase}` : ''}
                  <span className="ml-1 opacity-60">({session.status === 'ACTIVE' ? 'In corso' : 'Completata'})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* League Totals */}
        {totals && (
          <div className="mb-4 md:mb-6">
            {/* OSS-6: Formula breakdown */}
            {totals.totalAcquisitions > 0 && (
              <div className="mb-3 md:mb-4 bg-surface-300/30 rounded-lg p-3 md:p-4 border border-surface-50/10">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-2">Formula Bilancio</div>
                <div className="flex items-center flex-wrap gap-1 text-xs md:text-sm">
                  <span className="text-gray-400">Budget Iniziale</span>
                  <span className="text-primary-400 font-bold">({totals.totalBudget + totals.totalAcquisitions}M)</span>
                  <span className="text-gray-500">-</span>
                  <span className="text-gray-400">Acquisti</span>
                  <span className="text-orange-400 font-bold">({totals.totalAcquisitions}M)</span>
                  <span className="text-gray-500">=</span>
                  <span className="text-gray-400">Budget Attuale</span>
                  <span className="text-primary-400 font-bold">({totals.totalBudget}M)</span>
                  <span className="text-gray-500">-</span>
                  <span className="text-gray-400">Ingaggi</span>
                  <span className="text-accent-400 font-bold">({totals.totalContracts}M)</span>
                  <span className="text-gray-500">=</span>
                  <span className="text-gray-400">Bilancio</span>
                  <span className={`font-bold ${totals.totalBalance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                    ({totals.totalBalance >= 0 ? '+' : ''}{totals.totalBalance}M)
                  </span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
              <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Budget Totale</div>
                <div className="text-lg md:text-xl font-bold text-primary-400">{totals.totalBudget}M</div>
              </div>
              {/* OSS-6: Acquisti totali */}
              <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-orange-500/20">
                <div className="text-[10px] md:text-xs text-orange-400/70 uppercase tracking-wider">Acquisti</div>
                <div className="text-lg md:text-xl font-bold text-orange-400">{totals.totalAcquisitions}M</div>
              </div>
              {/* #193: Show pre/post renewal contracts during CONTRATTI phase */}
              {data?.inContrattiPhase && totals.totalPostRenewal !== null ? (
                <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
                  <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Contratti</div>
                  <div className="flex items-baseline gap-1 md:gap-2 flex-wrap">
                    <span className="text-xs md:text-sm text-gray-500 line-through">{totals.totalPreRenewal}M</span>
                    <span className="text-lg md:text-xl font-bold text-accent-400">{totals.totalPostRenewal}M</span>
                  </div>
                  {totals.contractsDelta !== null && totals.contractsDelta !== 0 && (
                    <div className={`text-[10px] md:text-xs mt-1 ${totals.contractsDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {totals.contractsDelta > 0 ? '+' : ''}{totals.contractsDelta}M
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
                  <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Contratti</div>
                  <div className="text-lg md:text-xl font-bold text-accent-400">{totals.totalContracts}M</div>
                </div>
              )}
              <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Bilancio</div>
                <div className={`text-lg md:text-xl font-bold ${totals.totalBalance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                  {totals.totalBalance >= 0 ? '+' : ''}{totals.totalBalance}M
                </div>
              </div>
              <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Giocatori</div>
                <div className="text-lg md:text-xl font-bold text-white">{totals.totalPlayers}</div>
              </div>
              <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10 col-span-2 sm:col-span-1">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Età Media</div>
                <div className="text-lg md:text-xl font-bold text-secondary-400">{totals.avgAge.toFixed(1)} anni</div>
              </div>
            </div>

            {/* Tagli/Indennizzi totals row - shown when data is available */}
            {totals.hasFinancialDetails && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4 mt-2 md:mt-4">
                <div className="bg-danger-500/10 rounded-lg p-3 md:p-4 border border-danger-500/20">
                  <div className="text-[10px] md:text-xs text-danger-400/70 uppercase tracking-wider">Tagli Totali</div>
                  <div className="text-lg md:text-xl font-bold text-danger-400">
                    {totals.totalReleaseCosts !== null ? `-${totals.totalReleaseCosts}M` : '-'}
                  </div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-3 md:p-4 border border-green-500/20">
                  <div className="text-[10px] md:text-xs text-green-400/70 uppercase tracking-wider">Indennizzi Totali</div>
                  <div className="text-lg md:text-xl font-bold text-green-400">
                    {totals.totalIndemnities !== null ? `+${totals.totalIndemnities}M` : '-'}
                  </div>
                </div>
                <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10 col-span-2">
                  <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Impatto Netto</div>
                  {totals.totalReleaseCosts !== null && totals.totalIndemnities !== null && (
                    (() => {
                      const netImpact = (totals.totalIndemnities ?? 0) - (totals.totalReleaseCosts ?? 0)
                      return (
                        <div className={`text-lg md:text-xl font-bold ${netImpact >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                          {netImpact >= 0 ? '+' : ''}{netImpact}M
                        </div>
                      )
                    })()
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teams Table */}
        <div className="bg-surface-300/30 rounded-xl border border-surface-50/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-0">
              <thead className="bg-surface-300/50">
                <tr>
                  <SortableHeader field="teamName" label="Squadra" />
                  <SortableHeader field="budget" label="Budget" className="text-right" />
                  {/* OSS-6: Acquisti column */}
                  <SortableHeader field="totalAcquisitionCost" label="Acquisti" className="text-right" hideOnMobile />
                  {/* Show Tagli/Indennizzi columns when data is available */}
                  {totals?.hasFinancialDetails && (
                    <>
                      <th className="hidden md:table-cell px-2 md:px-3 py-3 text-right text-xs font-medium text-danger-400 uppercase tracking-wider">Tagli</th>
                      <th className="hidden md:table-cell px-2 md:px-3 py-3 text-right text-xs font-medium text-green-400 uppercase tracking-wider">Indenn.</th>
                    </>
                  )}
                  <SortableHeader field="annualContractCost" label="Contratti" className="text-right" />
                  <SortableHeader field="balance" label="Bilancio" className="text-right" hideOnMobile />
                  <SortableHeader field="slotCount" label="Rosa" className="text-center" hideOnMobile />
                  <th className="hidden lg:table-cell px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Ruoli</th>
                  <th className="hidden xl:table-cell px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider" colSpan={4}>Distribuzione Età</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50/10">
                {sortedTeams.map((team) => {
                  const isExpanded = expandedTeam === team.memberId
                  // Bilancio: Budget - Contratti - Tagli + Indennizzi (quando disponibili)
                  const balance = totals?.hasFinancialDetails
                    ? team.budget - team.annualContractCost - (team.totalReleaseCosts ?? 0) + (team.totalIndemnities ?? 0)
                    : team.budget - team.annualContractCost
                  const balanceLow = balance < 0
                  // #193: Calculate delta for pre/post renewal
                  const showPrePost = data?.inContrattiPhase && team.postRenewalContractCost !== null && !team.isConsolidated
                  const contractDelta = showPrePost
                    ? (team.postRenewalContractCost! - team.preRenewalContractCost)
                    : null

                  return (
                    <>
                      <tr
                        key={team.memberId}
                        onClick={() => setExpandedTeam(isExpanded ? null : team.memberId)}
                        className={`hover:bg-surface-300/30 transition-colors cursor-pointer ${balanceLow ? 'bg-danger-500/5' : ''} ${isExpanded ? 'bg-surface-300/20' : ''}`}
                      >
                        {/* Team name */}
                        <td className="px-2 md:px-4 py-3 md:py-4">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <span className={`text-gray-500 transition-transform text-xs md:text-base ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                                <span className="font-medium text-white text-sm md:text-base truncate">{team.teamName}</span>
                                {/* #193: Consolidated badge */}
                                {data?.inContrattiPhase && team.isConsolidated && (
                                  <span className="px-1 md:px-1.5 py-0.5 text-[8px] md:text-[10px] rounded bg-green-500/20 text-green-400 font-medium whitespace-nowrap">
                                    CONSOLIDATO
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] md:text-xs text-gray-500 truncate">@{team.username}</div>
                            </div>
                          </div>
                        </td>

                        {/* Budget */}
                        <td className="px-2 md:px-4 py-3 md:py-4 text-right font-medium text-primary-400 text-sm md:text-base whitespace-nowrap">
                          {team.budget}M
                        </td>

                        {/* OSS-6: Acquisti column */}
                        <td className="hidden md:table-cell px-2 md:px-3 py-3 md:py-4 text-right font-medium text-orange-400 text-sm whitespace-nowrap">
                          {team.totalAcquisitionCost > 0 ? `${team.totalAcquisitionCost}M` : '-'}
                        </td>

                        {/* Tagli column - only shown when data is available */}
                        {totals?.hasFinancialDetails && (
                          <td className="hidden md:table-cell px-2 md:px-3 py-3 md:py-4 text-right font-medium text-danger-400 text-sm whitespace-nowrap">
                            {team.totalReleaseCosts !== null ? `-${team.totalReleaseCosts}M` : '-'}
                          </td>
                        )}

                        {/* Indennizzi column - only shown when data is available */}
                        {totals?.hasFinancialDetails && (
                          <td className="hidden md:table-cell px-2 md:px-3 py-3 md:py-4 text-right font-medium text-green-400 text-sm whitespace-nowrap">
                            {team.totalIndemnities !== null && team.totalIndemnities > 0 ? `+${team.totalIndemnities}M` : '-'}
                          </td>
                        )}

                        {/* #193: Contracts with pre/post renewal */}
                        <td className="px-2 md:px-4 py-3 md:py-4 text-right">
                          {showPrePost ? (
                            <div className="flex flex-col items-end">
                              <div className="flex items-baseline gap-1 md:gap-2">
                                <span className="text-[10px] md:text-xs text-gray-500 line-through">{team.preRenewalContractCost}M</span>
                                <span className="font-medium text-accent-400 text-sm md:text-base">{team.postRenewalContractCost}M</span>
                              </div>
                              {contractDelta !== null && contractDelta !== 0 && (
                                <span className={`text-[8px] md:text-[10px] ${contractDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                  {contractDelta > 0 ? '+' : ''}{contractDelta}M
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="font-medium text-accent-400 text-sm md:text-base whitespace-nowrap">{team.annualContractCost}M</span>
                          )}
                        </td>

                        {/* Balance - hidden on mobile */}
                        <td className={`hidden md:table-cell px-4 py-4 text-right font-medium ${balance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                          {balance >= 0 ? '+' : ''}{balance}M
                        </td>

                        {/* Slots - hidden on mobile */}
                        <td className="hidden md:table-cell px-4 py-4 text-center">
                          <span className="font-medium text-white">
                            {team.slotCount}
                          </span>
                        </td>

                        {/* Position distribution with labels - hidden on mobile/tablet */}
                        <td className="hidden lg:table-cell px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {(['P', 'D', 'C', 'A'] as const).map(pos => (
                              <div
                                key={pos}
                                className={`flex items-center gap-1 px-2 py-1 rounded ${POSITION_COLORS[pos]}`}
                              >
                                <span className="text-xs font-bold">{pos}</span>
                                <span className="text-xs">{team.positionDistribution[pos]}</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Age distribution with labels - hidden until xl */}
                        <td className="hidden xl:table-cell px-2 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 mb-0.5">&lt;20</span>
                            <span className="px-2 py-0.5 rounded bg-secondary-500/20 text-secondary-400 text-xs font-medium min-w-[24px]">
                              {team.ageDistribution.under20}
                            </span>
                          </div>
                        </td>
                        <td className="hidden xl:table-cell px-2 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 mb-0.5">20-24</span>
                            <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 text-xs font-medium min-w-[24px]">
                              {team.ageDistribution.under25}
                            </span>
                          </div>
                        </td>
                        <td className="hidden xl:table-cell px-2 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 mb-0.5">25-29</span>
                            <span className="px-2 py-0.5 rounded bg-accent-500/20 text-accent-400 text-xs font-medium min-w-[24px]">
                              {team.ageDistribution.under30}
                            </span>
                          </div>
                        </td>
                        <td className="hidden xl:table-cell px-2 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 mb-0.5">30+</span>
                            <span className="px-2 py-0.5 rounded bg-warning-500/20 text-warning-400 text-xs font-medium min-w-[24px]">
                              {team.ageDistribution.over30}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded aggregated view with charts */}
                      {isExpanded && (
                        <tr key={`${team.memberId}-expanded`}>
                          <td colSpan={totals?.hasFinancialDetails ? 13 : 11} className="px-2 md:px-4 py-4 md:py-6 bg-surface-100/30">
                            {/* Header with team name and view players button */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
                              <div className="text-xs md:text-sm font-medium text-gray-400">
                                Riepilogo finanziario di {team.teamName}
                                {/* #193: Consolidated status */}
                                {data?.inContrattiPhase && team.isConsolidated && (
                                  <span className="ml-2 px-2 py-1 text-xs rounded bg-green-500/20 text-green-400">
                                    Consolidato
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onNavigate('allPlayers', { team: team.teamName })
                                }}
                                className="px-3 md:px-4 py-1.5 md:py-2 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                              >
                                <span>Vedi Giocatori</span>
                                <span>→</span>
                              </button>
                            </div>

                            {/* Mobile: summary cards for hidden columns */}
                            <div className="md:hidden grid grid-cols-3 gap-2 mb-4">
                              <div className="bg-surface-300/30 rounded-lg p-3 border border-surface-50/10">
                                <div className="text-[10px] text-gray-500 uppercase">Acquisti</div>
                                <div className="text-lg font-bold text-orange-400">{team.totalAcquisitionCost}M</div>
                              </div>
                              <div className="bg-surface-300/30 rounded-lg p-3 border border-surface-50/10">
                                <div className="text-[10px] text-gray-500 uppercase">Bilancio</div>
                                <div className={`text-lg font-bold ${balance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                                  {balance >= 0 ? '+' : ''}{balance}M
                                </div>
                              </div>
                              <div className="bg-surface-300/30 rounded-lg p-3 border border-surface-50/10">
                                <div className="text-[10px] text-gray-500 uppercase">Rosa</div>
                                <div className="text-lg font-bold text-white">{team.slotCount}</div>
                              </div>
                            </div>

                            {/* OSS-6: Budget formula breakdown */}
                            {team.totalAcquisitionCost > 0 && (
                              <div className="bg-surface-300/30 rounded-lg p-3 md:p-4 border border-surface-50/10 mb-4">
                                <div className="text-[10px] md:text-xs text-gray-500 uppercase mb-2">Formula Budget</div>
                                <div className="flex items-center flex-wrap gap-1 text-[10px] md:text-xs">
                                  <span className="text-gray-400">Budget Iniziale</span>
                                  <span className="text-primary-400 font-bold">{team.budget + team.totalAcquisitionCost}M</span>
                                  <span className="text-gray-500">-</span>
                                  <span className="text-gray-400">Acquisti</span>
                                  <span className="text-orange-400 font-bold">{team.totalAcquisitionCost}M</span>
                                  <span className="text-gray-500">=</span>
                                  <span className="text-gray-400">Budget</span>
                                  <span className="text-primary-400 font-bold">{team.budget}M</span>
                                  <span className="text-gray-500">-</span>
                                  <span className="text-gray-400">Ingaggi</span>
                                  <span className="text-accent-400 font-bold">{team.annualContractCost}M</span>
                                  <span className="text-gray-500">=</span>
                                  <span className={`font-bold ${balance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                                    {balance >= 0 ? '+' : ''}{balance}M
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Financial Breakdown Section - shows tagli, indennizzi when available */}
                            {(team.totalReleaseCosts !== null || team.totalIndemnities !== null) && (
                              <div className="bg-surface-300/30 rounded-xl p-3 md:p-4 border border-surface-50/10 mb-4 md:mb-6">
                                <h4 className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 md:mb-4">
                                  Dettaglio Finanziario Sessione
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                                  {/* Budget Iniziale */}
                                  <div className="bg-surface-200/50 rounded-lg p-2 md:p-3">
                                    <div className="text-[10px] md:text-xs text-gray-500 mb-1">Budget Iniziale</div>
                                    <div className="text-sm md:text-lg font-bold text-primary-400">
                                      {team.preConsolidationBudget ?? team.budget}M
                                    </div>
                                  </div>

                                  {/* Tagli */}
                                  <div className="bg-surface-200/50 rounded-lg p-2 md:p-3">
                                    <div className="text-[10px] md:text-xs text-gray-500 mb-1">Tagli</div>
                                    <div className="text-sm md:text-lg font-bold text-danger-400">
                                      {team.totalReleaseCosts !== null ? `-${team.totalReleaseCosts}M` : '-'}
                                    </div>
                                  </div>

                                  {/* Indennizzi */}
                                  <div className="bg-surface-200/50 rounded-lg p-2 md:p-3">
                                    <div className="text-[10px] md:text-xs text-gray-500 mb-1">Indennizzi</div>
                                    <div className="text-sm md:text-lg font-bold text-green-400">
                                      {team.totalIndemnities !== null ? `+${team.totalIndemnities}M` : '-'}
                                    </div>
                                  </div>

                                  {/* Budget Finale */}
                                  <div className="bg-surface-200/50 rounded-lg p-2 md:p-3">
                                    <div className="text-[10px] md:text-xs text-gray-500 mb-1">Budget Finale</div>
                                    <div className="text-sm md:text-lg font-bold text-primary-400">
                                      {team.budget}M
                                    </div>
                                  </div>

                                  {/* Bilancio (Budget - Ingaggi) */}
                                  <div className="bg-surface-200/50 rounded-lg p-2 md:p-3 col-span-2 md:col-span-1">
                                    <div className="text-[10px] md:text-xs text-gray-500 mb-1">Bilancio</div>
                                    <div className={`text-sm md:text-lg font-bold ${balance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                                      {balance >= 0 ? '+' : ''}{balance}M
                                    </div>
                                  </div>
                                </div>

                                {/* Formula verification */}
                                <div className="mt-3 pt-3 border-t border-surface-50/20">
                                  <div className="text-[10px] md:text-xs text-gray-500 flex flex-wrap items-center gap-1">
                                    <span className="text-primary-400">{team.preConsolidationBudget ?? team.budget}M</span>
                                    {team.totalReleaseCosts !== null && (
                                      <>
                                        <span>−</span>
                                        <span className="text-danger-400">{team.totalReleaseCosts}M</span>
                                      </>
                                    )}
                                    {team.totalIndemnities !== null && team.totalIndemnities > 0 && (
                                      <>
                                        <span>+</span>
                                        <span className="text-green-400">{team.totalIndemnities}M</span>
                                      </>
                                    )}
                                    <span>=</span>
                                    <span className="text-primary-400 font-medium">{team.budget}M</span>
                                    <span className="mx-1">|</span>
                                    <span className="text-primary-400">{team.budget}M</span>
                                    <span>−</span>
                                    <span className="text-accent-400">{team.annualContractCost}M</span>
                                    <span>=</span>
                                    <span className={`font-medium ${balance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                                      {balance >= 0 ? '+' : ''}{balance}M
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                              {/* Left: Aggregated data by position - #200: only current values during CONTRATTI phase */}
                              <div className="bg-surface-300/30 rounded-xl p-3 md:p-4 border border-surface-50/10">
                                <h4 className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 md:mb-4">
                                  Rosa per Ruolo
                                </h4>
                                <div className="space-y-2 md:space-y-3">
                                  {(['P', 'D', 'C', 'A'] as const).map(pos => {
                                    const count = team.positionDistribution[pos]
                                    const positionCost = team.costByPosition[pos].preRenewal
                                    return (
                                      <div
                                        key={pos}
                                        className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-surface-200/50"
                                      >
                                        <div className="flex items-center gap-2 md:gap-3">
                                          <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded text-xs md:text-sm font-bold ${POSITION_COLORS[pos]}`}>
                                            {pos}
                                          </span>
                                          <span className="text-gray-300 text-xs md:text-sm hidden sm:inline">{POSITION_NAMES[pos]}</span>
                                        </div>
                                        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm">
                                          <div className="text-right">
                                            <div className="text-white font-medium">{count}</div>
                                            <div className="text-[8px] md:text-[10px] text-gray-500">gioc.</div>
                                          </div>
                                          <div className="text-right min-w-[50px] md:min-w-[80px]">
                                            <div className="text-accent-400 font-medium">{positionCost}M</div>
                                            <div className="text-[8px] md:text-[10px] text-gray-500">ingaggi</div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                  {/* Total row - #200: only current values */}
                                  <div className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-surface-50/10 border-t border-surface-50/20 mt-2">
                                    <span className="text-gray-400 font-medium text-xs md:text-sm">Totale</span>
                                    <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm">
                                      <div className="text-right">
                                        <div className="text-white font-bold">{team.slotCount}</div>
                                        <div className="text-[8px] md:text-[10px] text-gray-500">gioc.</div>
                                      </div>
                                      <div className="text-right min-w-[50px] md:min-w-[80px]">
                                        <div className="text-accent-400 font-bold">{team.annualContractCost}M</div>
                                        <div className="text-[8px] md:text-[10px] text-gray-500">ingaggi</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Center: Donut chart for position distribution - #200: only current values */}
                              <div className="bg-surface-300/30 rounded-xl p-3 md:p-4 border border-surface-50/10 flex flex-col items-center justify-center">
                                <h4 className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 md:mb-4">
                                  Distribuzione Costi per Ruolo
                                </h4>
                                {/* Mobile: smaller donut */}
                                <div className="md:hidden">
                                  <DonutChart
                                    size={140}
                                    innerRadius={35}
                                    data={(['P', 'D', 'C', 'A'] as const).map(pos => ({
                                      label: POSITION_NAMES[pos],
                                      value: team.costByPosition[pos].preRenewal,
                                      color: POSITION_CHART_COLORS[pos],
                                    }))}
                                  />
                                </div>
                                {/* Desktop: regular donut */}
                                <div className="hidden md:block">
                                  <DonutChart
                                    data={(['P', 'D', 'C', 'A'] as const).map(pos => ({
                                      label: POSITION_NAMES[pos],
                                      value: team.costByPosition[pos].preRenewal,
                                      color: POSITION_CHART_COLORS[pos],
                                    }))}
                                  />
                                </div>
                              </div>

                              {/* Right: Bar chart for budget vs contracts - #200: only current values */}
                              <div className="bg-surface-300/30 rounded-xl p-3 md:p-4 border border-surface-50/10">
                                <h4 className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 md:mb-4">
                                  Budget vs Contratti
                                </h4>
                                <BudgetBarChart
                                  budget={team.budget}
                                  contracts={team.annualContractCost}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend - hidden on mobile, shown in expanded view */}
        <div className="hidden md:block mt-6 bg-surface-300/30 rounded-lg p-4 border border-surface-50/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Legenda</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
            <div>
              <span className="text-primary-400 font-medium">Budget</span>
              <span className="text-gray-500 ml-2">Crediti disponibili</span>
            </div>
            <div>
              <span className="text-orange-400 font-medium">Acquisti</span>
              <span className="text-gray-500 ml-2">Somma prezzi asta pagati</span>
            </div>
            <div>
              <span className="text-accent-400 font-medium">Contratti</span>
              <span className="text-gray-500 ml-2">Somma ingaggi annuali</span>
            </div>
            <div>
              <span className="text-green-400 font-medium">Bilancio</span>
              <span className="text-gray-500 ml-2">Budget - Contratti</span>
            </div>
            <div>
              <span className="text-white font-medium">Rosa</span>
              <span className="text-gray-500 ml-2">Giocatori totali</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-3">
            <div>
              <span className="text-danger-400 font-medium">Tagli</span>
              <span className="text-gray-500 ml-2">Costo giocatori tagliati</span>
            </div>
            <div>
              <span className="text-green-400 font-medium">Indennizzi</span>
              <span className="text-gray-500 ml-2">Compensi per giocatori ESTERO</span>
            </div>
            <div>
              <span className="text-primary-400 font-medium">Budget Iniziale</span>
              <span className="text-gray-500 ml-2">Prima dei tagli/indennizzi</span>
            </div>
            <div>
              <span className="text-primary-400 font-medium">Budget Finale</span>
              <span className="text-gray-500 ml-2">Dopo tagli/indennizzi</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs mt-3">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded ${POSITION_COLORS['P']}`}>P</span>
              <span className="text-gray-500">Portieri</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded ${POSITION_COLORS['D']}`}>D</span>
              <span className="text-gray-500">Difensori</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded ${POSITION_COLORS['C']}`}>C</span>
              <span className="text-gray-500">Centrocampisti</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded ${POSITION_COLORS['A']}`}>A</span>
              <span className="text-gray-500">Attaccanti</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-surface-50/10">
            Clicca su una riga per espandere i dettagli della squadra
          </div>
        </div>

        {/* Mobile tip */}
        <div className="md:hidden mt-4 text-center text-xs text-gray-500">
          Clicca su una squadra per vedere i dettagli
        </div>
      </div>
    </div>
  )
}
