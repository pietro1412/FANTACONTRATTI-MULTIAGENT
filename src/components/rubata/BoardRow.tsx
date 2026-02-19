import { memo } from 'react'
import { Button } from '../ui/Button'
import { TeamLogo } from './TeamLogo'
import { POSITION_COLORS } from '../../types/rubata.types'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import type { BoardPlayer, RubataPreference, RubataStateType } from '../../types/rubata.types'
import type { ComputedSeasonStats } from '../PlayerStatsModal'

interface PlayerStatsInfo {
  name: string
  team: string
  position: string
  quotation?: number
  age?: number | null
  apiFootballId?: number | null
  computedStats?: ComputedSeasonStats | null
}

export interface BoardRowProps {
  player: BoardPlayer
  globalIndex: number
  isCurrent: boolean
  isPassed: boolean
  rubataState: RubataStateType
  canMakeOffer: boolean
  isSubmitting: boolean
  myMemberId: string | undefined
  preference: RubataPreference | undefined
  canEditPreferences: boolean
  onMakeOffer: () => void
  onOpenPrefsModal: (player: BoardPlayer & { preference: RubataPreference | null }) => void
  onPlayerStatsClick: (info: PlayerStatsInfo) => void
  currentPlayerRef?: React.RefObject<HTMLDivElement>
}

export const BoardRow = memo(function BoardRow({
  player,
  globalIndex,
  isCurrent,
  isPassed,
  rubataState,
  canMakeOffer,
  isSubmitting,
  myMemberId,
  preference: pref,
  canEditPreferences,
  onMakeOffer,
  onOpenPrefsModal,
  onPlayerStatsClick,
  currentPlayerRef,
}: BoardRowProps) {
  const wasStolen = !!player.stolenByUsername
  const isMyPlayer = player.memberId === myMemberId
  const isWatchlisted = !isMyPlayer && !isPassed && pref?.isWatchlist
  const isAutoSkip = !isMyPlayer && !isPassed && pref?.isAutoPass

  return (
    <div
      ref={isCurrent ? currentPlayerRef as React.RefObject<HTMLDivElement> : null}
      className={`${isCurrent ? 'p-4' : 'p-3'} rounded-lg border transition-all ${
        isCurrent
          ? 'bg-primary-500/30 border-primary-400 ring-2 ring-primary-400/50 shadow-lg animate-[pulse_2s_ease-in-out_infinite]'
          : isPassed
          ? wasStolen
            ? 'bg-danger-500/10 border-danger-500/30'
            : 'bg-surface-50/5 border-surface-50/10 opacity-60'
          : isWatchlisted
          ? 'bg-indigo-500/10 border-indigo-500/30'
          : isAutoSkip
          ? 'bg-surface-300/50 border-surface-50/10 opacity-50'
          : 'bg-surface-300 border-surface-50/20'
      } md:flex md:items-center md:gap-4`}
      style={isCurrent ? { animationDuration: '2s' } : undefined}
    >
      {/* Player header */}
      <div className="flex items-center gap-2 mb-2 md:mb-0 md:flex-1 md:min-w-0">
        {isCurrent ? (
          <span className="inline-flex items-center justify-center w-7 h-7 bg-primary-500 text-white rounded-full text-xs font-bold animate-pulse flex-shrink-0">
            {globalIndex + 1}
          </span>
        ) : (
          <span className="text-xs font-mono w-6 text-center text-gray-500 flex-shrink-0">
            #{globalIndex + 1}
          </span>
        )}
        {player.playerApiFootballId ? (
          <img
            src={getPlayerPhotoUrl(player.playerApiFootballId)}
            alt={player.playerName}
            className={`${isCurrent ? 'w-10 h-10 border-2 border-primary-500' : 'w-8 h-8'} rounded-full object-cover bg-surface-300 flex-shrink-0`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className={`${isCurrent ? 'w-10 h-10' : 'w-8 h-8'} rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
            {player.playerPosition}
          </div>
        )}
        <div className="w-6 h-6 bg-white rounded p-0.5 flex-shrink-0">
          <TeamLogo team={player.playerTeam} />
        </div>
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
          {player.playerPosition}
        </span>
        <button
          type="button"
          onClick={() => { onPlayerStatsClick({
            name: player.playerName,
            team: player.playerTeam,
            position: player.playerPosition,
            quotation: player.playerQuotation,
            age: player.playerAge,
            apiFootballId: player.playerApiFootballId,
            computedStats: player.playerComputedStats,
          }); }}
          className={`font-medium truncate text-left ${isCurrent ? 'text-white font-bold text-base' : isPassed ? 'text-gray-500' : 'text-gray-300 hover:text-white'}`}
          title="Clicca per vedere statistiche"
        >
          {player.playerName}
        </button>
        {isCurrent && (
          <span className="text-[10px] bg-primary-500 text-white px-2 py-0.5 rounded-full shrink-0">
            SUL PIATTO
          </span>
        )}
        {/* Desktop: owner inline */}
        <span className="hidden md:inline text-xs text-gray-400 ml-1 truncate flex-shrink-0">
          di <span className={isPassed && wasStolen ? 'line-through' : ''}>{player.ownerUsername}</span>
        </span>
        {/* Desktop: age badge */}
        {player.playerAge != null && (
          <span className={`hidden md:inline-flex text-[11px] font-bold px-1.5 py-0.5 rounded ml-1 flex-shrink-0 ${
            player.playerAge <= 23 ? 'bg-green-500/20 text-green-400' :
            player.playerAge <= 28 ? 'bg-surface-50/20 text-gray-300' :
            player.playerAge <= 31 ? 'bg-warning-500/20 text-warning-400' :
            'bg-danger-500/20 text-danger-400'
          }`}>
            {player.playerAge}a
          </span>
        )}
      </div>

      {/* Mobile: Age badge + Owner */}
      <div className="md:hidden text-xs text-gray-500 mb-2 pl-6 flex items-center gap-1.5 flex-wrap">
        {player.playerAge != null && (
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
            player.playerAge <= 23 ? 'bg-green-500/20 text-green-400' :
            player.playerAge <= 28 ? 'bg-surface-50/20 text-gray-300' :
            player.playerAge <= 31 ? 'bg-warning-500/20 text-warning-400' :
            'bg-danger-500/20 text-danger-400'
          }`}>
            {player.playerAge}a
          </span>
        )}
        <span>
          di <span className={isPassed && wasStolen ? 'text-gray-500 line-through' : 'text-gray-400'}>{player.ownerUsername}</span>
          {player.ownerTeamName && <span className="text-gray-500"> ({player.ownerTeamName})</span>}
        </span>
      </div>

      {/* Stolen indicator */}
      {wasStolen && (
        <div className="mb-2 md:mb-0 ml-6 md:ml-0 flex items-center gap-1 text-sm flex-shrink-0">
          <span className="text-danger-400">🎯</span>
          <span className="text-danger-400 font-bold">{player.stolenByUsername}</span>
          {player.stolenPrice && player.stolenPrice > player.rubataPrice && (
            <span className="text-danger-500 text-xs">({player.stolenPrice}M)</span>
          )}
        </div>
      )}

      {/* Contract details grid */}
      <div className={`grid grid-cols-4 gap-2 rounded p-2 md:w-[280px] md:flex-shrink-0 ${isPassed ? 'bg-surface-50/5' : 'bg-surface-50/10'}`}>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase">Ingaggio</div>
          <div className={`font-medium text-sm ${isPassed ? 'text-gray-500' : 'text-accent-400'}`}>
            {player.contractSalary}M
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase">Durata</div>
          <div className={`font-medium text-sm ${
            isPassed ? 'text-gray-500' :
            player.contractDuration === 1 ? 'text-danger-400' :
            player.contractDuration === 2 ? 'text-warning-400' :
            player.contractDuration === 3 ? 'text-blue-400' :
            'text-secondary-400'
          }`}>
            {player.contractDuration}s
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase">Clausola</div>
          <div className={`font-medium text-sm ${isPassed ? 'text-gray-500' : 'text-gray-400'}`}>
            {player.contractClause}M
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase">Rubata</div>
          <div className={`font-bold ${isCurrent ? 'text-lg text-primary-400' : isPassed ? 'text-sm text-gray-500' : 'text-sm text-warning-400'}`}>
            {player.rubataPrice}M
          </div>
        </div>
      </div>

      {/* Inline VOGLIO RUBARE button — only for current player during OFFERING */}
      {isCurrent && rubataState === 'OFFERING' && canMakeOffer && (
        <div className="mt-2 md:mt-0 md:flex-shrink-0">
          <Button
            onClick={onMakeOffer}
            disabled={isSubmitting}
            variant="accent"
            className="w-full md:w-auto text-sm py-2 px-4 whitespace-nowrap"
          >
            🎯 VOGLIO RUBARE! ({player.rubataPrice}M)
          </Button>
        </div>
      )}

      {/* Inline stats - desktop only, non-passed players */}
      {!isPassed && player.playerComputedStats && (
        <div className="hidden md:flex items-center gap-1.5 text-[11px] md:flex-shrink-0">
          {player.playerComputedStats.avgRating != null && (
            <span className={`font-bold ${
              player.playerComputedStats.avgRating >= 6.5 ? 'text-green-400' :
              player.playerComputedStats.avgRating >= 6.0 ? 'text-yellow-400' :
              'text-red-400'
            }`} title="Media voto">
              MV {player.playerComputedStats.avgRating.toFixed(2)}
            </span>
          )}
          {(player.playerPosition === 'A') && player.playerComputedStats.totalGoals > 0 && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400">{player.playerComputedStats.totalGoals}G</span>
            </>
          )}
          {(player.playerPosition === 'C' || player.playerPosition === 'A') && player.playerComputedStats.totalAssists > 0 && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400">{player.playerComputedStats.totalAssists}A</span>
            </>
          )}
        </div>
      )}

      {/* Passed + not stolen */}
      {isPassed && !wasStolen && (
        <div className="mt-2 md:mt-0 text-center text-xs text-secondary-500 md:flex-shrink-0">
          ✓ Non rubato
        </div>
      )}

      {/* Strategy */}
      {(() => {
        if (isMyPlayer) return <div className="mt-2 md:mt-0 md:ml-auto text-center text-gray-500 text-xs md:flex-shrink-0">Mio</div>
        if (isPassed) return null
        const hasStrategy = pref?.priority || pref?.maxBid || pref?.notes || pref?.isWatchlist || pref?.isAutoPass
        return (
          <div className="mt-2 pt-2 border-t border-surface-50/20 md:mt-0 md:pt-0 md:border-t-0 md:ml-auto md:w-[140px] md:flex-shrink-0">
            <div className="flex items-center justify-between md:justify-end gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {pref?.isWatchlist && (
                  <span className="text-indigo-400 text-xs" title="In watchlist">👁️</span>
                )}
                {pref?.isAutoPass && (
                  <span className="text-gray-400 text-xs" title="Auto-skip">⏭️</span>
                )}
                {pref?.priority && (
                  <span className="text-purple-400 text-xs" title={`Priorità ${pref.priority}`}>{'★'.repeat(pref.priority)}</span>
                )}
                {pref?.maxBid && (
                  <span className="text-blue-400 text-xs" title={`Max ${pref.maxBid}M`}>Max: {pref.maxBid}M</span>
                )}
                {pref?.notes && (
                  <span className="text-gray-400 text-xs" title={pref.notes} aria-label="Note strategia impostate">📝</span>
                )}
              </div>
              {canEditPreferences && (
                hasStrategy ? (
                  <button
                    type="button"
                    onClick={() => { onOpenPrefsModal({ ...player, preference: pref || null }); }}
                    className="px-2 py-1 rounded text-xs transition-all bg-indigo-500/30 text-indigo-400"
                    title="Modifica strategia"
                  >
                    ⚙️
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { onOpenPrefsModal({ ...player, preference: pref || null }); }}
                    className="px-2 py-1 rounded text-xs transition-all bg-surface-50/20 text-indigo-400/70 hover:bg-indigo-500/20 hover:text-indigo-400"
                    title="Imposta strategia"
                  >
                    + Strategia
                  </button>
                )
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
})
