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

  return (
    <div className="flex flex-col items-center gap-3">
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
            {slice.percentage >= 10 && (
              <text
                x={slice.labelX}
                y={slice.labelY}
                fill="white"
                fontSize="11"
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
          y={center - 8}
          fill="rgba(255,255,255,0.7)"
          fontSize="10"
          textAnchor="middle"
        >
          Totale
        </text>
        <text
          x={center}
          y={center + 8}
          fill="white"
          fontSize="14"
          fontWeight="bold"
          textAnchor="middle"
        >
          {total}M
        </text>
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 text-xs">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: slice.color }} />
            <span className="text-gray-400">{slice.label}</span>
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
    <div className="flex flex-col gap-3" style={{ minHeight: height }}>
      {/* Budget bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Budget</span>
          <span className="text-primary-400 font-medium">{budget}M</span>
        </div>
        <div className="h-6 bg-surface-100/50 rounded-lg overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-lg transition-all duration-500"
            style={{ width: `${budgetWidth}%` }}
          />
        </div>
      </div>

      {/* Contracts bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Contratti</span>
          <span className="text-accent-400 font-medium">{contracts}M</span>
        </div>
        <div className="h-6 bg-surface-100/50 rounded-lg overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-lg transition-all duration-500"
            style={{ width: `${contractsWidth}%` }}
          />
        </div>
      </div>

      {/* Balance indicator */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-50/20">
        <span className="text-xs text-gray-400">Bilancio</span>
        <span className={`text-sm font-bold ${balance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
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
}

interface TeamData {
  memberId: string
  teamName: string
  username: string
  budget: number
  annualContractCost: number
  totalContractCost: number
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
}

interface FinancialsData {
  leagueName: string
  maxSlots: number
  teams: TeamData[]
  isAdmin: boolean
}

// Sort field type
type SortField = 'teamName' | 'budget' | 'annualContractCost' | 'balance' | 'slotCount' | 'under20' | 'under25' | 'under30' | 'over30'

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

  useEffect(() => {
    loadFinancials()
  }, [leagueId])

  async function loadFinancials() {
    if (!leagueId) return
    setLoading(true)
    setError(null)

    try {
      const result = await leagueApi.getFinancials(leagueId)
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

  // Calculate league totals
  const totals = useMemo(() => {
    if (!data?.teams) return null

    const totalBudget = data.teams.reduce((sum, t) => sum + t.budget, 0)
    const totalContracts = data.teams.reduce((sum, t) => sum + t.annualContractCost, 0)

    return {
      totalBudget,
      totalContracts,
      totalBalance: totalBudget - totalContracts,
      totalPlayers: data.teams.reduce((sum, t) => sum + t.slotCount, 0),
      avgAge: (() => {
        const allPlayers = data.teams.flatMap(t => t.players).filter(p => p.age != null)
        if (allPlayers.length === 0) return 0
        return allPlayers.reduce((sum, p) => sum + (p.age || 0), 0) / allPlayers.length
      })(),
    }
  }, [data?.teams])

  // Sortable header component
  const SortableHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${className}`}
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Finanze Lega</h1>
          <p className="text-gray-400 mt-1">Panoramica finanziaria di tutte le squadre</p>
        </div>

        {/* League Totals */}
        {totals && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-surface-300/50 rounded-lg p-4 border border-surface-50/10">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Budget Totale</div>
              <div className="text-xl font-bold text-primary-400">{totals.totalBudget}M</div>
            </div>
            <div className="bg-surface-300/50 rounded-lg p-4 border border-surface-50/10">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Contratti</div>
              <div className="text-xl font-bold text-accent-400">{totals.totalContracts}M</div>
            </div>
            <div className="bg-surface-300/50 rounded-lg p-4 border border-surface-50/10">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Bilancio</div>
              <div className={`text-xl font-bold ${totals.totalBalance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                {totals.totalBalance >= 0 ? '+' : ''}{totals.totalBalance}M
              </div>
            </div>
            <div className="bg-surface-300/50 rounded-lg p-4 border border-surface-50/10">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Giocatori</div>
              <div className="text-xl font-bold text-white">{totals.totalPlayers}</div>
            </div>
            <div className="bg-surface-300/50 rounded-lg p-4 border border-surface-50/10">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Età Media</div>
              <div className="text-xl font-bold text-secondary-400">{totals.avgAge.toFixed(1)} anni</div>
            </div>
          </div>
        )}

        {/* Teams Table */}
        <div className="bg-surface-300/30 rounded-xl border border-surface-50/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-300/50">
                <tr>
                  <SortableHeader field="teamName" label="Squadra" />
                  <SortableHeader field="budget" label="Budget" className="text-right" />
                  <SortableHeader field="annualContractCost" label="Contratti" className="text-right" />
                  <SortableHeader field="balance" label="Bilancio" className="text-right" />
                  <SortableHeader field="slotCount" label="Rosa" className="text-center" />
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Ruoli</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider" colSpan={4}>Distribuzione Età</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50/10">
                {sortedTeams.map((team) => {
                  const isExpanded = expandedTeam === team.memberId
                  const balance = team.budget - team.annualContractCost
                  const balanceLow = balance < 0

                  return (
                    <>
                      <tr
                        key={team.memberId}
                        onClick={() => setExpandedTeam(isExpanded ? null : team.memberId)}
                        className={`hover:bg-surface-300/30 transition-colors cursor-pointer ${balanceLow ? 'bg-danger-500/5' : ''} ${isExpanded ? 'bg-surface-300/20' : ''}`}
                      >
                        {/* Team name */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                            <div>
                              <div className="font-medium text-white">{team.teamName}</div>
                              <div className="text-xs text-gray-500">@{team.username}</div>
                            </div>
                          </div>
                        </td>

                        {/* Budget */}
                        <td className="px-4 py-4 text-right font-medium text-primary-400">
                          {team.budget}M
                        </td>

                        {/* Contracts */}
                        <td className="px-4 py-4 text-right font-medium text-accent-400">
                          {team.annualContractCost}M
                        </td>

                        {/* Balance */}
                        <td className={`px-4 py-4 text-right font-medium ${balance >= 0 ? 'text-green-400' : 'text-danger-400'}`}>
                          {balance >= 0 ? '+' : ''}{balance}M
                        </td>

                        {/* Slots - just the count, no max */}
                        <td className="px-4 py-4 text-center">
                          <span className="font-medium text-white">
                            {team.slotCount}
                          </span>
                        </td>

                        {/* Position distribution with labels */}
                        <td className="px-4 py-4">
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

                        {/* Age distribution with labels */}
                        <td className="px-2 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 mb-0.5">&lt;20</span>
                            <span className="px-2 py-0.5 rounded bg-secondary-500/20 text-secondary-400 text-xs font-medium min-w-[24px]">
                              {team.ageDistribution.under20}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 mb-0.5">20-24</span>
                            <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 text-xs font-medium min-w-[24px]">
                              {team.ageDistribution.under25}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 mb-0.5">25-29</span>
                            <span className="px-2 py-0.5 rounded bg-accent-500/20 text-accent-400 text-xs font-medium min-w-[24px]">
                              {team.ageDistribution.under30}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-center">
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
                          <td colSpan={10} className="px-4 py-6 bg-surface-100/30">
                            {/* Header with team name and view players button */}
                            <div className="flex items-center justify-between mb-6">
                              <div className="text-sm font-medium text-gray-400">
                                Riepilogo finanziario di {team.teamName}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onNavigate('allPlayers', { team: team.teamName })
                                }}
                                className="px-4 py-2 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                              >
                                <span>Vedi Giocatori</span>
                                <span>→</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Left: Aggregated data by position */}
                              <div className="bg-surface-300/30 rounded-xl p-4 border border-surface-50/10">
                                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
                                  Rosa per Ruolo
                                </h4>
                                <div className="space-y-3">
                                  {(['P', 'D', 'C', 'A'] as const).map(pos => {
                                    const count = team.positionDistribution[pos]
                                    const totalSalary = team.players
                                      .filter(p => p.position === pos)
                                      .reduce((sum, p) => sum + p.salary, 0)
                                    return (
                                      <div
                                        key={pos}
                                        className="flex items-center justify-between p-3 rounded-lg bg-surface-200/50"
                                      >
                                        <div className="flex items-center gap-3">
                                          <span className={`px-2.5 py-1 rounded text-sm font-bold ${POSITION_COLORS[pos]}`}>
                                            {pos}
                                          </span>
                                          <span className="text-gray-300">{POSITION_NAMES[pos]}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <div className="text-right">
                                            <div className="text-white font-medium">{count}</div>
                                            <div className="text-[10px] text-gray-500">giocatori</div>
                                          </div>
                                          <div className="text-right min-w-[60px]">
                                            <div className="text-accent-400 font-medium">{totalSalary}M</div>
                                            <div className="text-[10px] text-gray-500">ingaggi</div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                  {/* Total row */}
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-50/10 border-t border-surface-50/20 mt-2">
                                    <span className="text-gray-400 font-medium">Totale</span>
                                    <div className="flex items-center gap-4 text-sm">
                                      <div className="text-right">
                                        <div className="text-white font-bold">{team.slotCount}</div>
                                        <div className="text-[10px] text-gray-500">giocatori</div>
                                      </div>
                                      <div className="text-right min-w-[60px]">
                                        <div className="text-accent-400 font-bold">{team.annualContractCost}M</div>
                                        <div className="text-[10px] text-gray-500">ingaggi</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Center: Donut chart for position distribution */}
                              <div className="bg-surface-300/30 rounded-xl p-4 border border-surface-50/10 flex flex-col items-center justify-center">
                                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
                                  Distribuzione Costi per Ruolo
                                </h4>
                                <DonutChart
                                  data={(['P', 'D', 'C', 'A'] as const).map(pos => ({
                                    label: POSITION_NAMES[pos],
                                    value: team.players
                                      .filter(p => p.position === pos)
                                      .reduce((sum, p) => sum + p.salary, 0),
                                    color: POSITION_CHART_COLORS[pos],
                                  }))}
                                />
                              </div>

                              {/* Right: Bar chart for budget vs contracts */}
                              <div className="bg-surface-300/30 rounded-xl p-4 border border-surface-50/10">
                                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
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

        {/* Legend */}
        <div className="mt-6 bg-surface-300/30 rounded-lg p-4 border border-surface-50/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Legenda</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-primary-400 font-medium">Budget</span>
              <span className="text-gray-500 ml-2">Crediti disponibili</span>
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
            Clicca su una riga per espandere la rosa completa del manager
          </div>
        </div>
      </div>
    </div>
  )
}
