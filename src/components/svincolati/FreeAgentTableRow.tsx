import { memo } from 'react'
import { Settings } from 'lucide-react'
import { PlayerPhoto } from '@/components/players/PlayerPhoto'
import { PlayerName } from '@/components/players/PlayerName'
import { getAgeColor, NOT_DISPONIBILE } from '@/utils/stat-format'
import { getTeamLogo } from '../../utils/teamLogos'
import type { Player, SvincolatiPreference } from '../../types/svincolati.types'

export interface FreeAgentTableRowProps {
  player: Player
  leagueId: string
  nominable: boolean
  onNominate: (playerId: string) => void
  preference: SvincolatiPreference | undefined
  canEditPreferences: boolean
  onOpenPrefsModal: (player: Player & { preference: SvincolatiPreference | null }) => void
}

function statCell(value: number | null | undefined, decimals = 0): string {
  if (value == null) return NOT_DISPONIBILE
  return decimals > 0 ? value.toFixed(decimals) : String(value)
}

export const FreeAgentTableRow = memo(function FreeAgentTableRow({
  player, leagueId, nominable, onNominate, preference, canEditPreferences, onOpenPrefsModal,
}: FreeAgentTableRowProps) {
  const stats = player.computedStats

  const handleNominate = () => { if (nominable) onNominate(player.id) }
  const handleOpenPrefs = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    onOpenPrefsModal({ ...player, preference: preference || null })
  }

  const hasPreference = !!preference && (preference.isWatchlist || preference.isAutoPass || !!preference.priority || !!preference.maxBid)

  return (
    <div
      role={nominable ? 'button' : undefined}
      tabIndex={nominable ? 0 : undefined}
      onClick={nominable ? handleNominate : undefined}
      onKeyDown={nominable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNominate(); } } : undefined}
      className={`border-b border-surface-50/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/70 ${
        nominable ? 'hover:bg-hover cursor-pointer' : 'cursor-default'
      }`}
    >
      {/* ===== Desktop: riga a griglia ===== */}
      <div className="hidden lg:grid svincolati-pool-grid items-center px-3 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} size="sm" showRoleBadge />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <PlayerName
                player={{ name: player.name, team: player.team, position: player.position, quotation: player.quotation, age: player.age }}
                leagueId={leagueId}
                leaguePlayerId={player.id}
                truncate
                className="font-display font-bold text-sm text-white hover:text-primary-300 block text-left"
              />
              {preference?.isWatchlist && <span className="text-[9px] font-mono font-bold text-primary-400 flex-shrink-0" title="Watchlist">WL</span>}
              {preference?.isAutoPass && <span className="text-[9px] font-mono font-bold text-gray-500 flex-shrink-0" title="Auto-skip">SKIP</span>}
              {!!preference?.priority && <span className="text-accent-400 text-[10px] flex-shrink-0" title={`Priorità ${preference.priority}`}>{'★'.repeat(preference.priority)}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px] text-gray-500 truncate">
              <span className="w-3.5 h-3.5 bg-white rounded p-px flex-shrink-0 inline-flex" aria-hidden="true">
                <img src={getTeamLogo(player.team)} alt="" className="w-full h-full object-contain" />
              </span>
              <span className="truncate">{player.team}</span>
            </div>
          </div>
        </div>

        <span className={`stat-number text-sm text-center ${getAgeColor(player.age)}`}>{player.age ?? NOT_DISPONIBILE}</span>
        <span className="stat-number text-sm text-white text-center">{player.quotation}</span>
        <span className="stat-number text-sm text-gray-300 text-center">{statCell(stats?.appearances)}</span>
        <span className="stat-number text-sm text-gray-300 text-center">{statCell(stats?.avgRating, 2)}</span>
        <span className="stat-number text-sm text-gray-300 text-center">{statCell(stats?.totalGoals)}</span>
        <span className="stat-number text-sm text-gray-300 text-center">{statCell(stats?.totalAssists)}</span>

        <div className="flex items-center justify-center gap-1">
          {nominable && (
            <span className="font-mono text-[9.5px] font-bold text-secondary-400 border border-secondary-500/40 bg-secondary-500/[0.08] rounded-md px-2 py-1 flex-shrink-0">
              Chiama
            </span>
          )}
          {canEditPreferences && (
            <button
              type="button"
              onClick={handleOpenPrefs}
              className={`p-1 rounded flex-shrink-0 transition-colors ${hasPreference ? 'text-primary-400 hover:text-primary-300 hover:bg-primary-500/15' : 'text-gray-500 hover:text-gray-300 hover:bg-surface-100'}`}
              title={hasPreference ? 'Modifica strategia' : 'Imposta strategia'}
            >
              <Settings size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ===== Mobile: 2 righe compatte ===== */}
      <div className="lg:hidden px-2.5 py-2 md:px-3">
        <div className="flex items-center gap-2 min-w-0">
          <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} size="xs" showRoleBadge />
          <PlayerName
            player={{ name: player.name, team: player.team, position: player.position, quotation: player.quotation, age: player.age }}
            leagueId={leagueId}
            leaguePlayerId={player.id}
            truncate
            className="font-display font-bold text-sm text-white block text-left min-w-0 flex-1"
          />
          {nominable && (
            <span className="font-mono text-[9.5px] font-bold text-secondary-400 border border-secondary-500/40 bg-secondary-500/[0.08] rounded-md px-2 py-1 flex-shrink-0">
              Chiama
            </span>
          )}
          {canEditPreferences && (
            <button
              type="button"
              onClick={handleOpenPrefs}
              className={`p-1 rounded flex-shrink-0 transition-colors ${hasPreference ? 'text-primary-400' : 'text-gray-500'}`}
              title={hasPreference ? 'Modifica strategia' : 'Imposta strategia'}
            >
              <Settings size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 ml-9 min-w-0 text-xs text-gray-500 flex-wrap">
          <span className="truncate">{player.team}</span>
          <span className="text-gray-600" aria-hidden="true">·</span>
          <span className={getAgeColor(player.age)}>{player.age != null ? `${player.age} anni` : NOT_DISPONIBILE}</span>
          <span className="text-gray-600" aria-hidden="true">·</span>
          <span>Quot. {player.quotation}</span>
          {stats && (
            <>
              <span className="text-gray-600" aria-hidden="true">·</span>
              <span>{statCell(stats.appearances)} pres.</span>
              <span className="text-gray-600" aria-hidden="true">·</span>
              <span>MV {statCell(stats.avgRating, 2)}</span>
              <span className="text-gray-600" aria-hidden="true">·</span>
              <span>{statCell(stats.totalGoals)}G {statCell(stats.totalAssists)}A</span>
            </>
          )}
          {preference?.priority ? <span className="text-accent-400 text-[10px]" title={`Priorità ${preference.priority}`}>{'★'.repeat(preference.priority)}</span> : null}
          {preference?.maxBid != null && <span className="text-primary-400 text-[10px] font-mono" title={`Max ${preference.maxBid}M`}>Max: {preference.maxBid}M</span>}
        </div>
      </div>
    </div>
  )
})
