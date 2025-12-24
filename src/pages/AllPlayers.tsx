import { useState, useEffect, useCallback } from 'react'
import { Navigation } from '../components/Navigation'
import { playerApi, leagueApi } from '../services/api'
import { Input } from '../components/ui/Input'

interface AllPlayersProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  listStatus: string
}

interface RosterInfo {
  memberId: string
  memberUsername: string
  teamName: string | null
  acquisitionPrice: number
  contract?: {
    salary: number
    duration: number
    rescissionClause: number | null
  } | null
}

interface PlayerWithRoster extends Player {
  rosterInfo?: RosterInfo
}

interface LeagueData {
  id: string
  name: string
  members: {
    id: string
    user: { username: string }
    teamName: string | null
    roster: {
      playerId: string
      acquisitionPrice: number
      contract?: {
        salary: number
        duration: number
        rescissionClause: number | null
      } | null
    }[]
  }[]
  userMembership?: { role: string }
}

const POSITION_COLORS: Record<string, string> = {
  P: 'from-yellow-500 to-yellow-600',
  D: 'from-green-500 to-green-600',
  C: 'from-blue-500 to-blue-600',
  A: 'from-red-500 to-red-600',
}

const POSITION_BG: Record<string, string> = {
  P: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  D: 'bg-green-500/20 text-green-400 border-green-500/30',
  C: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  A: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function AllPlayers({ leagueId, onNavigate }: AllPlayersProps) {
  const [players, setPlayers] = useState<PlayerWithRoster[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPosition, setSelectedPosition] = useState<string>('')
  const [showOnlyRostered, setShowOnlyRostered] = useState(false)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [leagueName, setLeagueName] = useState('')

  // Map of playerId -> roster info
  const [rosterMap, setRosterMap] = useState<Map<string, RosterInfo>>(new Map())

  const loadData = useCallback(async () => {
    setIsLoading(true)

    // Load league data with rosters
    const leagueResponse = await leagueApi.getAllRosters(leagueId)
    if (leagueResponse.success && leagueResponse.data) {
      const leagueData = leagueResponse.data as LeagueData & { isAdmin?: boolean }
      setLeagueName(leagueData.name)
      setIsLeagueAdmin(leagueData.isAdmin || false)

      // Build roster map
      const newRosterMap = new Map<string, RosterInfo>()
      if (leagueData.members && Array.isArray(leagueData.members)) {
        for (const member of leagueData.members) {
          if (member.roster && Array.isArray(member.roster)) {
            for (const rosterEntry of member.roster) {
              newRosterMap.set(rosterEntry.playerId, {
                memberId: member.id,
                memberUsername: member.user.username,
                teamName: member.teamName,
                acquisitionPrice: rosterEntry.acquisitionPrice,
                contract: rosterEntry.contract,
              })
            }
          }
        }
      }
      setRosterMap(newRosterMap)
    }

    // Load all players
    const filters: { position?: string; search?: string } = {}
    if (selectedPosition) filters.position = selectedPosition
    if (searchQuery) filters.search = searchQuery

    const playersResponse = await playerApi.getAll(filters)
    if (playersResponse.success && playersResponse.data) {
      setPlayers(playersResponse.data as Player[])
    }

    setIsLoading(false)
  }, [leagueId, selectedPosition, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Enrich players with roster info
  const enrichedPlayers = players.map(player => ({
    ...player,
    rosterInfo: rosterMap.get(player.id),
  }))

  // Apply filters
  const filteredPlayers = enrichedPlayers.filter(player => {
    if (showOnlyRostered && !player.rosterInfo) return false
    return true
  })

  return (
    <div className="min-h-screen bg-dark-100">
      <Navigation currentPage="allPlayers" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Tutti i Giocatori</h1>
          <p className="text-gray-400">{leagueName}</p>
        </div>

        {/* Filters */}
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Cerca giocatore..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-surface-300 border-surface-50/30"
              />
            </div>

            <div className="flex gap-2">
              {['', 'P', 'D', 'C', 'A'].map(pos => (
                <button
                  key={pos}
                  onClick={() => setSelectedPosition(pos)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedPosition === pos
                      ? pos === ''
                        ? 'bg-primary-500/30 text-primary-400'
                        : POSITION_BG[pos]
                      : 'bg-surface-300 text-gray-400 hover:text-white'
                  }`}
                >
                  {pos === '' ? 'Tutti' : pos}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyRostered}
                onChange={e => setShowOnlyRostered(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-surface-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-300">Solo in rosa</span>
            </label>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-4 border-b border-surface-50/20">
              <p className="text-sm text-gray-400">{filteredPlayers.length} giocatori trovati</p>
            </div>

            {filteredPlayers.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                Nessun giocatore trovato
              </div>
            ) : (
              <div className="divide-y divide-surface-50/10">
                {filteredPlayers.slice(0, 100).map(player => (
                  <div
                    key={player.id}
                    className={`p-4 ${player.rosterInfo ? 'bg-surface-300/30' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-sm font-bold text-white`}>
                          {player.position}
                        </div>
                        <div>
                          <p className="font-medium text-white">{player.name}</p>
                          <p className="text-sm text-gray-400">{player.team}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Quotazione</p>
                          <p className="font-mono text-white">{player.quotation}</p>
                        </div>

                        {player.rosterInfo ? (
                          <div className="bg-primary-500/20 rounded-lg px-4 py-2 min-w-[200px]">
                            <p className="text-xs text-primary-300">In rosa di</p>
                            <p className="font-medium text-primary-400">{player.rosterInfo.memberUsername}</p>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>Pagato: {player.rosterInfo.acquisitionPrice}</span>
                              {player.rosterInfo.contract && (
                                <span>{player.rosterInfo.contract.duration}A - {player.rosterInfo.contract.salary}/anno</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-surface-300 rounded-lg px-4 py-2 min-w-[200px] text-center">
                            <p className="text-sm text-gray-500">Libero</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredPlayers.length > 100 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    Mostrati i primi 100 risultati. Affina la ricerca per vedere altri giocatori.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
