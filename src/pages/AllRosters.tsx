import { useState, useEffect, useCallback } from 'react'
import { Navigation } from '../components/Navigation'
import { POSITION_GRADIENTS } from '../components/ui/PositionBadge'
import { leagueApi } from '../services/api'
import { getTeamLogo } from '../utils/teamLogos'
import { getPlayerPhotoUrl } from '../utils/player-images'

interface AllRostersProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  apiFootballId?: number | null
}

interface RosterEntry {
  id: string
  playerId: string
  acquisitionPrice: number
  acquisitionType: string
  player: Player
  contract?: {
    id: string
    salary: number
    duration: number
    rescissionClause: number | null
    signedAt: string
  } | null
}

interface Member {
  id: string
  userId: string
  role: 'ADMIN' | 'MEMBER'
  teamName: string | null
  currentBudget: number
  user: {
    username: string
  }
  roster: RosterEntry[]
}

interface LeagueData {
  id: string
  name: string
  members: Member[]
  inContrattiPhase?: boolean
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


// Componente card giocatore (stesso stile di Roster.tsx)
function PlayerCard({ entry }: { entry: RosterEntry }) {
  const roleStyle = getRoleStyle(entry.player.position)
  const durStyle = entry.contract ? getDurationStyle(entry.contract.duration) : null
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
        <p className="text-white font-medium text-sm sm:text-base leading-tight">{entry.player.name}</p>
        <p className="text-gray-500 text-[10px] sm:text-xs hidden sm:block">{entry.player.team}</p>
      </div>

      {/* Contract & Price Info - compatto su mobile */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {entry.contract && durStyle ? (
          <>
            {/* Ingaggio */}
            <div className="bg-accent-500/20 border border-accent-500/40 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center">
              <p className="text-[7px] sm:text-[10px] text-accent-300 uppercase font-medium">Ing</p>
              <p className="text-accent-400 font-bold text-xs sm:text-base">{entry.contract.salary}</p>
            </div>
            {/* Durata - con colori */}
            <div className={`${durStyle.bg} border ${durStyle.border} rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-center`}>
              <p className={`text-[7px] sm:text-[10px] ${durStyle.label} uppercase font-medium`}>Dur</p>
              <p className={`${durStyle.text} font-bold text-xs sm:text-base`}>{entry.contract.duration}</p>
            </div>
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

// Contatore squadre (cliccabile)
function TeamCounters({ roster, onTeamClick }: { roster: RosterEntry[], onTeamClick: (team: string) => void }) {
  const teamCounts: Record<string, number> = {}
  for (const entry of roster) {
    teamCounts[entry.player.team] = (teamCounts[entry.player.team] || 0) + 1
  }

  const sortedTeams = Object.entries(teamCounts)
    .filter(([, count]) => count > 0) // Solo squadre con giocatori
    .sort((a, b) => b[1] - a[1]) // Ordine decrescente per numero

  if (sortedTeams.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {sortedTeams.map(([team, count]) => (
        <button
          key={team}
          onClick={() => onTeamClick(team)}
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
        onClick={e => e.stopPropagation()}
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

export function AllRosters({ leagueId, onNavigate }: AllRostersProps) {
  const [league, setLeague] = useState<LeagueData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadLeague = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await leagueApi.getAllRosters(leagueId)
      if (response.success && response.data) {
        const data = response.data as LeagueData & { isAdmin?: boolean }
        setLeague(data)
        setIsLeagueAdmin(data.isAdmin || false)
      } else {
        setError('Errore nel caricamento delle rose')
      }
    } catch {
      setError('Errore di connessione')
    }
    setIsLoading(false)
  }, [leagueId])

  useEffect(() => {
    loadLeague()
  }, [loadLeague])

  const getRosterByPosition = (roster: RosterEntry[]): { P: RosterEntry[]; D: RosterEntry[]; C: RosterEntry[]; A: RosterEntry[] } => {
    const byPosition: { P: RosterEntry[]; D: RosterEntry[]; C: RosterEntry[]; A: RosterEntry[] } = { P: [], D: [], C: [], A: [] }
    for (const entry of roster) {
      const pos = entry.player.position
      if (pos === 'P' || pos === 'D' || pos === 'C' || pos === 'A') {
        byPosition[pos].push(entry)
      }
    }
    // Ordina per nome
    for (const pos of ['P', 'D', 'C', 'A'] as const) {
      byPosition[pos].sort((a, b) => a.player.name.localeCompare(b.player.name))
    }
    return byPosition
  }

  const getTotalValue = (roster: RosterEntry[]) => {
    return roster.reduce((sum, r) => sum + r.acquisitionPrice, 0)
  }

  const getTotalSalary = (roster: RosterEntry[]) => {
    return roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
  }

  const getPositionCounts = (roster: RosterEntry[]) => {
    return {
      P: roster.filter(r => r.player.position === 'P').length,
      D: roster.filter(r => r.player.position === 'D').length,
      C: roster.filter(r => r.player.position === 'C').length,
      A: roster.filter(r => r.player.position === 'A').length,
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-100">
        <Navigation currentPage="allRosters" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-dark-100">
        <Navigation currentPage="allRosters" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <div className="max-w-[1600px] mx-auto px-4 py-8 text-center">
          <p className="text-gray-400">{error || 'Lega non trovata'}</p>
          <button
            onClick={() => { setError(null); loadLeague(); }}
            className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg transition-colors min-h-[44px]"
          >
            Riprova
          </button>
        </div>
      </div>
    )
  }

  const activeMembers = league.members.filter(m => m.roster.length > 0 || m.currentBudget > 0)

  return (
    <div className="min-h-screen">
      <Navigation currentPage="allRosters" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-700 flex items-center justify-center shadow-glow">
              <span className="text-3xl">👥</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Tutte le Rose</h1>
              <p className="text-gray-400 mt-1">{league.name}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {league.inContrattiPhase && (
          <div className="mb-6 p-4 bg-warning-500/10 border border-warning-500/30 rounded-xl">
            <p className="text-warning-400">
              <strong>Fase CONTRATTI attiva:</strong> I dettagli dei contratti degli altri Direttori Generali sono nascosti fino alla fine della fase.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Members List */}
          <div className="lg:col-span-1">
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-4 border-b border-surface-50/20">
                <h2 className="font-bold text-white">Direttori Generali ({activeMembers.length})</h2>
              </div>
              <div className="divide-y divide-surface-50/10">
                {activeMembers.map(member => {
                  const counts = getPositionCounts(member.roster)
                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className={`w-full p-4 text-left transition-colors hover:bg-surface-300/50 ${
                        selectedMember?.id === member.id ? 'bg-primary-500/20 border-l-4 border-primary-500' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-white">{member.user.username}</p>
                          {member.teamName && (
                            <p className="text-sm text-gray-400">{member.teamName}</p>
                          )}
                          {/* Mini contatori ruolo */}
                          <div className="flex gap-2 mt-1 text-xs">
                            <span className="text-amber-400">P:{counts.P}</span>
                            <span className="text-blue-400">D:{counts.D}</span>
                            <span className="text-emerald-400">C:{counts.C}</span>
                            <span className="text-red-400">A:{counts.A}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono text-accent-400">{member.roster.length}</p>
                          <p className="text-xs text-gray-500">Budget: {member.currentBudget}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Selected Member Roster */}
          <div className="lg:col-span-2">
            {selectedMember ? (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                {/* Header con stats */}
                <div className="p-4 border-b border-surface-50/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-bold text-white text-lg">{selectedMember.user.username}</h2>
                      {selectedMember.teamName && (
                        <p className="text-gray-400">{selectedMember.teamName}</p>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center bg-surface-300 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500">Budget</p>
                        <p className="text-lg font-bold text-accent-400">{selectedMember.currentBudget}</p>
                      </div>
                      <div className="text-center bg-surface-300 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500">Valore</p>
                        <p className="text-lg font-bold text-primary-400">{getTotalValue(selectedMember.roster)}</p>
                      </div>
                      <div className="text-center bg-surface-300 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500">Ingaggi</p>
                        <p className="text-lg font-bold text-warning-400">{getTotalSalary(selectedMember.roster)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedMember.roster.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    Nessun giocatore in rosa
                  </div>
                ) : (
                  <div className="p-4">
                    {/* Contatori squadre */}
                    <TeamCounters roster={selectedMember.roster} onTeamClick={setSelectedTeam} />

                    {/* Contatori ruolo */}
                    <div className="flex items-center gap-6 mb-4">
                      {(['P', 'D', 'C', 'A'] as const).map(pos => {
                        const style = getRoleStyle(pos)
                        const count = selectedMember.roster.filter(r => r.player.position === pos).length
                        return (
                          <div key={pos} className="flex items-center gap-2">
                            <span className={`font-bold ${style.text}`}>{style.label}</span>
                            <span className="text-white">{count}</span>
                          </div>
                        )
                      })}
                      <div className="flex items-center gap-2 pl-4 border-l border-surface-50/30">
                        <span className="text-gray-400">Totale:</span>
                        <span className="text-white font-bold">{selectedMember.roster.length}</span>
                      </div>
                    </div>

                    {/* Lista giocatori per ruolo */}
                    <div className="space-y-6">
                      {(['P', 'D', 'C', 'A'] as const).map(position => {
                        const positionRoster = getRosterByPosition(selectedMember.roster)[position]
                        if (positionRoster.length === 0) return null

                        const style = getRoleStyle(position)

                        return (
                          <div key={position}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className={`w-8 h-8 rounded-lg ${style.bg} ${style.border} border flex items-center justify-center`}>
                                <span className={`text-sm font-bold ${style.text}`}>{style.label}</span>
                              </div>
                              <h3 className="font-medium text-white">({positionRoster.length})</h3>
                            </div>

                            <div className="space-y-2">
                              {positionRoster.map(entry => (
                                <PlayerCard key={entry.id} entry={entry} />
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-12 text-center">
                <div className="text-6xl mb-4">👈</div>
                <p className="text-gray-400">Seleziona un Direttore Generale per vedere la sua rosa</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modale giocatori per squadra */}
      {selectedTeam && selectedMember && (
        <TeamPlayersModal
          team={selectedTeam}
          players={selectedMember.roster}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  )
}
