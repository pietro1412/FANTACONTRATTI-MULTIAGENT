import { Input } from '../ui/Input'
import { getTeamLogo } from '../../utils/teamLogos'
import { POSITION_GRADIENTS, POSITION_FILTER_COLORS, POSITION_NAMES } from '../ui/PositionBadge'
import type { Player, MarketProgress } from '../../types/auctionroom.types'

interface NominationPanelProps {
  players: Player[]
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedTeam: string
  onTeamChange: (team: string) => void
  availableTeams: Array<{ name: string; playerCount: number }>
  teamDropdownOpen: boolean
  setTeamDropdownOpen: (open: boolean) => void
  onNominatePlayer: (playerId: string) => void
  marketProgress: MarketProgress | null
  isPrimoMercato: boolean
}

export function NominationPanel({
  players,
  searchQuery,
  onSearchChange,
  selectedTeam,
  onTeamChange,
  availableTeams,
  teamDropdownOpen,
  setTeamDropdownOpen,
  onNominatePlayer,
  marketProgress,
  isPrimoMercato,
}: NominationPanelProps) {
  return (
    <div>
      <div className="text-center mb-4">
        <div className="text-3xl mb-2">🎯</div>
        <p className="text-lg font-bold text-accent-400">È il tuo turno!</p>
        <p className="text-sm text-gray-400">Seleziona un giocatore</p>
      </div>

      <Input
        placeholder="Cerca giocatore..."
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        className="mb-3 bg-surface-300 border-surface-50/30 text-white placeholder-gray-500"
      />

      {/* Team Filter Dropdown */}
      <div className="relative mb-3" data-team-dropdown>
        <button
          type="button"
          onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
          className="w-full bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {selectedTeam ? (
              <>
                <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5">
                  <img src={getTeamLogo(selectedTeam)} alt={selectedTeam} className="w-4 h-4 object-contain" />
                </div>
                <span>{selectedTeam}</span>
              </>
            ) : (
              <span className="text-gray-400">Tutte le squadre</span>
            )}
          </div>
          <svg className={`w-4 h-4 transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {teamDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-200 border border-surface-50/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onTeamChange(''); setTeamDropdownOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 ${!selectedTeam ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
            >
              Tutte le squadre
            </button>
            {availableTeams.map(team => (
              <button
                key={team.name}
                type="button"
                onClick={() => { onTeamChange(team.name); setTeamDropdownOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${selectedTeam === team.name ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
              >
                <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                  <img src={getTeamLogo(team.name)} alt={team.name} className="w-4 h-4 object-contain" />
                </div>
                <span>{team.name}</span>
                <span className="text-xs text-gray-500 ml-auto">({team.playerCount})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current position indicator for primo mercato */}
      {isPrimoMercato && marketProgress && (
        <div className={`text-center py-2 px-3 rounded-lg mb-3 border ${POSITION_FILTER_COLORS[marketProgress.currentRole as keyof typeof POSITION_FILTER_COLORS] || ''}`}>
          <span className="font-medium text-sm">Solo {POSITION_NAMES[marketProgress.currentRole as keyof typeof POSITION_NAMES] || marketProgress.currentRole}</span>
        </div>
      )}

      {/* Player list */}
      <div className="max-h-[45vh] overflow-y-auto space-y-1">
        {players.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Nessun giocatore</p>
        ) : (
          players.slice(0, 50).map(player => (
            <button
              key={player.id}
              onClick={() => onNominatePlayer(player.id)}
              className="w-full flex items-center p-3 rounded-lg bg-surface-300 hover:bg-primary-500/10 border border-transparent hover:border-primary-500/30 transition-all text-left"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[player.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                  {player.position}
                </span>
                <div className="w-7 h-7 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                  <img src={getTeamLogo(player.team)} alt={player.team} className="w-6 h-6 object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{player.name}</p>
                  <p className="text-xs text-gray-400 truncate">{player.team}</p>
                </div>
              </div>
              {player.quotation > 0 && (
                <span className="text-xs font-mono text-accent-400 ml-2">{player.quotation}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
