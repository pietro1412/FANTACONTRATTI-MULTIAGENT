import { useState } from 'react'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
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
  /** When true, players are visible but not clickable (not my turn) */
  disabled?: boolean
}

const ROLE_TABS = ['P', 'D', 'C', 'A'] as const

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
  disabled = false,
}: NominationPanelProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  const handleSelectAndNominate = (playerId: string) => {
    setSelectedPlayer(playerId)
    onNominatePlayer(playerId)
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg font-bold text-sky-400">{disabled ? 'Giocatori disponibili' : 'Cerca e Nomina'}</p>
        </div>
        <p className="text-sm text-gray-400">{disabled ? 'Attendi il tuo turno per nominare' : 'Seleziona un giocatore per l\'asta'}</p>
      </div>

      {/* Search bar - glass panel style */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Cerca giocatore..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full bg-slate-800/60 backdrop-blur border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-gray-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 focus:outline-none transition-colors"
        />
      </div>

      {/* Team Filter Dropdown */}
      <div className="relative mb-3" data-team-dropdown>
        <button
          type="button"
          onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
          className="w-full bg-slate-800/60 backdrop-blur border border-white/10 text-white rounded-xl px-3 py-2 text-sm flex items-center justify-between hover:border-white/20 transition-colors"
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
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onTeamChange(''); setTeamDropdownOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${!selectedTeam ? 'bg-sky-500/20 text-sky-400' : 'text-white'}`}
            >
              Tutte le squadre
            </button>
            {availableTeams.map(team => (
              <button
                key={team.name}
                type="button"
                onClick={() => { onTeamChange(team.name); setTeamDropdownOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2 ${selectedTeam === team.name ? 'bg-sky-500/20 text-sky-400' : 'text-white'}`}
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

      {/* Role filter tabs */}
      {isPrimoMercato && marketProgress && (
        <div className="flex gap-1 mb-3">
          {ROLE_TABS.map(role => {
            const isActive = role === marketProgress.currentRole
            return (
              <span
                key={role}
                className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  isActive
                    ? POSITION_FILTER_COLORS[role as keyof typeof POSITION_FILTER_COLORS] || ''
                    : 'bg-slate-800/40 text-gray-500 border-white/5'
                }`}
              >
                {POSITION_NAMES[role as keyof typeof POSITION_NAMES] || role}
              </span>
            )
          })}
        </div>
      )}

      {/* Player Grid */}
      <div className="max-h-[45vh] overflow-y-auto">
        {players.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Nessun giocatore</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {players.slice(0, 50).map(player => {
              const photoUrl = getPlayerPhotoUrl(player.apiFootballId)
              const posGradient = POSITION_GRADIENTS[player.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'
              const Wrapper = disabled ? 'div' : 'button'
              return (
                <Wrapper
                  key={player.id}
                  {...(!disabled ? { onClick: () => handleSelectAndNominate(player.id) } : {})}
                  className={`relative rounded-xl p-2.5 text-left transition-all border group ${
                    disabled
                      ? 'bg-slate-800/40 border-white/5 opacity-60 cursor-default'
                      : selectedPlayer === player.id
                        ? 'bg-sky-500/15 border-sky-500/50 scale-[1.02]'
                        : 'bg-slate-800/40 border-white/5 hover:border-sky-500/40 hover:scale-[1.02]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Player Photo / Position fallback */}
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={player.name}
                        className="w-10 h-10 rounded-lg object-cover bg-slate-700 flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <span className={`w-10 h-10 rounded-lg bg-gradient-to-br ${posGradient} flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${photoUrl ? 'hidden' : ''}`}>
                      {player.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-xs truncate">{player.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-3.5 h-3.5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                          <img src={getTeamLogo(player.team)} alt={player.team} className="w-2.5 h-2.5 object-contain" />
                        </div>
                        <span className="text-[10px] text-gray-400 truncate">{player.team}</span>
                      </div>
                      {player.age != null && player.age > 0 && (
                        <span className="text-[10px] text-gray-500 font-mono">{player.age} anni</span>
                      )}
                    </div>
                  </div>
                  {player.quotation > 0 && (
                    <div className="mt-1.5 text-right">
                      <span className="text-xs font-mono font-bold text-accent-400">{player.quotation}</span>
                    </div>
                  )}
                </Wrapper>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
