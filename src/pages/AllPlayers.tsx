import { useState, useEffect, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Navigation } from '../components/Navigation'
import { PullToRefresh } from '../components/PullToRefresh'
import { playerApi, leagueApi } from '../services/api'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { BottomSheet } from '../components/ui/BottomSheet'
import { POSITION_GRADIENTS, POSITION_FILTER_COLORS } from '../components/ui/PositionBadge'
import { PlayerStatsModal, type PlayerInfo, type PlayerStats } from '../components/PlayerStatsModal'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { SlidersHorizontal } from 'lucide-react'
import { SkeletonPlayerRow } from '../components/ui/Skeleton'

interface AllPlayersProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
  initialTeamFilter?: string
}

interface Player {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  listStatus: string
  age?: number | null
  apiFootballId?: number | null
  apiFootballStats?: PlayerStats | null
  statsSyncedAt?: string | null
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

// Alias for backward compatibility
const POSITION_COLORS = POSITION_GRADIENTS
const POSITION_BG = POSITION_FILTER_COLORS

// Age color function - younger is better
function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400 font-bold'
  if (age < 25) return 'text-green-400'
  if (age < 30) return 'text-yellow-400'
  if (age < 35) return 'text-orange-400'
  return 'text-red-400'
}

export function AllPlayers({ leagueId, onNavigate, initialTeamFilter }: AllPlayersProps) {
  const [players, setPlayers] = useState<PlayerWithRoster[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPosition, setSelectedPosition] = useState<string>('')
  const [showOnlyRostered, setShowOnlyRostered] = useState(!!initialTeamFilter)
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>(initialTeamFilter || '')
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [leagueName, setLeagueName] = useState('')
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerInfo | null>(null)
  const [availableTeams, setAvailableTeams] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)

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

      // Build roster map and collect available teams
      const newRosterMap = new Map<string, RosterInfo>()
      const teams: string[] = []
      if (leagueData.members && Array.isArray(leagueData.members)) {
        for (const member of leagueData.members) {
          if (member.teamName) {
            teams.push(member.teamName)
          }
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
      setAvailableTeams(teams.sort())
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
    void loadData()
  }, [loadData])

  // Enrich players with roster info
  const enrichedPlayers = players.map(player => ({
    ...player,
    rosterInfo: rosterMap.get(player.id),
  }))

  // Apply filters
  const filteredPlayers = enrichedPlayers.filter(player => {
    if (showOnlyRostered && !player.rosterInfo) return false
    if (selectedTeamFilter && player.rosterInfo?.teamName !== selectedTeamFilter) return false
    return true
  })

  // Virtualization
  const listRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filteredPlayers.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  return (
    <div className="min-h-screen bg-dark-100">
      <Navigation currentPage="allPlayers" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <PullToRefresh onRefresh={loadData}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-white">Tutti i Giocatori</h1>
          <p className="text-gray-400">{leagueName}</p>
        </div>

        {/* Filters */}
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-6">
          {/* Mobile: search + Filtri button */}
          <div className="flex gap-2 items-center md:hidden">
            <div className="flex-1">
              <Input
                placeholder="Cerca giocatore..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); }}
                className="bg-surface-300 border-surface-50/30"
              />
            </div>
            <button
              onClick={() => { setFiltersOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-sm text-gray-300 hover:text-white transition-colors flex-shrink-0"
            >
              <SlidersHorizontal size={16} />
              Filtri{(selectedPosition || showOnlyRostered || selectedTeamFilter) && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-primary-500/30 text-primary-400 rounded-full">
                  {[selectedPosition, showOnlyRostered, selectedTeamFilter].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Desktop: full inline filters */}
          <div className="hidden md:flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Cerca giocatore..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); }}
                className="bg-surface-300 border-surface-50/30"
              />
            </div>

            <div className="flex gap-2">
              {['', 'P', 'D', 'C', 'A'].map(pos => (
                <button
                  key={pos}
                  onClick={() => { setSelectedPosition(pos); }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedPosition === pos
                      ? pos === ''
                        ? 'bg-primary-500/30 text-primary-400'
                        : (POSITION_BG[pos] ?? '')
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
                onChange={e => {
                  setShowOnlyRostered(e.target.checked)
                  if (!e.target.checked) setSelectedTeamFilter('')
                }}
                className="w-4 h-4 rounded border-gray-600 bg-surface-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-300">Solo in rosa</span>
            </label>

            {availableTeams.length > 0 && (
              <select
                value={selectedTeamFilter}
                onChange={e => {
                  setSelectedTeamFilter(e.target.value)
                  if (e.target.value) setShowOnlyRostered(true)
                }}
                className="px-3 py-1.5 text-sm rounded-lg bg-surface-300 border border-surface-50/30 text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Tutte le squadre</option>
                {availableTeams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Mobile Filters BottomSheet */}
        <BottomSheet isOpen={filtersOpen} onClose={() => { setFiltersOpen(false); }} title="Filtri">
          <div className="p-4 space-y-5">
            <div>
              <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Posizione</label>
              <div className="flex gap-2">
                {['', 'P', 'D', 'C', 'A'].map(pos => (
                  <button
                    key={pos}
                    onClick={() => { setSelectedPosition(pos); }}
                    className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      selectedPosition === pos
                        ? pos === ''
                          ? 'bg-primary-500/30 text-primary-400'
                          : (POSITION_BG[pos] ?? '')
                        : 'bg-surface-300 text-gray-400'
                    }`}
                  >
                    {pos === '' ? 'Tutti' : pos}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={showOnlyRostered}
                  onChange={e => {
                    setShowOnlyRostered(e.target.checked)
                    if (!e.target.checked) setSelectedTeamFilter('')
                  }}
                  className="w-5 h-5 rounded border-gray-600 bg-surface-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-300">Solo giocatori in rosa</span>
              </label>
            </div>

            {availableTeams.length > 0 && (
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Squadra</label>
                <select
                  value={selectedTeamFilter}
                  onChange={e => {
                    setSelectedTeamFilter(e.target.value)
                    if (e.target.value) setShowOnlyRostered(true)
                  }}
                  className="w-full px-3 py-2.5 text-sm rounded-lg bg-surface-300 border border-surface-50/30 text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Tutte le squadre</option>
                  {availableTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => { setFiltersOpen(false); }}
              className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
            >
              Applica Filtri
            </button>
          </div>
        </BottomSheet>

        {/* Results */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonPlayerRow key={i} />
            ))}
          </div>
        ) : (
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-4 border-b border-surface-50/20">
              <p className="text-sm text-gray-400">{filteredPlayers.length} giocatori trovati</p>
            </div>

            {filteredPlayers.length === 0 ? (
              <EmptyState icon="🔍" title="Nessun giocatore trovato" description="Prova a cambiare i filtri di ricerca." compact />
            ) : (
              <div ref={listRef} className="max-h-[70vh] overflow-y-auto">
                <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                {virtualizer.getVirtualItems().map(virtualRow => {
                  const player = filteredPlayers[virtualRow.index]
                  return (
                  <div
                    key={player.id}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                    className={`p-4 border-b border-surface-50/10 ${player.rosterInfo ? 'bg-surface-300/30' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Player photo with position badge */}
                        <div className="relative">
                          {player.apiFootballId ? (
                            <img
                              src={getPlayerPhotoUrl(player.apiFootballId)}
                              alt={player.name}
                              className="w-10 h-10 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                                const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <div
                            className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position] ?? ''} items-center justify-center text-sm font-bold text-white ${player.apiFootballId ? 'hidden' : 'flex'}`}
                          >
                            {player.position}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position] ?? ''} flex items-center justify-center text-white font-bold text-[10px] border border-surface-200`}
                          >
                            {player.position}
                          </span>
                        </div>
                        <div>
                          <button
                            onClick={() => { setSelectedPlayerStats({
                              name: player.name,
                              team: player.team,
                              position: player.position,
                              quotation: player.quotation,
                              age: player.age,
                              apiFootballId: player.apiFootballId,
                              apiFootballStats: player.apiFootballStats,
                              statsSyncedAt: player.statsSyncedAt,
                            }); }}
                            className="font-medium text-white hover:text-primary-400 transition-colors text-left"
                          >
                            {player.name}
                          </button>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span>{player.team}</span>
                            {player.age != null && (
                              <span className={getAgeColor(player.age)}>• {player.age} anni</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {/* Stats mini-display */}
                        {player.apiFootballStats?.games?.appearences !== null && player.apiFootballStats?.games?.appearences !== undefined && (
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span title="Presenze">{player.apiFootballStats.games.appearences}P</span>
                            <span title="Gol">{player.apiFootballStats?.goals?.total ?? 0}G</span>
                            <span title="Assist">{player.apiFootballStats?.goals?.assists ?? 0}A</span>
                            {player.apiFootballStats?.games?.rating && (
                              <span title="Rating" className="text-primary-400">{player.apiFootballStats.games.rating.toFixed(1)}</span>
                            )}
                          </div>
                        )}

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
                  )
                })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => { setSelectedPlayerStats(null); }}
        player={selectedPlayerStats}
      />
      </PullToRefresh>
    </div>
  )
}
