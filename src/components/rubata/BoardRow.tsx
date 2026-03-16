import { memo } from 'react'
import { POSITION_COLORS } from '../../types/rubata.types'
import type { BoardPlayer, RubataPreference } from '../../types/rubata.types'
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
  myMemberId: string | undefined
  preference: RubataPreference | undefined
  canEditPreferences: boolean
  onOpenPrefsModal: (player: BoardPlayer & { preference: RubataPreference | null }) => void
  onPlayerStatsClick: (info: PlayerStatsInfo) => void
  currentPlayerRef?: React.RefObject<HTMLDivElement>
  // D5: Compare mode
  compareMode?: boolean
  isCompareSelected?: boolean
  onToggleCompare?: () => void
  // Manager group separator
  isNewOwnerGroup?: boolean
  // Expandable row (mobile density)
  isExpanded?: boolean
  onToggleExpand?: () => void
}

export const BoardRow = memo(function BoardRow({
  player,
  globalIndex,
  isCurrent,
  isPassed,
  myMemberId,
  preference: pref,
  canEditPreferences,
  onOpenPrefsModal,
  onPlayerStatsClick,
  currentPlayerRef,
  compareMode,
  isCompareSelected,
  onToggleCompare,
  isExpanded,
  onToggleExpand,
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
    player.contractDuration === 3 ? 'text-primary-400' :
    'text-secondary-400'

  const handlePlayerClick = () => {
    onPlayerStatsClick({
      name: player.playerName,
      team: player.playerTeam,
      position: player.playerPosition,
      quotation: player.playerQuotation,
      age: player.playerAge,
      apiFootballId: player.playerApiFootballId,
      computedStats: player.playerComputedStats,
    })
  }

  // Row background/state styles
  const rowStateClass =
    isCurrent
      ? 'border-l-4 border-l-primary-500 bg-primary-500/15'
      : isPassed && wasStolen
      ? 'bg-danger-500/10'
      : isPassed && !wasStolen
      ? 'opacity-40'
      : isAutoSkip
      ? 'opacity-30'
      : isWatchlisted
      ? 'bg-indigo-500/5'
      : ''

  // Strategy indicators
  const hasStrategy = pref?.priority || pref?.maxBid || pref?.notes || pref?.isWatchlist || pref?.isAutoPass

  // Contract info string (used on both layouts)
  const contractInline = (passedStyle: boolean) => (
    <span className="flex items-center gap-0.5 text-xs whitespace-nowrap">
      <span className={passedStyle ? 'text-gray-500' : 'text-accent-400'}>Ing {player.contractSalary}M</span>
      <span className="text-gray-600 mx-0.5">&middot;</span>
      <span className={passedStyle ? 'text-gray-500' : durationColor}>{player.contractDuration}s</span>
      <span className="text-gray-600 mx-0.5">&middot;</span>
      <span className={passedStyle ? 'text-gray-500' : 'text-purple-400'}>Cl {player.contractClause}M</span>
    </span>
  )

  // Strategy indicators inline
  const strategyIndicators = () => {
    if (isMyPlayer || isPassed) return null
    return (
      <span className="flex items-center gap-1 flex-shrink-0">
        {pref?.isWatchlist && <span className="text-indigo-400 text-[10px]" title="In watchlist">&#128065;&#65039;</span>}
        {pref?.isAutoPass && <span className="text-gray-400 text-[10px]" title="Auto-skip">&#9197;&#65039;</span>}
        {pref?.priority && <span className="text-purple-400 text-[10px]" title={`Priorita ${pref.priority}`}>{'★'.repeat(pref.priority)}</span>}
        {pref?.maxBid && <span className="text-blue-400 text-[10px]" title={`Max ${pref.maxBid}M`}>Max: {pref.maxBid}M</span>}
        {pref?.notes && <span className="text-gray-400 text-[10px]" title={pref.notes} aria-label="Note strategia impostate">&#128221;</span>}
      </span>
    )
  }

  // Strategy gear button
  const strategyButton = () => {
    if (isMyPlayer || isPassed || isCurrent || !canEditPreferences) return null
    return hasStrategy ? (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenPrefsModal({ ...player, preference: pref }) }}
        className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/30 text-indigo-400 flex-shrink-0"
        title="Modifica strategia"
      >
        &#9881;&#65039;
      </button>
    ) : (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenPrefsModal({ ...player, preference: pref || null }) }}
        className="px-1.5 py-0.5 rounded text-[10px] bg-surface-50/20 text-indigo-400/70 hover:bg-indigo-500/20 hover:text-indigo-400 flex-shrink-0"
        title="Imposta strategia"
      >
        &#9881;&#65039;
      </button>
    )
  }

  return (
    <div
      ref={isCurrent ? currentPlayerRef as React.RefObject<HTMLDivElement> : null}
      tabIndex={0}
      role="listitem"
      aria-label={`${player.playerName}, ${player.playerPosition}, ${player.playerTeam}${isCurrent ? ', sul piatto' : ''}${wasStolen ? `, rubato da ${player.stolenByUsername ?? ''}` : ''}`}
      onKeyDown={handleKeyDown}
      className={`px-2 py-1 md:px-3 md:py-1.5 border-b border-surface-50/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/70 ${rowStateClass}`}
    >
      {/* DESKTOP: single flex row */}
      <div className="hidden md:flex items-center gap-2 min-w-0">
        {/* Compare checkbox */}
        {compareMode && !isPassed && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCompare?.() }}
            className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
              isCompareSelected
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-gray-500 hover:border-primary-400'
            }`}
            aria-label={isCompareSelected ? 'Rimuovi dal confronto' : 'Aggiungi al confronto'}
          >
            {isCompareSelected && (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        {/* Index */}
        <span className="text-[11px] font-mono w-5 text-center text-gray-500 flex-shrink-0">#{globalIndex + 1}</span>

        {/* Position badge */}
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
          {player.playerPosition}
        </span>

        {/* Player name (clickable) */}
        <button
          type="button"
          onClick={handlePlayerClick}
          className={`font-semibold text-sm truncate text-left flex-shrink min-w-0 ${
            isPassed ? 'text-gray-500' : 'text-white hover:text-primary-300'
          }`}
          title="Clicca per statistiche"
        >
          {player.playerName}
        </button>

        {/* Owner */}
        <span className="text-[11px] text-gray-500 truncate flex-shrink-0 max-w-[120px]">
          di <span className={isPassed && wasStolen ? 'line-through' : ''}>{player.ownerTeamName ?? player.ownerUsername}</span>
        </span>

        {/* Stolen inline */}
        {wasStolen && (
          <>
            <span className="text-danger-400 text-[11px] font-bold flex-shrink-0">
              &#127919; {player.stolenByUsername}
            </span>
            {player.stolenPrice != null && player.stolenPrice > player.rubataPrice && (
              <span className="text-danger-500 text-[10px] font-medium flex-shrink-0">(+{player.stolenPrice - player.rubataPrice}M)</span>
            )}
          </>
        )}

        {/* Passed check */}
        {isPassed && !wasStolen && (
          <span className="text-secondary-500 text-[11px] flex-shrink-0">&#10003;</span>
        )}

        {/* My player label */}
        {isMyPlayer && !isPassed && (
          <span className="text-gray-500 text-[10px] flex-shrink-0">Mio</span>
        )}

        {/* Separator */}
        <span className="text-gray-700 flex-shrink-0">|</span>

        {/* Contract data inline */}
        {contractInline(isPassed)}

        {/* Separator */}
        <span className="text-gray-700 flex-shrink-0">|</span>

        {/* Rubata price */}
        <span className={`font-black text-sm flex-shrink-0 ${
          isCurrent ? 'text-primary-400' : isPassed ? 'text-gray-500' : 'text-warning-400'
        }`}>
          {player.rubataPrice}M
        </span>

        {/* Separator before strategy */}
        {!isPassed && !isMyPlayer && !isCurrent && <span className="text-gray-700 flex-shrink-0">|</span>}

        {/* Strategy indicators + button */}
        {strategyIndicators()}
        {strategyButton()}
      </div>

      {/* MOBILE: 2-row layout */}
      <div className="md:hidden">
        {/* Row 1: index, position, name, rubata price */}
        <div className="flex items-center gap-1 min-w-0">
          {/* Compare checkbox */}
          {compareMode && !isPassed && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleCompare?.() }}
              className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                isCompareSelected
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-gray-500'
              }`}
              aria-label={isCompareSelected ? 'Rimuovi dal confronto' : 'Aggiungi al confronto'}
            >
              {isCompareSelected && (
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )}

          <span className="text-[10px] font-mono text-gray-500 flex-shrink-0 w-5 text-center">#{globalIndex + 1}</span>

          <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[8px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
            {player.playerPosition}
          </span>

          <button
            type="button"
            onClick={handlePlayerClick}
            className={`font-semibold text-sm truncate text-left flex-1 min-w-0 ${
              isPassed ? 'text-gray-500' : 'text-white'
            }`}
            title="Clicca per statistiche"
          >
            {player.playerName}
          </button>

          {/* Stolen inline on mobile */}
          {wasStolen && (
            <>
              <span className="text-danger-400 text-[10px] font-bold flex-shrink-0">
                &#127919; {player.stolenByUsername}
              </span>
              {player.stolenPrice != null && player.stolenPrice > player.rubataPrice && (
                <span className="text-danger-500 text-[10px] font-medium flex-shrink-0">(+{player.stolenPrice - player.rubataPrice}M)</span>
              )}
            </>
          )}

          {/* Passed check on mobile */}
          {isPassed && !wasStolen && (
            <span className="text-secondary-500 text-[10px] flex-shrink-0">&#10003;</span>
          )}

          {/* Rubata price right-aligned */}
          <span className={`ml-auto font-black text-sm flex-shrink-0 ${
            isCurrent ? 'text-primary-400' : isPassed ? 'text-gray-500' : 'text-warning-400'
          }`}>
            {player.rubataPrice}M
          </span>
        </div>

        {/* Row 2: owner, contract, strategy (click to expand on non-current) */}
        <div
          className="flex items-center gap-1 ml-5 mt-0.5 flex-wrap cursor-pointer"
          onClick={onToggleExpand}
          role="button"
          tabIndex={0}
        >
          <span className="text-[10px] text-gray-500">
            di <span className={isPassed && wasStolen ? 'line-through' : 'text-gray-400'}>{player.ownerUsername}</span>
          </span>

          {(isCurrent || isExpanded) ? (
            <>
              <span className="text-gray-600 text-[10px]">&middot;</span>
              {contractInline(isPassed)}
              {strategyIndicators()}
              {strategyButton()}
            </>
          ) : (
            <span className="text-gray-600 text-[10px] ml-0.5">&#8250;</span>
          )}
        </div>
      </div>
    </div>
  )
})
