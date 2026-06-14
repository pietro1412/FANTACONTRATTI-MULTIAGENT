import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { getTeamLogo } from '../../utils/teamLogos'
import { POSITION_CHIP, type PlayersListData, type PlayerFilters } from './types'

export interface PlayersTabProps {
  filters: PlayerFilters
  setFilters: (filters: PlayerFilters) => void
  teamDropdownOpen: boolean
  setTeamDropdownOpen: (open: boolean) => void
  availableTeams: Array<{ name: string; playerCount: number }>
  playersLoading: boolean
  playersData: PlayersListData | null
}

export function PlayersTab({
  filters,
  setFilters,
  teamDropdownOpen,
  setTeamDropdownOpen,
  availableTeams,
  playersLoading,
  playersData,
}: PlayersTabProps) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block micro-label text-gray-400 mb-1">Cerca</label>
            <Input
              value={filters.search}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value, page: 1 }); }}
              placeholder="Nome giocatore..."
              className="w-48"
            />
          </div>
          <div>
            <label className="block micro-label text-gray-400 mb-1">Ruolo</label>
            <select
              value={filters.position}
              onChange={(e) => { setFilters({ ...filters, position: e.target.value, page: 1 }); }}
              className="bg-surface-300 border border-surface-50 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Tutti</option>
              <option value="P">Portieri</option>
              <option value="D">Difensori</option>
              <option value="C">Centrocampisti</option>
              <option value="A">Attaccanti</option>
            </select>
          </div>
          <div>
            <label className="block micro-label text-gray-400 mb-1">Stato</label>
            <select
              value={filters.listStatus}
              onChange={(e) => { setFilters({ ...filters, listStatus: e.target.value, page: 1 }); }}
              className="bg-surface-300 border border-surface-50 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Tutti</option>
              <option value="IN_LIST">In Lista</option>
              <option value="NOT_IN_LIST">Non in Lista</option>
            </select>
          </div>
          <div className="relative" data-team-dropdown>
            <label className="block micro-label text-gray-400 mb-1">Squadra</label>
            <button
              type="button"
              onClick={() => { setTeamDropdownOpen(!teamDropdownOpen); }}
              className="bg-surface-300 border border-surface-50 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-2 min-w-[160px] justify-between"
            >
              <div className="flex items-center gap-2">
                {filters.team ? (
                  <>
                    <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5">
                      <img src={getTeamLogo(filters.team)} alt={filters.team} className="w-4 h-4 object-contain" />
                    </div>
                    <span>{filters.team}</span>
                  </>
                ) : (
                  <span>Tutte</span>
                )}
              </div>
              <svg className={`w-4 h-4 transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {teamDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-surface-200 border border-surface-50 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto min-w-[200px]">
                <button
                  type="button"
                  onClick={() => { setFilters({ ...filters, team: '', page: 1 }); setTeamDropdownOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${!filters.team ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                >
                  Tutte le squadre
                </button>
                {availableTeams.map(teamData => (
                  <button
                    key={teamData.name}
                    type="button"
                    onClick={() => { setFilters({ ...filters, team: teamData.name, page: 1 }); setTeamDropdownOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${filters.team === teamData.name ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                  >
                    <div className="w-6 h-6 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                      <img src={getTeamLogo(teamData.name)} alt={teamData.name} className="w-5 h-5 object-contain" />
                    </div>
                    <span>{teamData.name}</span>
                    <span className="text-xs text-gray-500 ml-auto font-mono">({teamData.playerCount})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setFilters({ position: '', listStatus: '', search: '', team: '', page: 1 }); }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Players Table */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden">
        {playersLoading ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
          </div>
        ) : playersData && playersData.players.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-300">
                  <tr>
                    <th className="px-4 py-3 text-left micro-label text-gray-400">Ruolo</th>
                    <th className="px-4 py-3 text-left micro-label text-gray-400">Nome</th>
                    <th className="px-4 py-3 text-left micro-label text-gray-400">Squadra</th>
                    <th className="px-4 py-3 text-center micro-label text-gray-400">Quot.</th>
                    <th className="px-4 py-3 text-center micro-label text-gray-400">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50/10">
                  {playersData.players.map((player) => {
                    const isNotInList = player.listStatus !== 'IN_LIST'
                    return (
                      <tr key={player.id} className={`hover:bg-surface-300/50 ${isNotInList ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-display font-bold text-xs ${POSITION_CHIP[player.position] ?? ''}`}>
                            {player.position}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-display font-bold ${isNotInList ? 'text-gray-500 line-through' : 'text-white'}`}>
                            {player.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="relative w-7 h-7 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                              <img
                                src={getTeamLogo(player.team)}
                                alt={player.team}
                                className={`w-6 h-6 object-contain ${isNotInList ? 'grayscale' : ''}`}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/%3E%3C/svg%3E'
                                }}
                              />
                            </div>
                            <span className={isNotInList ? 'text-gray-500' : 'text-gray-400'}>{player.team}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`stat-number text-lg ${isNotInList ? 'text-gray-500' : 'text-accent-400'}`}>{player.quotation}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono text-[10px] font-bold tracking-[0.05em] px-2.5 py-1 rounded-md border ${
                            player.listStatus === 'IN_LIST'
                              ? 'bg-secondary-500/[0.13] text-secondary-400 border-secondary-500/40'
                              : 'bg-danger-500/[0.12] text-danger-400 border-danger-500/40'
                          }`}>
                            {player.listStatus === 'IN_LIST' ? 'In Lista' : 'Non in Lista'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-surface-50 flex items-center justify-between">
              <p className="text-sm text-gray-400 font-mono">
                {playersData.total} giocatori totali
              </p>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={playersData.page <= 1}
                  onClick={() => { setFilters({ ...filters, page: filters.page - 1 }); }}
                >
                  Prec.
                </Button>
                <span className="px-3 py-1 text-sm text-gray-400 font-mono">
                  {playersData.page} / {playersData.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={playersData.page >= playersData.totalPages}
                  onClick={() => { setFilters({ ...filters, page: filters.page + 1 }); }}
                >
                  Succ.
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <p>Nessun giocatore trovato</p>
            <p className="text-sm mt-1">Carica un file quotazioni per popolare la lista</p>
          </div>
        )}
      </div>
    </div>
  )
}
