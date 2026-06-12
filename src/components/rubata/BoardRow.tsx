import { memo } from 'react'
import { Settings } from 'lucide-react'
import { Monogram } from '@/components/ui/Monogram'
import { POSITION_COLORS } from '../../types/rubata.types'
import { getWatchlistCategory } from '@/types/watchlist.types'
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
}

function semestriLabel(n: number): string {
  return n === 1 ? '1 semestre' : `${n} semestri`
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
}: BoardRowProps) {
  const wasStolen = !!player.stolenByUsername
  const isMyPlayer = player.memberId === myMemberId
  const isWatchlisted = !isMyPlayer && !isPassed && !!pref?.isWatchlist
  const isAutoSkip = !isMyPlayer && !isPassed && !!pref?.isAutoPass
  const wlCategory = getWatchlistCategory(pref?.watchlistCategory)
  const ownerName = player.ownerTeamName ?? player.ownerUsername

  const handleStatsClick = () => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStatsClick()
    } else if (e.key === ' ' && canEditPreferences && !isMyPlayer && !isPassed) {
      e.preventDefault()
      onOpenPrefsModal({ ...player, preference: pref || null })
    }
  }

  // Row state styles (mockup v2: sul piatto = filo oro, miei = filo blu, processati attenuati)
  const rowStateClass = isCurrent
    ? 'border-l-[3px] border-l-accent-500 bg-gradient-to-r from-accent-500/15 to-accent-500/[0.03]'
    : isMyPlayer && !isPassed
    ? 'border-l-[3px] border-l-primary-500 bg-primary-500/5'
    : isPassed
    ? 'opacity-40'
    : isAutoSkip
    ? 'opacity-30'
    : isWatchlisted
    ? 'bg-primary-500/5'
    : ''

  return (
    <div
      ref={isCurrent ? currentPlayerRef as React.RefObject<HTMLDivElement> : null}
      tabIndex={0}
      role="listitem"
      aria-label={`${player.playerName}, ${player.playerPosition}, ${player.playerTeam}${isCurrent ? ', sul piatto' : ''}${wasStolen ? `, rubato da ${player.stolenByUsername ?? ''}` : ''}`}
      onKeyDown={handleKeyDown}
      className={`px-2.5 py-2 md:px-3 border-b border-surface-50/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/70 ${rowStateClass}`}
    >
      {/* Riga 1: identità */}
      <div className="flex items-center gap-2 min-w-0">
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

        <span className="text-[10px] font-mono w-6 text-center text-gray-500 flex-shrink-0">#{globalIndex + 1}</span>

        <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
          {player.playerPosition}
        </span>

        <button
          type="button"
          onClick={handleStatsClick}
          className={`font-display font-bold text-sm truncate text-left min-w-0 ${
            isPassed ? 'text-gray-500' : 'text-white hover:text-primary-300'
          }`}
          title="Clicca per statistiche"
        >
          {player.playerName}
        </button>

        <span className="text-xs text-gray-500 truncate flex-shrink min-w-0 hidden sm:inline">{player.playerTeam}</span>

        {isCurrent && (
          <span className="text-[9px] font-mono font-bold text-dark-300 bg-accent-400 rounded px-1.5 py-px tracking-wider flex-shrink-0">
            SUL PIATTO
          </span>
        )}

        {wlCategory && !isMyPlayer && !isPassed && (
          <span className={`text-[9px] font-mono font-bold rounded border px-1.5 py-px flex-shrink-0 ${wlCategory.color}`} title={`Watchlist: ${wlCategory.label}`}>
            {wlCategory.label.toUpperCase()}
          </span>
        )}
        {!wlCategory && isWatchlisted && (
          <span className="text-[9px] font-mono font-bold rounded border px-1.5 py-px flex-shrink-0 bg-primary-500/15 text-primary-400 border-primary-500/40" title="In watchlist">
            WATCH
          </span>
        )}

        <span className="flex-1" />

        <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 flex-shrink-0 min-w-0">
          <Monogram name={ownerName} size="xs" className={isMyPlayer ? 'border-primary-500/60 text-primary-400' : ''} />
          <span className={`truncate max-w-[90px] ${isPassed && wasStolen ? 'line-through' : ''}`}>{ownerName}</span>
        </span>

        {!isMyPlayer && !isPassed && !isCurrent && canEditPreferences && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenPrefsModal({ ...player, preference: pref || null }) }}
            className="p-1 rounded text-primary-400/80 hover:text-primary-300 hover:bg-primary-500/15 flex-shrink-0 transition-colors"
            title={pref ? 'Modifica strategia' : 'Imposta strategia'}
          >
            <Settings size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Riga 2: economia / esito */}
      <div className="flex items-center gap-2 mt-1 ml-8 md:ml-9 min-w-0 text-xs">
        {wasStolen ? (
          <span className="text-danger-400 font-semibold truncate">
            Rubato da {player.stolenByUsername} per {player.stolenPrice ?? player.rubataPrice}M
          </span>
        ) : isPassed ? (
          <span className="text-gray-500 truncate">Passato — resta a {ownerName}</span>
        ) : (
          <>
            <span className={`font-bold whitespace-nowrap ${isCurrent ? 'text-accent-300' : isMyPlayer ? 'text-gray-500' : 'text-warning-400'}`}>
              Costo rubata <span className="stat-number text-sm">{player.rubataPrice}M</span>
            </span>
            <span className="text-gray-600 hidden sm:inline" aria-hidden="true">·</span>
            <span className="text-gray-500 truncate hidden sm:inline">
              ingaggio {player.contractSalary}M · {semestriLabel(player.contractDuration)}
            </span>
            {isMyPlayer && (
              <span className="text-primary-400 font-medium whitespace-nowrap">tua rosa — non rubabile da te</span>
            )}
            {isAutoSkip && (
              <span className="text-gray-500 whitespace-nowrap">auto-skip</span>
            )}
            {!isMyPlayer && (pref?.priority || pref?.maxBid != null || pref?.notes) && (
              <span className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                {pref?.priority ? <span className="text-accent-400 text-[10px]" title={`Priorità ${pref.priority}`}>{'★'.repeat(pref.priority)}</span> : null}
                {pref?.maxBid != null && <span className="text-primary-400 text-[10px] font-mono" title={`Max ${pref.maxBid}M`}>Max: {pref.maxBid}M</span>}
                {pref?.notes && <span className="text-gray-500 text-[10px]" title={pref.notes} aria-label="Note strategia impostate">Note</span>}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
})
