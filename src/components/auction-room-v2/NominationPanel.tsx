import { useState, useMemo, useEffect } from 'react'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import { POSITION_GRADIENTS, POSITION_FILTER_COLORS, POSITION_NAMES } from '../ui/PositionBadge'
import { PlayerStatsModal } from '../PlayerStatsModal'
import type { PlayerInfo } from '../PlayerStatsModal'
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

const ALL_ROLE_TABS = ['TUTTI', 'P', 'D', 'C', 'A'] as const

function getAgeBadge(age: number | null | undefined): { text: string; bg: string } {
  if (age === null || age === undefined) return { text: 'text-gray-500', bg: 'bg-gray-500/20 border-gray-500/30' }
  if (age < 20) return { text: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' }
  if (age < 25) return { text: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30' }
  if (age < 30) return { text: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' }
  if (age < 35) return { text: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30' }
  return { text: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' }
}

function getMvColor(mv: number | null | undefined): { text: string; bg: string; border: string } {
  if (mv == null) return { text: 'text-gray-400', bg: 'bg-slate-700/40', border: '' }
  if (mv >= 7.0) return { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border border-emerald-500/30' }
  if (mv >= 6.5) return { text: 'text-green-400', bg: 'bg-green-500/15', border: 'border border-green-500/30' }
  if (mv >= 6.0) return { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border border-sky-500/20' }
  if (mv >= 5.5) return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border border-orange-500/20' }
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border border-red-500/20' }
}

function MiniStats({ player }: { player: Player }) {
  const hasStats = player.appearances != null || player.goals != null || player.assists != null || player.avgRating != null
  if (!hasStats) return null

  const mvC = getMvColor(player.avgRating)

  return (
    <div className="flex items-center gap-1.5 text-sm font-mono text-gray-500">
      {player.appearances != null && <span>P:{player.appearances}</span>}
      {player.goals != null && player.goals > 0 && <span>G:{player.goals}</span>}
      {player.assists != null && player.assists > 0 && <span>A:{player.assists}</span>}
      {player.avgRating != null && <span className={mvC.text}>{player.avgRating}</span>}
    </div>
  )
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
  disabled = false,
}: NominationPanelProps) {
  const [focalPlayer, setFocalPlayer] = useState<Player | null>(null)
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  const [selectedRole, setSelectedRole] = useState<string>(
    isPrimoMercato && marketProgress?.currentRole ? marketProgress.currentRole : 'TUTTI'
  )

  // Sync selectedRole when marketProgress.currentRole changes (new auction phase)
  useEffect(() => {
    if (isPrimoMercato && marketProgress?.currentRole) {
      setSelectedRole(marketProgress.currentRole)
    }
  }, [isPrimoMercato, marketProgress?.currentRole])

  // Filter players by selected role tab (local)
  const filteredPlayers = useMemo(() => {
    if (selectedRole === 'TUTTI') return players
    return players.filter(p => p.position === selectedRole)
  }, [players, selectedRole])

  const handlePlayerClick = (player: Player) => {
    setFocalPlayer(player)
  }

  const handleNominate = () => {
    if (focalPlayer && !disabled) {
      onNominatePlayer(focalPlayer.id)
      setFocalPlayer(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
          RICERCA & NOMINA
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          {disabled ? 'Attendi il tuo turno per nominare.' : 'Seleziona il prossimo giocatore da portare sul palco.'}
        </p>
      </div>

      {/* Row 1: Role Tabs + Search Input inline */}
      <div className="flex items-center gap-2 mb-2">
        {/* Role tabs */}
        <div className="flex gap-1 flex-shrink-0">
          {ALL_ROLE_TABS.map(role => {
            const isActive = selectedRole === role
            const isCurrentAuctionRole = isPrimoMercato && marketProgress?.currentRole === role
            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`relative text-center px-3 py-1.5 rounded-lg text-sms font-bold border transition-all ${
                  isActive
                    ? role === 'TUTTI'
                      ? 'bg-white/10 text-white border-white/30'
                      : POSITION_FILTER_COLORS[role as keyof typeof POSITION_FILTER_COLORS] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    : 'bg-slate-800/40 text-gray-500 border-white/5 hover:border-white/15'
                }`}
              >
                {role === 'TUTTI' ? 'TUTTI' : (POSITION_NAMES[role as keyof typeof POSITION_NAMES] || role).slice(0, 3).toUpperCase()}
                {isCurrentAuctionRole && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent-500 animate-pulse border-2 border-slate-900" />
                )}
              </button>
            )
          })}
        </div>

        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Nome giocatore, squadra..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full bg-slate-800/60 backdrop-blur border border-white/10 text-white rounded-lg pl-8 pr-3 py-1.5 text-sms placeholder-gray-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 focus:outline-none transition-colors"
          />
        </div>

        {/* View mode toggle (desktop only) */}
        <div className="hidden lg:flex gap-0.5 flex-shrink-0 bg-slate-800/40 rounded-lg p-0.5 border border-white/5">
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'card'
                ? 'bg-white/10 text-white border border-white/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
            title="Vista card"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'table'
                ? 'bg-white/10 text-white border border-white/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
            title="Vista tabella"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <rect x="1" y="2" width="14" height="2" rx="0.5" />
              <rect x="1" y="7" width="14" height="2" rx="0.5" />
              <rect x="1" y="12" width="14" height="2" rx="0.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Row 2: Team logos horizontal strip */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
        {/* "All" button */}
        <button
          onClick={() => onTeamChange('')}
          className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-sm font-bold border transition-all ${
            !selectedTeam
              ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
              : 'bg-slate-800/40 text-gray-500 border-white/5 hover:border-white/15'
          }`}
        >
          TUTTE
        </button>
        {availableTeams.map(team => (
          <button
            key={team.name}
            onClick={() => onTeamChange(selectedTeam === team.name ? '' : team.name)}
            className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
              selectedTeam === team.name
                ? 'bg-white/15 border-sky-500/50 ring-1 ring-sky-500/30'
                : 'bg-slate-800/30 border-white/5 hover:border-white/20 opacity-60 hover:opacity-100'
            }`}
            title={`${team.name} (${team.playerCount})`}
          >
            <img src={getTeamLogo(team.name)} alt={team.name} className="w-5 h-5 object-contain" />
          </button>
        ))}
      </div>

      {/* Focal Card */}
      {focalPlayer && (() => {
        const focalPhotoUrl = getPlayerPhotoUrl(focalPlayer.apiFootballId)
        const focalPosGradient = POSITION_GRADIENTS[focalPlayer.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'
        const focalAgeBadge = getAgeBadge(focalPlayer.age)
        const hasDetailedStats = focalPlayer.appearances != null || focalPlayer.goals != null || focalPlayer.assists != null || focalPlayer.avgRating != null
        return (
          <div className="mb-4 rounded-xl border border-sky-500/30 bg-slate-800/60 backdrop-blur overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-4">
                {/* Player photo large */}
                {focalPhotoUrl ? (
                  <img
                    src={focalPhotoUrl}
                    alt={focalPlayer.name}
                    className="w-20 h-20 rounded-xl object-cover bg-slate-700 flex-shrink-0"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : null}
                <span className={`w-20 h-20 rounded-xl bg-gradient-to-br ${focalPosGradient} flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 ${focalPhotoUrl ? 'hidden' : ''}`}>
                  {focalPlayer.position}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black text-white uppercase truncate">{focalPlayer.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                      <img src={getTeamLogo(focalPlayer.team)} alt={focalPlayer.team} className="w-3.5 h-3.5 object-contain" />
                    </div>
                    <span className="text-sm text-gray-400">{focalPlayer.team}</span>
                    <span className="text-gray-400">·</span>
                    <span className={`text-sms font-bold px-2.5 py-0.5 rounded-full border ${POSITION_FILTER_COLORS[focalPlayer.position as keyof typeof POSITION_FILTER_COLORS] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                      {POSITION_NAMES[focalPlayer.position as keyof typeof POSITION_NAMES] || focalPlayer.position}
                    </span>
                    {focalPlayer.age != null && (
                      <>
                        <span className="text-gray-400">·</span>
                        <span className={`text-sms font-bold px-2 py-0.5 rounded border ${focalAgeBadge.bg} ${focalAgeBadge.text}`}>
                          {focalPlayer.age} anni
                        </span>
                      </>
                    )}
                  </div>

                  {/* Quotation */}
                  {focalPlayer.quotation > 0 && (
                    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-accent-500/15 rounded-lg border border-accent-500/25">
                      <span className="text-sm text-gray-400 uppercase tracking-wider">Quot.</span>
                      <span className="text-lg font-black font-mono text-accent-400">{focalPlayer.quotation}</span>
                    </div>
                  )}
                </div>

                {/* Close */}
                <button
                  onClick={() => setFocalPlayer(null)}
                  className="text-gray-500 hover:text-white p-1 flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Inline Stats Boxes */}
              {hasDetailedStats && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {focalPlayer.appearances != null && (
                    <div className="bg-slate-700/40 rounded-lg p-2 text-center">
                      <p className="text-sm text-gray-500 uppercase font-semibold">Presenze</p>
                      <p className="text-sm font-mono font-bold text-white">{focalPlayer.appearances}</p>
                    </div>
                  )}
                  {focalPlayer.goals != null && (
                    <div className="bg-slate-700/40 rounded-lg p-2 text-center">
                      <p className="text-sm text-gray-500 uppercase font-semibold">Gol</p>
                      <p className="text-sm font-mono font-bold text-white">{focalPlayer.goals}</p>
                    </div>
                  )}
                  {focalPlayer.assists != null && (
                    <div className="bg-slate-700/40 rounded-lg p-2 text-center">
                      <p className="text-sm text-gray-500 uppercase font-semibold">Assist</p>
                      <p className="text-sm font-mono font-bold text-white">{focalPlayer.assists}</p>
                    </div>
                  )}
                  {focalPlayer.avgRating != null && (() => {
                    const mvC = getMvColor(focalPlayer.avgRating)
                    return (
                      <div className={`${mvC.bg} rounded-lg p-2 text-center ${mvC.border}`}>
                        <p className={`text-sm uppercase font-semibold ${mvC.text}`}>MV</p>
                        <p className={`text-sm font-mono font-bold ${mvC.text}`}>{focalPlayer.avgRating}</p>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex border-t border-white/10">
              {!disabled && (
                <button
                  onClick={handleNominate}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-base font-black text-white hover:from-teal-400 hover:to-emerald-500 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  PORTA IN ASTA
                </button>
              )}
              <button
                onClick={() => setFocalPlayer(null)}
                className="flex-1 px-4 py-3 bg-slate-700/40 text-sm font-semibold text-gray-400 hover:bg-slate-700/60 hover:text-white transition-all flex items-center justify-center gap-1.5 border-l border-white/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Continua Ricerca
              </button>
            </div>
          </div>
        )
      })()}

      {/* Player Grid / Table */}
      <div className="max-h-[45vh] overflow-y-auto">
        {filteredPlayers.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Nessun giocatore</p>
        ) : (
          <>
            {/* Card Grid - always on mobile, conditional on desktop */}
            <div className={`grid grid-cols-2 gap-2 ${viewMode === 'table' ? 'lg:hidden' : 'lg:grid-cols-3'}`}>
              {filteredPlayers.slice(0, 50).map(player => {
                const photoUrl = getPlayerPhotoUrl(player.apiFootballId)
                const posGradient = POSITION_GRADIENTS[player.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'
                const isSelected = focalPlayer?.id === player.id
                const ageBadge = getAgeBadge(player.age)
                return (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerClick(player)}
                    className={`relative rounded-xl p-3 text-left transition-all border group ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/40 ring-1 ring-sky-500/30'
                        : 'bg-slate-800/40 border-white/5 hover:border-sky-500/40 hover:scale-[1.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Photo / Position fallback */}
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={player.name}
                          className="w-12 h-12 rounded-xl object-cover bg-slate-700 flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            target.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <span className={`w-12 h-12 rounded-xl bg-gradient-to-br ${posGradient} flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${photoUrl ? 'hidden' : ''}`}>
                        {player.position}
                      </span>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white text-sm truncate leading-tight">{player.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-4 h-4 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                            <img src={getTeamLogo(player.team)} alt={player.team} className="w-3 h-3 object-contain" />
                          </div>
                          <span className="text-sm text-gray-400 truncate">{player.team}</span>
                        </div>
                        {/* Age badge + mini stats */}
                        <div className="flex items-center gap-1.5 mt-1">
                          {player.age != null && (
                            <span className={`text-sm font-bold px-1.5 py-0.5 rounded border ${ageBadge.bg} ${ageBadge.text}`}>
                              {player.age}a
                            </span>
                          )}
                          <MiniStats player={player} />
                        </div>
                      </div>

                      {/* Quotation */}
                      {player.quotation > 0 && (
                        <span className="text-sm font-mono font-bold text-accent-400 flex-shrink-0">{player.quotation}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Table View - desktop only when table mode selected */}
            {viewMode === 'table' && (
              <table className="hidden lg:table w-full">
                <thead>
                  <tr className="bg-slate-800/50 text-sm text-gray-500 uppercase tracking-wider font-semibold">
                    <th className="py-2 px-3 text-left w-10"></th>
                    <th className="py-2 px-3 text-left">Nome</th>
                    <th className="py-2 px-3 text-left">Squadra</th>
                    <th className="py-2 px-3 text-center">Eta</th>
                    <th className="py-2 px-3 text-center">P</th>
                    <th className="py-2 px-3 text-center">G</th>
                    <th className="py-2 px-3 text-center">A</th>
                    <th className="py-2 px-3 text-center">MV</th>
                    <th className="py-2 px-3 text-right">Quot</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.slice(0, 50).map(player => {
                    const photoUrl = getPlayerPhotoUrl(player.apiFootballId)
                    const posGradient = POSITION_GRADIENTS[player.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'
                    const isSelected = focalPlayer?.id === player.id
                    const ageBadge = getAgeBadge(player.age)
                    const mvC = getMvColor(player.avgRating)
                    return (
                      <tr
                        key={player.id}
                        onClick={() => handlePlayerClick(player)}
                        className={`border-b border-white/5 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sky-500/10 border-sky-500/30'
                            : 'hover:bg-slate-800/30'
                        }`}
                      >
                        {/* Photo + Badge */}
                        <td className="py-2 px-3">
                          <div className="relative w-10 h-10">
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={player.name}
                                className="w-10 h-10 rounded-full object-cover bg-slate-700"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  target.nextElementSibling?.classList.remove('hidden')
                                }}
                              />
                            ) : null}
                            <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${posGradient} flex items-center justify-center text-xs font-bold text-white ${photoUrl ? 'hidden' : ''}`}>
                              {player.position}
                            </span>
                            <span className={`absolute -bottom-0.5 -right-0.5 text-[10px] font-bold px-1 rounded bg-gradient-to-br ${posGradient} text-white leading-tight`}>
                              {player.position}
                            </span>
                          </div>
                        </td>
                        {/* Nome */}
                        <td className="py-2 px-3">
                          <span className="font-medium text-white">{player.name}</span>
                        </td>
                        {/* Squadra */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                              <img src={getTeamLogo(player.team)} alt={player.team} className="w-3 h-3 object-contain" />
                            </div>
                            <span className="text-sm text-gray-400">{player.team}</span>
                          </div>
                        </td>
                        {/* Eta */}
                        <td className="py-2 px-3 text-center">
                          {player.age != null ? (
                            <span className={`text-sm font-bold ${ageBadge.text}`}>{player.age}</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        {/* Presenze */}
                        <td className="py-2 px-3 text-center">
                          <span className="text-sm text-gray-400 font-mono">{player.appearances ?? '-'}</span>
                        </td>
                        {/* Gol */}
                        <td className="py-2 px-3 text-center">
                          <span className="text-sm text-gray-400 font-mono">{player.goals ?? '-'}</span>
                        </td>
                        {/* Assist */}
                        <td className="py-2 px-3 text-center">
                          <span className="text-sm text-gray-400 font-mono">{player.assists ?? '-'}</span>
                        </td>
                        {/* MV */}
                        <td className="py-2 px-3 text-center">
                          <span className={`text-sm font-mono font-bold ${mvC.text}`}>
                            {player.avgRating ?? '-'}
                          </span>
                        </td>
                        {/* Quotazione */}
                        <td className="py-2 px-3 text-right">
                          <span className="font-mono text-accent-400">{player.quotation > 0 ? player.quotation : '-'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        isOpen={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        player={focalPlayer ? {
          name: focalPlayer.name,
          team: focalPlayer.team,
          position: focalPlayer.position,
          quotation: focalPlayer.quotation,
          age: focalPlayer.age,
          apiFootballId: focalPlayer.apiFootballId,
        } as PlayerInfo : null}
      />
    </div>
  )
}
