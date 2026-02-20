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

function AgeBadge({ age, className = '' }: { age: number; className?: string }) {
  const colors =
    age <= 23 ? 'bg-green-500/20 text-green-400' :
    age <= 28 ? 'bg-surface-50/20 text-gray-300' :
    age <= 31 ? 'bg-warning-500/20 text-warning-400' :
    'bg-danger-500/20 text-danger-400'
  return (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${colors} ${className}`}>
      {age}a
    </span>
  )
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
  // D5: Compare mode
  compareMode?: boolean
  isCompareSelected?: boolean
  onToggleCompare?: () => void
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
  compareMode,
  isCompareSelected,
  onToggleCompare,
}: BoardRowProps) {
  const wasStolen = !!player.stolenByUsername
  const isMyPlayer = player.memberId === myMemberId
  const isWatchlisted = !isMyPlayer && !isPassed && pref?.isWatchlist
  const isAutoSkip = !isMyPlayer && !isPassed && pref?.isAutoPass

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onPlayerStatsClick({
        name: player.playerName,
        team: player.playerTeam,
        position: player.playerPosition,
        quotation: player.playerQuotation,
        age: player.playerAge,
        apiFootballId: player.playerApiFootballId,
        computedStats: player.playerComputedStats,
      })
    } else if (e.key === ' ' && canEditPreferences && !isMyPlayer && !isPassed) {
      e.preventDefault()
      onOpenPrefsModal({ ...player, preference: pref || null })
    }
  }

  const durationColor =
    player.contractDuration === 1 ? 'text-danger-400' :
    player.contractDuration === 2 ? 'text-warning-400' :
    player.contractDuration === 3 ? 'text-blue-400' :
    'text-secondary-400'

  return (
    <div
      ref={isCurrent ? currentPlayerRef as React.RefObject<HTMLDivElement> : null}
      tabIndex={0}
      role="listitem"
      aria-label={`${player.playerName}, ${player.playerPosition}, ${player.playerTeam}${isCurrent ? ', sul piatto' : ''}${wasStolen ? `, rubato da ${player.stolenByUsername ?? ''}` : ''}`}
      onKeyDown={handleKeyDown}
      className={`${isCurrent ? 'p-3 md:p-4' : 'px-2.5 py-3 md:p-3'} rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-400/70 ${
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
      <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-0 md:flex-1 md:min-w-0">
        {/* D5: Compare checkbox */}
        {compareMode && !isPassed && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCompare?.(); }}
            className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
              isCompareSelected
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-gray-500 hover:border-primary-400'
            }`}
            aria-label={isCompareSelected ? 'Rimuovi dal confronto' : 'Aggiungi al confronto'}
          >
            {isCompareSelected && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}
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
        <div className="hidden md:block w-6 h-6 bg-white rounded p-0.5 flex-shrink-0">
          <TeamLogo team={player.playerTeam} />
        </div>
        {/* Position badge: always on desktop; on mobile only when photo exists (fallback circle already shows position) */}
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''} ${!player.playerApiFootballId ? 'hidden md:inline-flex' : ''}`}>
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
          className={`font-semibold truncate text-left ${isCurrent ? 'text-white font-bold text-base' : isPassed ? 'text-gray-500' : 'text-white hover:text-primary-300'}`}
          title="Clicca per vedere statistiche"
        >
          {player.playerName}
        </button>
        {/* Mobile inline indicators */}
        {isPassed && !wasStolen && (
          <span className="md:hidden text-[10px] text-secondary-500 flex-shrink-0">✓</span>
        )}
        {isMyPlayer && (
          <span className="md:hidden text-[10px] text-gray-500 flex-shrink-0">Mio</span>
        )}
        {/* Mobile: rubata price right-aligned */}
        <span className={`md:hidden ml-auto font-black text-base flex-shrink-0 ${
          isCurrent ? 'text-primary-400' : isPassed ? 'text-gray-500' : 'text-warning-400'
        }`}>
          {player.rubataPrice}M
        </span>
        {isCurrent && (
          <span className="hidden sm:inline text-xs bg-primary-500 text-white px-2.5 py-0.5 rounded-full shrink-0 font-medium">
            SUL PIATTO
          </span>
        )}
        {/* Desktop: owner inline */}
        <span className="hidden md:inline text-xs text-gray-400 ml-1 truncate flex-shrink-0">
          di <span className={isPassed && wasStolen ? 'line-through' : ''}>{player.ownerUsername}</span>
        </span>
        {/* Desktop: age badge */}
        {player.playerAge != null && (
          <AgeBadge age={player.playerAge} className="hidden md:inline-flex ml-1 flex-shrink-0" />
        )}
      </div>

      {/* Mobile: compact info — owner + age + contract inline */}
      <div className="md:hidden flex items-center gap-1 text-[11px] mt-0.5 ml-8 flex-wrap">
        <span className="text-gray-500">
          di <span className={isPassed && wasStolen ? 'line-through text-gray-500' : 'text-gray-400'}>{player.ownerUsername}</span>
        </span>
        {player.playerAge != null && (
          <>
            <span className="text-gray-600">·</span>
            <AgeBadge age={player.playerAge} />
          </>
        )}
        <span className="text-gray-600">·</span>
        <span className={`font-bold ${isPassed ? 'text-gray-500' : 'text-accent-400'}`}>{player.contractSalary}M</span>
        <span className="text-gray-600">·</span>
        <span className={`font-bold ${isPassed ? 'text-gray-500' : durationColor}`}>{player.contractDuration}s</span>
        <span className="text-gray-600">·</span>
        <span className={`font-bold ${isPassed ? 'text-gray-500' : 'text-purple-400'}`}>{player.contractClause}M</span>
      </div>

      {/* Stolen indicator */}
      {wasStolen && (
        <div className="mb-1 md:mb-0 ml-8 md:ml-0 flex items-center gap-1 text-sm flex-shrink-0">
          <span className="text-danger-400">🎯</span>
          <span className="text-danger-400 font-bold">{player.stolenByUsername}</span>
          {player.stolenPrice && player.stolenPrice > player.rubataPrice && (
            <span className="text-danger-500 text-xs">({player.stolenPrice}M)</span>
          )}
        </div>
      )}

      {/* Contract details — single row, 4-col */}
      <div className={`hidden md:grid grid-cols-4 gap-x-2 rounded-lg p-2 w-[280px] flex-shrink-0 ${isPassed ? 'bg-surface-50/5' : 'bg-surface-300/40'}`}>
        <div className="text-center">
          <div className="text-[8px] md:text-[11px] text-gray-600 uppercase leading-tight tracking-wide">
            <span className="md:hidden">Ing.</span><span className="hidden md:inline">Ingaggio</span>
          </div>
          <div className={`font-bold text-sm md:text-sm ${isPassed ? 'text-gray-500' : 'text-accent-400'}`}>
            {player.contractSalary}M
          </div>
        </div>
        <div className="text-center">
          <div className="text-[8px] md:text-[11px] text-gray-600 uppercase leading-tight tracking-wide">
            <span className="md:hidden">Dur.</span><span className="hidden md:inline">Durata</span>
          </div>
          <div className={`font-bold text-sm md:text-sm ${
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
          <div className="text-[8px] md:text-[11px] text-gray-600 uppercase leading-tight tracking-wide">
            <span className="md:hidden">Claus.</span><span className="hidden md:inline">Clausola</span>
          </div>
          <div className={`font-bold text-sm md:text-sm ${isPassed ? 'text-gray-500' : 'text-purple-400'}`}>
            {player.contractClause}M
          </div>
        </div>
        <div className="text-center">
          <div className="text-[8px] md:text-[11px] text-gray-600 uppercase leading-tight tracking-wide">
            <span className="md:hidden">Rub.</span><span className="hidden md:inline">Rubata</span>
          </div>
          <div className={`font-black ${isCurrent ? 'text-base md:text-lg text-primary-400' : isPassed ? 'text-sm text-gray-500' : 'text-sm text-warning-400'}`}>
            {player.rubataPrice}M
          </div>
        </div>
      </div>

      {/* Inline VOGLIO RUBARE button — only for current player during OFFERING */}
      {isCurrent && rubataState === 'OFFERING' && canMakeOffer && (
        <div className="mt-1 md:mt-0 md:flex-shrink-0">
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

      {/* Passed + not stolen — hidden on mobile (shown inline in header) */}
      {isPassed && !wasStolen && (
        <div className="hidden md:block md:mt-0 text-center text-xs text-secondary-500 md:flex-shrink-0">
          ✓ Non rubato
        </div>
      )}

      {/* Strategy */}
      {(() => {
        if (isMyPlayer) return <div className="hidden md:block md:mt-0 md:ml-auto text-center text-gray-500 text-xs md:flex-shrink-0">Mio</div>
        if (isPassed) return null
        const hasStrategy = pref?.priority || pref?.maxBid || pref?.notes || pref?.isWatchlist || pref?.isAutoPass
        return (
          <div className={`${hasStrategy ? 'mt-0.5' : 'hidden md:block'} md:mt-0 md:ml-auto md:w-[140px] md:flex-shrink-0`}>
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
