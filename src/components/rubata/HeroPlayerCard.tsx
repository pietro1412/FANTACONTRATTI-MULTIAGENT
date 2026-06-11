import { memo } from 'react'
import { Settings } from 'lucide-react'
import { TeamLogo } from './TeamLogo'
import { Monogram } from './Monogram'
import { POSITION_COLORS } from '../../types/rubata.types'
import { getWatchlistCategory } from '@/types/watchlist.types'
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
  canMakeOffer: boolean
  isSubmitting: boolean
  myMemberId: string | undefined
  /** Bilancio residuo del manager corrente (per affordability check) */
  myResiduo?: number | null
  preference: RubataPreference | undefined
  activeAuction: ActiveAuction | null
  onMakeOffer: () => void
  onPlayerStatsClick: (info: PlayerStatsInfo) => void
  onOpenPrefsModal: (player: BoardPlayerWithPreference) => void
  canEditPreferences: boolean
  heroRef?: React.RefObject<HTMLDivElement>
}

function semestriLabel(n: number): string {
  return n === 1 ? '1 semestre' : `${n} semestri`
}

/** Mockup v2 role badge colors: P oro, D blu, C verde, A rosso (bg /14, border /40) */
const ROLE_BADGE_COLORS: Record<string, string> = {
  P: 'bg-accent-500/[0.14] text-accent-400 border border-accent-500/40',
  D: 'bg-primary-500/[0.14] text-primary-400 border border-primary-500/40',
  C: 'bg-secondary-500/[0.14] text-secondary-400 border border-secondary-500/40',
  A: 'bg-danger-500/[0.14] text-danger-400 border border-danger-500/40',
}

export const HeroPlayerCard = memo(function HeroPlayerCard({
  player,
  rubataState,
  canMakeOffer,
  isSubmitting,
  myMemberId,
  myResiduo,
  preference: pref,
  activeAuction,
  onMakeOffer,
  onPlayerStatsClick,
  onOpenPrefsModal,
  canEditPreferences,
  heroRef,
}: HeroPlayerCardProps) {
  const isMyPlayer = player.memberId === myMemberId
  const ownerName = player.ownerTeamName ?? player.ownerUsername

  const wlCategory = getWatchlistCategory(pref?.watchlistCategory)
  const showWatchlistChip = !isMyPlayer && !!(pref?.isWatchlist || wlCategory)

  const residuoAfter = myResiduo != null ? myResiduo - player.rubataPrice : null
  const canAfford = residuoAfter !== null && residuoAfter >= 0

  const winningBid = activeAuction && activeAuction.bids.length > 0
    ? activeAuction.bids.find(b => b.isWinning) ?? activeAuction.bids[0]
    : null

  return (
    <div
      ref={heroRef as React.RefObject<HTMLDivElement>}
      className="mb-3 bg-surface-200 arena-gold rounded-xl overflow-hidden"
    >
      <div className="p-4">
        {/* Arena tag */}
        <p className="micro-label text-accent-400 mb-3">
          {rubataState === 'AUCTION' ? 'Asta al rilancio' : 'Sul piatto — vuoi rubarlo?'}
        </p>

        {/* Player head */}
        <div className="flex items-center gap-3">
          {player.playerApiFootballId ? (
            <img
              src={getPlayerPhotoUrl(player.playerApiFootballId)}
              alt={player.playerName}
              className="w-12 h-12 rounded-full object-cover bg-surface-300 border-2 border-accent-500/60 flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className={`w-[46px] h-[46px] rounded-[10px] flex items-center justify-center text-xl font-display font-extrabold flex-shrink-0 ${ROLE_BADGE_COLORS[player.playerPosition] ?? POSITION_COLORS[player.playerPosition] ?? ''}`}>
              {player.playerPosition}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
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
                className="text-2xl sm:text-[28px] font-display font-bold text-white hover:text-accent-300 truncate leading-tight"
                title="Clicca per vedere statistiche"
              >
                {player.playerName}
              </button>
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition] ?? ''}`}>
                {player.playerPosition}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap text-sm text-gray-400">
              <span className="w-4 h-4 bg-white rounded p-px flex-shrink-0">
                <TeamLogo team={player.playerTeam} />
              </span>
              <span>{player.playerTeam}</span>
              {player.playerAge != null && (
                <>
                  <span className="text-gray-600" aria-hidden="true">·</span>
                  <span>{player.playerAge} anni</span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5 ml-1 pl-1 pr-3 py-1 rounded-full bg-surface-300 border border-surface-50 text-xs text-gray-400">
                <Monogram name={ownerName} size="xs" />
                dalla rosa di <b className="text-gray-200 font-semibold">{ownerName}</b>
              </span>
            </div>
          </div>
        </div>

        {/* Watchlist chip — stessa tassonomia di StrategieRubata */}
        {showWatchlistChip && (
          <div className="mt-3 inline-flex items-center gap-2 flex-wrap rounded-lg border border-primary-500/40 bg-primary-500/10 px-3 py-1.5 text-sm">
            <span className="text-gray-300">Nella tua watchlist:</span>
            {wlCategory ? (
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${wlCategory.color}`}>
                {wlCategory.label}
              </span>
            ) : (
              <span className="text-primary-400 font-bold">senza categoria</span>
            )}
            {pref?.priority ? (
              <span className="text-accent-400" title={`Priorità ${pref.priority}`}>{'★'.repeat(pref.priority)}</span>
            ) : null}
            {pref?.maxBid != null && (
              <span className="text-gray-400">· tuo massimale <b className="text-primary-400 font-mono">{pref.maxBid}M</b></span>
            )}
          </div>
        )}

        {/* Costo rubata — protagonista */}
        <div className="mt-3 flex items-center gap-4 flex-wrap rounded-xl border border-accent-500/40 bg-surface-300 px-4 py-3">
          <div className="flex flex-col">
            <span className="micro-label text-accent-400">Costo rubata</span>
            <span className="stat-number text-[44px] sm:text-[54px] leading-none text-accent-300">{player.rubataPrice}M</span>
          </div>
          <span className="stat-number text-2xl text-gray-600" aria-hidden="true">=</span>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-surface-200 border border-surface-50/30 px-3 py-1.5 text-center">
              <div className="stat-number text-xl text-white leading-tight">{player.contractClause}M</div>
              <div className="text-[10px] text-gray-500">clausola</div>
            </div>
            <span className="stat-number text-lg text-gray-600" aria-hidden="true">+</span>
            <div className="rounded-lg bg-surface-200 border border-surface-50/30 px-3 py-1.5 text-center">
              <div className="stat-number text-xl text-white leading-tight">{player.contractSalary}M</div>
              <div className="text-[10px] text-gray-500">ingaggio · {semestriLabel(player.contractDuration)}</div>
            </div>
          </div>
        </div>

        {/* Affordability check */}
        {!isMyPlayer && residuoAfter !== null && (
          canAfford ? (
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-secondary-500/40 bg-secondary-500/10 px-3 py-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-secondary-500 text-dark-300 flex items-center justify-center text-xs font-bold flex-shrink-0" aria-hidden="true">✓</span>
              <span className="text-gray-300">
                <b className="text-secondary-400 font-bold">Te lo puoi permettere.</b>{' '}
                Bilancio dopo la rubata: <b className="font-mono text-secondary-400">{residuoAfter}M</b> su <span className="font-mono">{myResiduo}M</span>
              </span>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-danger-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0" aria-hidden="true">!</span>
              <span className="text-gray-300">
                <b className="text-danger-400 font-bold">Non te lo puoi permettere.</b>{' '}
                Ti mancano <b className="font-mono text-danger-400">{Math.abs(residuoAfter)}M</b> sul tuo bilancio di <span className="font-mono">{myResiduo}M</span>
              </span>
            </div>
          )
        )}

        {/* Strategy edit shortcut */}
        {!isMyPlayer && canEditPreferences && (
          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={() => { onOpenPrefsModal({ ...player, preference: pref || null }); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-primary-500/15 text-primary-400 hover:bg-primary-500/25 transition-colors"
            >
              <Settings size={12} aria-hidden="true" />
              {showWatchlistChip || pref?.maxBid || pref?.priority ? 'Modifica strategia' : 'Imposta strategia'}
            </button>
          </div>
        )}

        {/* CTA — only during OFFERING */}
        {rubataState === 'OFFERING' && canMakeOffer && !isMyPlayer && (
          <button
            type="button"
            onClick={onMakeOffer}
            disabled={isSubmitting}
            className="mt-3 w-full py-3.5 rounded-xl font-display font-extrabold text-lg uppercase tracking-wide text-dark-300 bg-gradient-to-b from-secondary-400 to-secondary-500 hover:from-secondary-300 hover:to-secondary-400 shadow-glow-green transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Voglio rubare — {player.rubataPrice}M
          </button>
        )}

        {/* During AUCTION — current bid big */}
        {rubataState === 'AUCTION' && activeAuction && (
          <div className="mt-3 rounded-xl border border-danger-500/50 bg-surface-300 px-3 py-3 text-center">
            <p className="micro-label">Offerta attuale</p>
            <p
              className="stat-number text-[56px] md:text-[40px] leading-none text-accent-300 mt-1"
              aria-live="polite"
              aria-label={`Offerta attuale: ${activeAuction.currentPrice} milioni`}
            >
              {activeAuction.currentPrice}M
            </p>
            {winningBid && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-gray-400">
                <Monogram name={winningBid.bidder} size="xs" />
                offerta di <b className="text-white font-semibold">{winningBid.bidder}</b>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
