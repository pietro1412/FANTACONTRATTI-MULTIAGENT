import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Navigation } from '../components/Navigation'
import { leagueApi } from '../services/api'

// Types
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
}

// Sort field type
type SortField = 'teamName' | 'budget' | 'annualContractCost' | 'totalContractCost' | 'slotCount' | 'under20' | 'under25' | 'under30' | 'over30'

// Position colors
const POSITION_COLORS: Record<string, string> = {
  P: 'bg-yellow-500/20 text-yellow-400',
  D: 'bg-green-500/20 text-green-400',
  C: 'bg-blue-500/20 text-blue-400',
  A: 'bg-red-500/20 text-red-400',
}

export default function LeagueFinancials() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FinancialsData | null>(null)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('teamName')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

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
        case 'totalContractCost':
          valueA = a.totalContractCost
          valueB = b.totalContractCost
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

    return {
      totalBudget: data.teams.reduce((sum, t) => sum + t.budget, 0),
      totalAnnualCost: data.teams.reduce((sum, t) => sum + t.annualContractCost, 0),
      totalContractCost: data.teams.reduce((sum, t) => sum + t.totalContractCost, 0),
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

  function handleNavigate(page: string) {
    if (page === 'leagues') {
      window.location.href = '/leagues'
    } else if (leagueId) {
      window.location.href = `/leagues/${leagueId}/${page}`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-200">
        <Navigation
          currentPage="financials"
          leagueId={leagueId}
          leagueName={data?.leagueName}
          onNavigate={handleNavigate}
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
          onNavigate={handleNavigate}
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
        onNavigate={handleNavigate}
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
              <div className="text-xs text-gray-500 uppercase tracking-wider">Costo Annuale</div>
              <div className="text-xl font-bold text-accent-400">{totals.totalAnnualCost}M</div>
            </div>
            <div className="bg-surface-300/50 rounded-lg p-4 border border-surface-50/10">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Costo Totale</div>
              <div className="text-xl font-bold text-warning-400">{totals.totalContractCost}M</div>
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
                  <SortableHeader field="annualContractCost" label="Costo Ann." className="text-right" />
                  <SortableHeader field="totalContractCost" label="Costo Tot." className="text-right" />
                  <SortableHeader field="slotCount" label="Slot" className="text-center" />
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Ruoli</th>
                  <SortableHeader field="under20" label="<20" className="text-center" />
                  <SortableHeader field="under25" label="20-24" className="text-center" />
                  <SortableHeader field="under30" label="25-29" className="text-center" />
                  <SortableHeader field="over30" label="30+" className="text-center" />
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50/10">
                {sortedTeams.map((team) => {
                  const isExpanded = expandedTeam === team.memberId
                  const budgetLow = team.budget < 20

                  return (
                    <>
                      <tr
                        key={team.memberId}
                        className={`hover:bg-surface-300/30 transition-colors ${budgetLow ? 'bg-danger-500/5' : ''}`}
                      >
                        {/* Team name */}
                        <td className="px-3 py-4">
                          <div className="font-medium text-white">{team.teamName}</div>
                          <div className="text-xs text-gray-500">@{team.username}</div>
                        </td>

                        {/* Budget */}
                        <td className={`px-3 py-4 text-right font-medium ${budgetLow ? 'text-danger-400' : 'text-primary-400'}`}>
                          {team.budget}M
                        </td>

                        {/* Annual cost */}
                        <td className="px-3 py-4 text-right font-medium text-accent-400">
                          {team.annualContractCost}M
                        </td>

                        {/* Total cost */}
                        <td className="px-3 py-4 text-right font-medium text-warning-400">
                          {team.totalContractCost}M
                        </td>

                        {/* Slots */}
                        <td className="px-3 py-4 text-center">
                          <span className={`font-medium ${team.slotsFree === 0 ? 'text-danger-400' : 'text-white'}`}>
                            {team.slotCount}
                          </span>
                          <span className="text-gray-500">/{team.maxSlots}</span>
                        </td>

                        {/* Position distribution */}
                        <td className="px-3 py-4">
                          <div className="flex items-center justify-center gap-1">
                            {(['P', 'D', 'C', 'A'] as const).map(pos => (
                              <span
                                key={pos}
                                className={`px-1.5 py-0.5 rounded text-xs font-medium ${POSITION_COLORS[pos]}`}
                              >
                                {team.positionDistribution[pos]}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Age distribution */}
                        <td className="px-3 py-4 text-center">
                          <span className="px-2 py-1 rounded bg-secondary-500/20 text-secondary-400 text-xs font-medium">
                            {team.ageDistribution.under20}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className="px-2 py-1 rounded bg-primary-500/20 text-primary-400 text-xs font-medium">
                            {team.ageDistribution.under25}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className="px-2 py-1 rounded bg-accent-500/20 text-accent-400 text-xs font-medium">
                            {team.ageDistribution.under30}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className="px-2 py-1 rounded bg-warning-500/20 text-warning-400 text-xs font-medium">
                            {team.ageDistribution.over30}
                          </span>
                        </td>

                        {/* Expand button */}
                        <td className="px-3 py-4 text-center">
                          <button
                            onClick={() => setExpandedTeam(isExpanded ? null : team.memberId)}
                            className="w-8 h-8 rounded-lg bg-surface-300 hover:bg-surface-50/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded player list */}
                      {isExpanded && (
                        <tr key={`${team.memberId}-expanded`}>
                          <td colSpan={11} className="px-4 py-4 bg-surface-100/30">
                            <div className="text-sm font-medium text-gray-400 mb-3">Rosa di {team.teamName}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {team.players
                                .sort((a, b) => {
                                  const posOrder = { P: 0, D: 1, C: 2, A: 3 }
                                  return (posOrder[a.position as keyof typeof posOrder] || 99) - (posOrder[b.position as keyof typeof posOrder] || 99)
                                })
                                .map(player => (
                                  <div
                                    key={player.id}
                                    className="flex items-center justify-between bg-surface-300/50 rounded-lg px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${POSITION_COLORS[player.position]}`}>
                                        {player.position}
                                      </span>
                                      <div>
                                        <div className="text-sm font-medium text-white">{player.name}</div>
                                        <div className="text-xs text-gray-500">
                                          {player.team}
                                          {player.age != null && (
                                            <span className="ml-2 text-gray-400">• {player.age} anni</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-accent-400">{player.salary}M</div>
                                      <div className="text-xs text-gray-500">{player.duration} stag.</div>
                                    </div>
                                  </div>
                                ))}
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
              <span className="text-accent-400 font-medium">Costo Ann.</span>
              <span className="text-gray-500 ml-2">Somma ingaggi stagione</span>
            </div>
            <div>
              <span className="text-warning-400 font-medium">Costo Tot.</span>
              <span className="text-gray-500 ml-2">Ingaggio × durata residua</span>
            </div>
            <div>
              <span className="text-white font-medium">Slot</span>
              <span className="text-gray-500 ml-2">Giocatori in rosa / max</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-secondary-500/20 text-secondary-400 text-xs font-medium">&lt;20</span>
              <span className="text-gray-500">Under 20</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 text-xs font-medium">20-24</span>
              <span className="text-gray-500">Under 25</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-accent-500/20 text-accent-400 text-xs font-medium">25-29</span>
              <span className="text-gray-500">Under 30</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-warning-500/20 text-warning-400 text-xs font-medium">30+</span>
              <span className="text-gray-500">Over 30</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
