import { useState, useEffect } from 'react'
import { auctionApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { POSITION_GRADIENTS } from '../components/ui/PositionBadge'
import { getTeamLogo } from '../utils/teamLogos'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { PlayerStatsModal, type PlayerInfo, type PlayerStats } from '../components/PlayerStatsModal'

interface RosterProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Session {
  id: string
  status: string
  currentPhase: string
}

interface Player {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  apiFootballId?: number | null
  apiFootballStats?: PlayerStats | null
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

// Colori durata contratto
function getDurationStyle(duration: number) {
  switch (duration) {
    case 1: return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', label: 'text-red-300' }
    case 2: return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400', label: 'text-yellow-300' }
    case 3: return { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400', label: 'text-green-300' }
    case 4: return { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', label: 'text-blue-300' }
    default: return { bg: 'bg-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-400', label: 'text-gray-300' }
  }
}

// Contatore squadre (cliccabile)
function TeamCounters({ players, onTeamClick }: { players: RosterEntry[], onTeamClick: (team: string) => void }) {
  const teamCounts: Record<string, number> = {}
  for (const entry of players) {
    teamCounts[entry.player.team] = (teamCounts[entry.player.team] || 0) + 1
  }

  const sortedTeams = Object.entries(teamCounts)
    .filter(([, count]) => count > 0) // Solo squadre con giocatori
    .sort((a, b) => b[1] - a[1]) // Ordinamento decrescente per numero

  if (sortedTeams.length === 0) return null

  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Giocatori per Squadra</h3>
      <div className="flex flex-wrap gap-2">
        {sortedTeams.map(([team, count]) => (
          <button
            key={team}
            onClick={() => { onTeamClick(team); }}
            className="flex items-center gap-1.5 bg-surface-300 rounded-lg px-2 py-1 hover:bg-surface-50/20 hover:scale-105 transition-all cursor-pointer"
          >
            <div className="w-5 h-5 bg-white rounded flex items-center justify-center p-0.5">
              <img src={getTeamLogo(team)} alt={team} className="w-4 h-4 object-contain" />
            </div>
            <span className="text-xs text-gray-400">{team}</span>
            <span className="text-xs font-bold text-white">{count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Modale giocatori per squadra
function TeamPlayersModal({
  team,
  players,
  onClose
}: {
  team: string
  players: RosterEntry[]
  onClose: () => void
}) {
  const teamPlayers = players.filter(p => p.player.team === team)
    .sort((a, b) => {
      const roleOrder = { P: 0, D: 1, C: 2, A: 3 }
      const roleA = roleOrder[a.player.position as keyof typeof roleOrder] ?? 4
      const roleB = roleOrder[b.player.position as keyof typeof roleOrder] ?? 4
      if (roleA !== roleB) return roleA - roleB
      return a.player.name.localeCompare(b.player.name)
    })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface-200 rounded-xl border border-surface-50/30 max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={e => { e.stopPropagation(); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-50/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-lg p-1 flex items-center justify-center">
              <img src={getTeamLogo(team)} alt={team} className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{team}</h2>
              <p className="text-sm text-gray-400">{teamPlayers.length} giocatori</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-300 hover:bg-surface-50/30 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Players List */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
          {teamPlayers.map(entry => {
            const roleStyle = getRoleStyle(entry.player.position)
            const durStyle = entry.contract ? getDurationStyle(entry.contract.duration) : null

            return (
              <div key={entry.id} className="flex items-center gap-2 p-2 sm:p-3 bg-surface-300 rounded-lg">
                {/* Role Badge */}
                <div className={`w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${roleStyle.bg} ${roleStyle.border} border`}>
                  <span className={`text-xs sm:text-sm font-bold ${roleStyle.text}`}>{roleStyle.label}</span>
                </div>

                {/* Player Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm sm:text-base leading-tight">{entry.player.name}</p>
                </div>

                {/* Contract Info */}
                {entry.contract && durStyle ? (
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <div className="bg-accent-500/20 border border-accent-500/40 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center">
                      <p className="text-[7px] sm:text-[9px] text-accent-300 uppercase">Ing</p>
                      <p className="text-accent-400 font-bold text-xs sm:text-sm">{entry.contract.salary}</p>
                    </div>
                    <div className={`${durStyle.bg} border ${durStyle.border} rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center`}>
                      <p className={`text-[7px] sm:text-[9px] ${durStyle.label} uppercase`}>Dur</p>
                      <p className={`${durStyle.text} font-bold text-xs sm:text-sm`}>{entry.contract.duration}</p>
                    </div>
                    {entry.contract.rescissionClause !== undefined && entry.contract.rescissionClause !== null && (
                      <>
                        <div className="bg-orange-500/20 border border-orange-500/40 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center">
                          <p className="text-[7px] sm:text-[9px] text-orange-300 uppercase">Cls</p>
                          <p className="text-orange-400 font-bold text-xs sm:text-sm">{entry.contract.rescissionClause}</p>
                        </div>
                        <div className="bg-warning-500/20 border border-warning-500/40 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center">
                          <p className="text-[7px] sm:text-[9px] text-warning-300 uppercase">Rub</p>
                          <p className="text-warning-400 font-bold text-xs sm:text-sm">{entry.contract.rescissionClause + entry.contract.salary}</p>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500 text-xs sm:text-sm">No contratto</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// Componente card giocatore
function PlayerCard({ entry, onPlayerClick }: { entry: RosterEntry; onPlayerClick: () => void }) {
  const roleStyle = getRoleStyle(entry.player.position)
  const playerPhotoUrl = getPlayerPhotoUrl(entry.player.apiFootballId)

  return (
    <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-surface-200 rounded-lg border border-surface-50/20 hover:border-surface-50/40 transition-colors">
      {/* Player Photo with Team Logo */}
      <div className="relative flex-shrink-0">
        {playerPhotoUrl ? (
          <img
            src={playerPhotoUrl}
            alt={entry.player.name}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[entry.player.position]} items-center justify-center text-white font-bold text-sm ${playerPhotoUrl ? 'hidden' : 'flex'}`}
        >
          {entry.player.position}
        </div>
        {/* Team logo badge */}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white p-0.5 border border-surface-50/20">
          <img
            src={getTeamLogo(entry.player.team)}
            alt={entry.player.team}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
      </div>

      {/* Role Badge */}
      <div className={`w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${roleStyle.bg} ${roleStyle.border} border`}>
        <span className={`text-xs sm:text-sm font-bold ${roleStyle.text}`}>{roleStyle.label}</span>
      </div>

      {/* Player Info - nome sempre visibile */}
      <div className="flex-1 min-w-0">
        <button
          onClick={onPlayerClick}
          className="text-white font-medium text-sm sm:text-base leading-tight hover:text-primary-400 transition-colors text-left"
        >
          {entry.player.name}
        </button>
        <p className="text-gray-500 text-[10px] sm:text-xs hidden sm:block">{entry.player.team}</p>
      </div>

      {/* Contract & Price Info - compatto su mobile */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {entry.contract ? (
          <>
            {/* Ingaggio */}
            <div className="bg-accent-500/20 border border-accent-500/40 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center">
              <p className="text-[7px] sm:text-[10px] text-accent-300 uppercase font-medium">Ing</p>
              <p className="text-accent-400 font-bold text-xs sm:text-base">{entry.contract.salary}</p>
            </div>
            {/* Durata - colorata in base ai semestri */}
            {(() => {
              const durStyle = getDurationStyle(entry.contract.duration)
              return (
                <div className={`${durStyle.bg} border ${durStyle.border} rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center`}>
                  <p className={`text-[7px] sm:text-[10px] ${durStyle.label} uppercase font-medium`}>Dur</p>
                  <p className={`${durStyle.text} font-bold text-xs sm:text-base`}>{entry.contract.duration}</p>
                </div>
              )
            })()}
            {/* Clausola e Rubata */}
            {entry.contract.rescissionClause !== undefined && entry.contract.rescissionClause !== null && (
              <>
                <div className="bg-orange-500/20 border border-orange-500/40 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center">
                  <p className="text-[7px] sm:text-[10px] text-orange-300 uppercase font-medium">Cls</p>
                  <p className="text-orange-400 font-bold text-xs sm:text-base">{entry.contract.rescissionClause}</p>
                </div>
                <div className="bg-warning-500/20 border border-warning-500/40 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center">
                  <p className="text-[7px] sm:text-[10px] text-warning-300 uppercase font-medium">Rub</p>
                  <p className="text-warning-400 font-bold text-xs sm:text-base">{entry.contract.rescissionClause + entry.contract.salary}</p>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="bg-danger-500/20 border border-danger-500/40 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center">
            <p className="text-[7px] sm:text-[10px] text-danger-300 uppercase">Costo</p>
            <p className="text-danger-400 font-bold text-xs sm:text-base">{entry.acquisitionPrice}</p>
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
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState<string | null>(null)

  // Filtri
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterTeam, setFilterTeam] = useState('')

  // Modale giocatori per squadra
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  // Modale statistiche giocatore
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerInfo | null>(null)

  useEffect(() => {
    void loadData()
  }, [leagueId])

  async function loadData() {
    setError(null)
    setIsLoading(true)
    try {
      const [rosterResult, leagueResult, sessionsResult] = await Promise.all([
        auctionApi.getRoster(leagueId),
        leagueApi.getById(leagueId),
        auctionApi.getSessions(leagueId)
      ])

      if (rosterResult.success && rosterResult.data) {
        // Debug: log first player to see if apiFootballId is present
        const data = rosterResult.data as RosterData
        const firstPlayer = data.roster?.P?.[0] || data.roster?.D?.[0] || data.roster?.C?.[0] || data.roster?.A?.[0]
        if (firstPlayer) {
          console.log('Roster API response - first player:', firstPlayer.player.name, 'apiFootballId:', firstPlayer.player.apiFootballId)
        }
        setRosterData(data)
      }
      if (leagueResult.success && leagueResult.data) {
        const data = leagueResult.data as { isAdmin: boolean }
        setIsLeagueAdmin(data.isAdmin)
      }
      if (sessionsResult.success && sessionsResult.data) {
        setSessions(sessionsResult.data as Session[])
      }
    } catch {
      setError('Errore nel caricamento della rosa')
    }
    setIsLoading(false)
  }

  function getActiveSession() {
    return sessions.find(s => s.status === 'ACTIVE')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-400">Caricamento rosa...</p>
        </div>
      </div>
    )
  }

  if (!rosterData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-xl text-danger-400">{error || 'Errore nel caricamento della rosa'}</p>
          <button
            onClick={() => { setError(null); void loadData(); }}
            className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg transition-colors min-h-[44px]"
          >
            Riprova
          </button>
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
    <div className="min-h-screen">
      <Navigation currentPage="roster" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
                <span className="text-xl sm:text-3xl">📋</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-white">La Mia Rosa</h1>
                <p className="text-gray-400 mt-1">{member.user.username}</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="flex flex-wrap gap-3">
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

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Contatori per squadra */}
        <TeamCounters players={allPlayers} onTeamClick={setSelectedTeam} />

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search by name */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cerca per nome</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); }}
                placeholder="Nome giocatore..."
                className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>

            {/* Filter by role */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ruolo</label>
              <select
                value={filterRole}
                onChange={e => { setFilterRole(e.target.value); }}
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
                onChange={e => { setFilterTeam(e.target.value); }}
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
              <p className="text-gray-400 text-sm mt-1">Prova a modificare i filtri</p>
            </div>
          ) : (
            sortedPlayers.map(entry => (
              <PlayerCard
                key={entry.id}
                entry={entry}
                onPlayerClick={() => { setSelectedPlayerStats({
                  name: entry.player.name,
                  team: entry.player.team,
                  position: entry.player.position,
                  quotation: entry.player.quotation,
                  apiFootballId: entry.player.apiFootballId,
                  apiFootballStats: entry.player.apiFootballStats,
                }); }}
              />
            ))
          )}
        </div>

        <div className="mt-8 flex gap-4">
          <Button size="lg" variant="outline" onClick={() => { onNavigate('rosters', { leagueId }); }}>
            <span className="mr-2">👥</span> Vedi tutte le rose
          </Button>
          {getActiveSession()?.currentPhase === 'CONTRATTI' && (
            <Button size="lg" variant="outline" onClick={() => { onNavigate('contracts', { leagueId }); }}>
              <span className="mr-2">📝</span> Gestisci Contratti
            </Button>
          )}
        </div>
      </main>

      {/* Modale giocatori per squadra */}
      {selectedTeam && (
        <TeamPlayersModal
          team={selectedTeam}
          players={allPlayers}
          onClose={() => { setSelectedTeam(null); }}
        />
      )}

      {/* Modale statistiche giocatore */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => { setSelectedPlayerStats(null); }}
        player={selectedPlayerStats}
      />
    </div>
  )
}
