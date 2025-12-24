import { useState, useEffect, useCallback } from 'react'
import { Navigation } from '../components/Navigation'
import { leagueApi } from '../services/api'

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

const POSITION_COLORS: Record<string, string> = {
  P: 'from-yellow-500 to-yellow-600',
  D: 'from-green-500 to-green-600',
  C: 'from-blue-500 to-blue-600',
  A: 'from-red-500 to-red-600',
}

const POSITION_NAMES: Record<string, string> = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
}

export function AllRosters({ leagueId, onNavigate }: AllRostersProps) {
  const [league, setLeague] = useState<LeagueData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  const loadLeague = useCallback(async () => {
    setIsLoading(true)
    const response = await leagueApi.getAllRosters(leagueId)
    if (response.success && response.data) {
      const data = response.data as LeagueData & { isAdmin?: boolean }
      setLeague(data)
      setIsLeagueAdmin(data.isAdmin || false)
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
    return byPosition
  }

  const getTotalValue = (roster: RosterEntry[]) => {
    return roster.reduce((sum, r) => sum + r.acquisitionPrice, 0)
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
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-gray-400 text-center">Lega non trovata</p>
        </div>
      </div>
    )
  }

  const activeMembers = league.members.filter(m => m.roster.length > 0 || m.currentBudget > 0)

  return (
    <div className="min-h-screen bg-dark-100">
      <Navigation currentPage="allRosters" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Tutte le Rose</h1>
          <p className="text-gray-400">{league.name}</p>
        </div>

        {league.inContrattiPhase && (
          <div className="mb-6 p-4 bg-warning-500/10 border border-warning-500/30 rounded-xl">
            <p className="text-warning-400">
              <strong>Fase CONTRATTI attiva:</strong> I dettagli dei contratti degli altri manager sono nascosti fino alla fine della fase.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Members List */}
          <div className="lg:col-span-1">
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-4 border-b border-surface-50/20">
                <h2 className="font-bold text-white">Manager ({activeMembers.length})</h2>
              </div>
              <div className="divide-y divide-surface-50/10">
                {activeMembers.map(member => (
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
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-accent-400">{member.roster.length} giocatori</p>
                        <p className="text-xs text-gray-500">Budget: {member.currentBudget}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Member Roster */}
          <div className="lg:col-span-2">
            {selectedMember ? (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                <div className="p-4 border-b border-surface-50/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="font-bold text-white text-lg">{selectedMember.user.username}</h2>
                      {selectedMember.teamName && (
                        <p className="text-gray-400">{selectedMember.teamName}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Valore Rosa</p>
                      <p className="text-xl font-bold text-accent-400">{getTotalValue(selectedMember.roster)}</p>
                    </div>
                  </div>
                </div>

                {selectedMember.roster.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    Nessun giocatore in rosa
                  </div>
                ) : (
                  <div className="p-4 space-y-6">
                    {(['P', 'D', 'C', 'A'] as const).map(position => {
                      const positionRoster = getRosterByPosition(selectedMember.roster)[position]
                      if (positionRoster.length === 0) return null

                      return (
                        <div key={position}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[position]} flex items-center justify-center text-sm font-bold text-white`}>
                              {position}
                            </div>
                            <h3 className="font-medium text-white">{POSITION_NAMES[position]}i ({positionRoster.length})</h3>
                          </div>

                          <div className="grid gap-2">
                            {positionRoster.map(entry => (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between p-3 bg-surface-300 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[entry.player.position]} flex items-center justify-center text-sm font-bold text-white`}>
                                    {entry.player.position}
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">{entry.player.name}</p>
                                    <p className="text-xs text-gray-400">{entry.player.team}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-mono text-accent-400">{entry.acquisitionPrice}</p>
                                  {entry.contract && (
                                    <p className="text-xs text-gray-500">
                                      {entry.contract.duration}sem - {entry.contract.salary}M/sem
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-12 text-center">
                <div className="text-6xl mb-4">👈</div>
                <p className="text-gray-400">Seleziona un manager per vedere la sua rosa</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
