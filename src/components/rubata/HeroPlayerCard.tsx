import { memo } from 'react'
import { Button } from '../ui/Button'
import { TeamLogo } from './TeamLogo'
import { CircularTimer } from './CircularTimer'
import { POSITION_COLORS } from '../../types/rubata.types'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import type {
  BoardPlayer,
  RubataStateType,
  RubataPreference,
  ActiveAuction,
  BoardPlayerWithPreference,
} from '../../types/rubata.types'
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

export interface HeroPlayerCardProps {
  player: BoardPlayer
  rubataState: RubataStateType
  timerDisplay: number | null
  timerTotal: number
  canMakeOffer: boolean
  isSubmitting: boolean
  myMemberId: string | undefined
  preference: RubataPreference | undefined
  activeAuction: ActiveAuction | null
  onMakeOffer: () => void
  onPlayerStatsClick: (info: PlayerStatsInfo) => void
  onOpenPrefsModal: (player: BoardPlayerWithPreference) => void
  canEditPreferences: boolean
  heroRef?: React.RefObject<HTMLDivElement>
}

function AgeBadge({ age }: { age: number }) {
  const colors =
    age <= 23 ? 'bg-green-500/20 text-green-400' :
    age <= 28 ? 'bg-surface-50/20 text-gray-300' :
    age <= 31 ? 'bg-warning-500/20 text-warning-400' :
    'bg-danger-500/20 text-danger-400'
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${colors}`}>
      {age}a
    </span>
  )
}

export const HeroPlayerCard = memo(function HeroPlayerCard({
  player,
  rubataState,
  timerDisplay,
  timerTotal,
  canMakeOffer,
  isSubmitting,
  myMemberId,
  preference: pref,
  activeAuction,
  onMakeOffer,
  onPlayerStatsClick,
  onOpenPrefsModal,
  canEditPreferences,
  heroRef,
}: HeroPlayerCardProps) {
  const isMyPlayer = player.memberId === myMemberId
  const ownerLabel = player.ownerTeamName
    ? `${player.ownerTeamName} (${player.ownerUsername})`
    : player.ownerUsername

  const hasStrategy = pref?.priority || pref?.maxBid || pref?.notes || pref?.isWatchlist

  const durationColor =
    player.contractDuration === 1 ? 'text-danger-400' :
    player.contractDuration === 2 ? 'text-warning-400' :
    player.contractDuration === 3 ? 'text-primary-400' :
    'text-secondary-400'

  return (
    <div
      ref={heroRef as React.RefObject<HTMLDivElement>}
      className="mb-3 bg-gradient-to-r from-primary-500/20 via-surface-200 to-primary-500/20 border-2 border-primary-500 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header label */}
      <div className="bg-primary-500/30 px-4 py-1.5 flex items-center justify-between">
        <span className="text-xs font-bold text-primary-300 uppercase tracking-wider">SUL PIATTO</span>
        {timerDisplay !== null && (
          <CircularTimer seconds={timerDisplay} totalSeconds={timerTotal} size="sm" />
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Player info row */}
        <div className="flex items-center gap-3">
          {/* Photo / position fallback */}
          {player.playerApiFootballId ? (
            <img
              src={getPlayerPhotoUrl(player.playerApiFootballId)}
              alt={player.playerName}
              className="w-14 h-14 rounded-full object-cover bg-surface-300 border-2 border-primary-500 flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
              {player.playerPosition}
            </div>
          )}

          {/* Name + team + owner */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onPlayerStatsClick({
                  name: player.playerName,
                  team: player.playerTeam,
                  position: player.playerPosition,
                  quotation: player.playerQuotation,
                  age: player.playerAge,
                  apiFootballId: player.playerApiFootballId,
                  computedStats: player.playerComputedStats,
                })}
                className="text-lg font-bold text-white hover:text-primary-300 truncate"
                title="Clicca per vedere statistiche"
              >
                {player.playerName}
              </button>
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
                {player.playerPosition}
              </span>
              {player.playerAge != null && <AgeBadge age={player.playerAge} />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-5 h-5 bg-white rounded p-0.5 flex-shrink-0">
                <TeamLogo team={player.playerTeam} />
              </div>
              <span className="text-sm text-gray-400">{player.playerTeam}</span>
              <span className="text-gray-600">·</span>
              <span className="text-sm text-gray-500">di {ownerLabel}</span>
            </div>
          </div>

          {/* Rubata price - prominent */}
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-black text-primary-400">{player.rubataPrice}M</div>
          </div>
        </div>

        {/* Contract details strip */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <div>
            <span className="text-gray-500 text-xs">Ingaggio </span>
            <span className="font-bold text-accent-400">{player.contractSalary}M</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Durata </span>
            <span className={`font-bold ${durationColor}`}>{player.contractDuration}s</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Clausola </span>
            <span className="font-bold text-purple-400">{player.contractClause}M</span>
          </div>
        </div>

        {/* Strategy row */}
        {!isMyPlayer && (hasStrategy || canEditPreferences) && (
          <div className="flex items-center gap-2 mt-2.5">
            {pref?.isWatchlist && <span className="text-indigo-400 text-sm" title="In watchlist">👁️</span>}
            {pref?.priority && <span className="text-purple-400 text-sm">{'★'.repeat(pref.priority)}</span>}
            {pref?.maxBid && <span className="text-blue-400 text-sm">Max: {pref.maxBid}M</span>}
            {pref?.notes && <span className="text-gray-400 text-sm" title={pref.notes}>📝</span>}
            {canEditPreferences && (
              <button
                type="button"
                onClick={() => onOpenPrefsModal({ ...player, preference: pref || null })}
                className="ml-auto px-2 py-1 rounded text-xs bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
              >
                {hasStrategy ? '⚙️ Modifica' : '+ Strategia'}
              </button>
            )}
          </div>
        )}

        {/* VOGLIO RUBARE button - only during OFFERING */}
        {rubataState === 'OFFERING' && canMakeOffer && !isMyPlayer && (
          <Button
            onClick={onMakeOffer}
            disabled={isSubmitting}
            variant="accent"
            className="w-full text-lg py-3 mt-3"
          >
            🎯 VOGLIO RUBARE! ({player.rubataPrice}M)
          </Button>
        )}

        {/* During AUCTION - show current auction info */}
        {rubataState === 'AUCTION' && activeAuction && (
          <div className="mt-3 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-danger-300 font-medium">🔥 Asta in corso</span>
              <span className="font-bold font-mono text-lg text-primary-400">{activeAuction.currentPrice}M</span>
            </div>
            {activeAuction.bids.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Ultima offerta: {activeAuction.bids[activeAuction.bids.length - 1]?.bidder}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
