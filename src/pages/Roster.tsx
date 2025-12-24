import { useState, useEffect } from 'react'
import { auctionApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'

interface RosterProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: string
  quotation: number
}

interface RosterEntry {
  id: string
  acquisitionPrice: number
  player: Player
  contract?: {
    salary: number
    duration: number
    rescissionClause?: number
  }
}

interface RosterData {
  member: {
    id: string
    currentBudget: number
    user: { username: string }
    league: {
      goalkeeperSlots: number
      defenderSlots: number
      midfielderSlots: number
      forwardSlots: number
    }
  }
  roster: {
    P: RosterEntry[]
    D: RosterEntry[]
    C: RosterEntry[]
    A: RosterEntry[]
  }
  totals: {
    P: number
    D: number
    C: number
    A: number
    total: number
  }
  slots: {
    P: number
    D: number
    C: number
    A: number
  }
}

// Stile per ruolo
function getRoleStyle(position: string) {
  switch (position) {
    case 'P': return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', label: 'POR' }
    case 'D': return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', label: 'DIF' }
    case 'C': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', label: 'CEN' }
    case 'A': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', label: 'ATT' }
    default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40', label: position }
  }
}

// Componente logo squadra
function TeamLogo({ team, size = 'md' }: { team: string, size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8'
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className={`${sizeClass} object-contain`}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

// Componente card giocatore
function PlayerCard({ entry }: { entry: RosterEntry }) {
  const roleStyle = getRoleStyle(entry.player.position)

  return (
    <div className="flex items-center gap-3 p-3 bg-surface-200 rounded-lg border border-surface-50/20 hover:border-surface-50/40 transition-colors">
      {/* Team Logo */}
      <div className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-lg p-1 flex-shrink-0">
        <TeamLogo team={entry.player.team} size="md" />
      </div>

      {/* Role Badge */}
      <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${roleStyle.bg} ${roleStyle.border} border`}>
        <span className={`text-sm font-bold ${roleStyle.text}`}>{roleStyle.label}</span>
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{entry.player.name}</p>
        <p className="text-gray-500 text-xs">{entry.player.team}</p>
      </div>

      {/* Contract & Price Info */}
      <div className="text-right flex-shrink-0">
        {entry.contract ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-end gap-2">
              <span className="text-accent-400 font-semibold text-sm">{entry.contract.salary}M</span>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400 text-xs">{entry.contract.duration} sem</span>
            </div>
            {entry.contract.rescissionClause && (
              <div className="flex items-center justify-end gap-1">
                <span className="text-[10px] text-gray-500 uppercase">Rubata:</span>
                <span className="text-warning-400 font-medium text-xs">{entry.contract.rescissionClause}M</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-accent-400 font-semibold">{entry.acquisitionPrice}M</p>
            <p className="text-gray-600 text-xs italic">No contratto</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function Roster({ leagueId, onNavigate }: RosterProps) {
  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  // Filtri
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterTeam, setFilterTeam] = useState('')

  useEffect(() => {
    loadData()
  }, [leagueId])

  async function loadData() {
    const [rosterResult, leagueResult] = await Promise.all([
      auctionApi.getRoster(leagueId),
      leagueApi.getById(leagueId)
    ])

    if (rosterResult.success && rosterResult.data) {
      setRosterData(rosterResult.data as RosterData)
    }
    if (leagueResult.success && leagueResult.data) {
      const data = leagueResult.data as { isAdmin: boolean }
      setIsLeagueAdmin(data.isAdmin)
    }
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-400">Caricamento rosa...</p>
        </div>
      </div>
    )
  }

  if (!rosterData) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-xl text-danger-400">Errore nel caricamento della rosa</p>
        </div>
      </div>
    )
  }

  const { member, roster, totals } = rosterData

  // Combina tutti i giocatori in una lista unica
  const allPlayers = [...roster.P, ...roster.D, ...roster.C, ...roster.A]

  // Estrai squadre uniche per il filtro
  const uniqueTeams = [...new Set(allPlayers.map(e => e.player.team))].sort()

  // Applica filtri
  const filteredPlayers = allPlayers.filter(entry => {
    // Filtro per ruolo
    if (filterRole && entry.player.position !== filterRole) return false

    // Filtro per squadra
    if (filterTeam && entry.player.team !== filterTeam) return false

    // Filtro per nome
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!entry.player.name.toLowerCase().includes(query)) return false
    }

    return true
  })

  // Ordina per ruolo (P, D, C, A) poi per nome
  const sortedPlayers = filteredPlayers.sort((a, b) => {
    const roleOrder = { P: 0, D: 1, C: 2, A: 3 }
    const roleA = roleOrder[a.player.position as keyof typeof roleOrder] ?? 4
    const roleB = roleOrder[b.player.position as keyof typeof roleOrder] ?? 4
    if (roleA !== roleB) return roleA - roleB
    return a.player.name.localeCompare(b.player.name)
  })

  // Calcola statistiche
  const totalSalary = allPlayers.reduce((sum, e) => sum + (e.contract?.salary || 0), 0)
  const totalValue = allPlayers.reduce((sum, e) => sum + e.acquisitionPrice, 0)

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="roster" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
                <span className="text-3xl">📋</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">La Mia Rosa</h1>
                <p className="text-gray-400 mt-1">{member.user.username}</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="flex gap-4">
              <div className="text-center bg-surface-200 rounded-xl px-5 py-3 border border-surface-50/20">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Budget</p>
                <p className="text-2xl font-bold text-accent-400">{member.currentBudget}</p>
              </div>
              <div className="text-center bg-surface-200 rounded-xl px-5 py-3 border border-surface-50/20">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Valore Rosa</p>
                <p className="text-2xl font-bold text-primary-400">{totalValue}</p>
              </div>
              <div className="text-center bg-surface-200 rounded-xl px-5 py-3 border border-surface-50/20">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Ingaggi Tot.</p>
                <p className="text-2xl font-bold text-warning-400">{totalSalary}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Stats - Contatori compatti */}
        <div className="flex items-center gap-6 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">POR</span>
            <span className="text-white">{totals.P}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-bold">DIF</span>
            <span className="text-white">{totals.D}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">CEN</span>
            <span className="text-white">{totals.C}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-bold">ATT</span>
            <span className="text-white">{totals.A}</span>
          </div>
          <div className="flex items-center gap-2 pl-4 border-l border-surface-50/30">
            <span className="text-gray-400">Totale:</span>
            <span className="text-white font-bold">{allPlayers.length}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-6">
          <div className="grid grid-cols-4 gap-4">
            {/* Search by name */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cerca per nome</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Nome giocatore..."
                className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>

            {/* Filter by role */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ruolo</label>
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Tutti i ruoli</option>
                <option value="P">Portieri</option>
                <option value="D">Difensori</option>
                <option value="C">Centrocampisti</option>
                <option value="A">Attaccanti</option>
              </select>
            </div>

            {/* Filter by team */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Squadra</label>
              <select
                value={filterTeam}
                onChange={e => setFilterTeam(e.target.value)}
                className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Tutte le squadre</option>
                {uniqueTeams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>

            {/* Reset filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setFilterRole('')
                  setFilterTeam('')
                }}
                className="w-full"
              >
                Resetta Filtri
              </Button>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-3 text-sm text-gray-400">
            {filteredPlayers.length === allPlayers.length
              ? `${allPlayers.length} giocatori in rosa`
              : `${filteredPlayers.length} di ${allPlayers.length} giocatori`
            }
          </div>
        </div>

        {/* Player List */}
        <div className="space-y-2">
          {sortedPlayers.length === 0 ? (
            <div className="text-center py-12 bg-surface-200 rounded-xl border border-surface-50/20">
              <div className="text-4xl mb-3 opacity-50">🔍</div>
              <p className="text-gray-500">Nessun giocatore trovato</p>
              <p className="text-gray-600 text-sm mt-1">Prova a modificare i filtri</p>
            </div>
          ) : (
            sortedPlayers.map(entry => (
              <PlayerCard key={entry.id} entry={entry} />
            ))
          )}
        </div>

        <div className="mt-8 flex gap-4">
          <Button size="lg" variant="outline" onClick={() => onNavigate('rosters', { leagueId })}>
            <span className="mr-2">👥</span> Vedi tutte le rose
          </Button>
          <Button size="lg" variant="outline" onClick={() => onNavigate('contracts', { leagueId })}>
            <span className="mr-2">📝</span> Gestisci Contratti
          </Button>
        </div>
      </main>
    </div>
  )
}
