import { useState } from 'react'
import { TimerDisplay } from '@/components/ui/TimerDisplay'
import { BidControlsShared } from '@/components/ui/BidControlsShared'
import { BidChips } from '@/components/ui/BidChips'
import { Monogram } from '@/components/ui/Monogram'
import { POSITION_NAMES } from '../ui/PositionBadge'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import type { Auction, Membership, MyRosterSlots } from '../../types/auctionroom.types'

interface BiddingPanelProps {
  auction: Auction
  timeLeft: number | null
  timerSetting: number
  isTimerExpired: boolean
  isUserWinning: boolean
  currentUsername: string | undefined
  membership: Membership | null
  bidAmount: string
  setBidAmount: (amount: string) => void
  onPlaceBid: () => void
  isAdmin: boolean
  onCloseAuction?: () => void
  myRosterSlots?: MyRosterSlots | null
  isBidding?: boolean
  isConnected?: boolean
  /** Manager che ha chiamato il giocatore (chip proprietario della nomination) */
  nominatorUsername?: string | null
}

/** P2 — role badge 46px stile mockup: P oro, D blu, C verde, A rosso */
const ROLE_BADGE_COLORS: Record<string, string> = {
  P: 'bg-accent-500/[0.14] text-accent-400 border border-accent-500/40',
  D: 'bg-primary-500/[0.14] text-primary-400 border border-primary-500/40',
  C: 'bg-secondary-500/[0.14] text-secondary-400 border border-secondary-500/40',
  A: 'bg-danger-500/[0.14] text-danger-400 border border-danger-500/40',
}

/**
 * Arena d'asta a cockpit (P2-P4): identità giocatore + statistiche in UNA
 * riga a 5 celle + box prezzo con TimerDisplay + BidControlsShared + BidChips.
 * Su mobile i controlli vivono nella MobileBottomBar (invariata).
 */
export function BiddingPanel({
  auction,
  timeLeft,
  timerSetting,
  isTimerExpired,
  isUserWinning: _isUserWinning,
  currentUsername,
  membership,
  bidAmount,
  setBidAmount,
  onPlaceBid,
  isAdmin: _isAdmin,
  onCloseAuction: _onCloseAuction,
  myRosterSlots,
  isBidding = false,
  isConnected = true,
  nominatorUsername,
}: BiddingPanelProps) {
  const [imgError, setImgError] = useState(false)

  // Check if role slot is full
  const auctionRole = auction.player.position as 'P' | 'D' | 'C' | 'A'
  const roleSlot = myRosterSlots?.slots[auctionRole]
  const isRoleFull = roleSlot ? roleSlot.filled >= roleSlot.total : false
  const roleSlotsLeft = roleSlot ? roleSlot.total - roleSlot.filled : null

  // My max bid (same rule as the StatusBar box: balance minus 2M reserved per empty slot)
  const myMaxBid = (() => {
    if (!myRosterSlots || !membership) return null
    const slots = myRosterSlots.slots
    const emptySlots = (['P', 'D', 'C', 'A'] as const).reduce(
      (sum, pos) => sum + (slots[pos].total - slots[pos].filled), 0
    )
    const monteIngaggi = (['P', 'D', 'C', 'A'] as const).reduce(
      (sum, pos) => sum + slots[pos].players.reduce((s, p) => s + (p.contract?.salary || 0), 0), 0
    )
    return Math.max(0, membership.currentBudget - monteIngaggi - (emptySlots * 2))
  })()

  const photoUrl = getPlayerPhotoUrl(auction.player.apiFootballId)
  const winningBid = auction.bids[0] ?? null
  const isMyBid = winningBid?.bidder.user.username === currentUsername

  return (
    <div className="space-y-3">
      {/* Player head: badge ruolo 46px + nome + meta + chip "chiamato da" (P2) */}
      <div className="flex items-center gap-3.5 flex-wrap">
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={auction.player.name}
            className="w-[46px] h-[46px] rounded-[10px] object-cover bg-surface-300 border border-accent-500/40 flex-shrink-0"
            onError={() => { setImgError(true); }}
          />
        ) : (
          <span className={`w-[46px] h-[46px] rounded-[10px] flex items-center justify-center text-xl font-display font-extrabold flex-shrink-0 ${ROLE_BADGE_COLORS[auction.player.position] ?? ''}`}>
            {auction.player.position}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl lg:text-[26px] font-bold text-white leading-tight truncate">
            {auction.player.name}
          </p>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {POSITION_NAMES[auction.player.position] || auction.player.position}
            <span className="text-gray-600" aria-hidden="true">·</span>
            <span className="w-4 h-4 bg-white rounded p-px inline-flex items-center justify-center flex-shrink-0">
              <img src={getTeamLogo(auction.player.team)} alt={auction.player.team} className="w-3 h-3 object-contain" />
            </span>
            <b className="text-gray-200 font-semibold">{auction.player.team}</b>
            {auction.player.age != null && auction.player.age > 0 && (
              <>
                <span className="text-gray-600" aria-hidden="true">·</span>
                {auction.player.age} anni
              </>
            )}
          </p>
        </div>
        {nominatorUsername && (
          <span className="inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full bg-surface-300 border border-surface-50 text-xs text-gray-400 flex-shrink-0">
            <Monogram name={nominatorUsername} size="sm" />
            chiamato da <b className="text-gray-200 font-semibold">{nominatorUsername}</b>
          </span>
        )}
      </div>

      {/* Statistiche compresse in UNA riga a 5 celle (P2) */}
      <div className="grid grid-cols-5 gap-2">
        {([
          { value: auction.player.appearances, label: 'Presenze' },
          { value: auction.player.goals, label: 'Gol' },
          { value: auction.player.assists, label: 'Assist' },
          { value: auction.player.avgRating, label: 'Fantamedia' },
          { value: auction.player.quotation, label: 'Quotazione', gold: true },
        ] as const).map(stat => (
          <div key={stat.label} className="bg-surface-300 border border-surface-50 rounded-[10px] px-1.5 py-2 text-center">
            <p className={`stat-number text-xl lg:text-[23px] leading-tight ${'gold' in stat && stat.gold ? 'text-accent-400' : 'text-white'}`}>
              {stat.value ?? '—'}
            </p>
            <p className="font-mono text-[9px] font-bold tracking-[0.08em] uppercase text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Box prezzo + timer 44px sempre visibili (P1) */}
      <div className="flex items-center gap-5 bg-surface-300 border border-accent-500/40 rounded-xl px-4 py-3">
        <div className="flex flex-col min-w-0">
          <span className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-accent-400 mb-1">
            Offerta attuale
          </span>
          <span className="stat-number text-5xl leading-none text-accent-300" aria-live="polite" aria-label={`Offerta attuale: ${auction.currentPrice} milioni`}>
            {auction.currentPrice}M
          </span>
          {winningBid ? (
            <span className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-gray-400">
              <Monogram name={winningBid.bidder.user.username} size="sm" />
              {isMyBid ? (
                <b className="text-secondary-400 font-semibold">offerta tua — stai vincendo</b>
              ) : (
                <>di <b className="text-white font-semibold">{winningBid.bidder.user.username}</b></>
              )}
            </span>
          ) : (
            <span className="mt-1.5 text-[12.5px] text-gray-400">
              Base d&apos;asta: <b className="text-white font-mono font-semibold">{auction.basePrice}M</b>
            </span>
          )}
        </div>
        {auction.timerExpiresAt && (
          <TimerDisplay
            seconds={timeLeft}
            totalSeconds={timerSetting}
            size={44}
            className="ml-auto"
          />
        )}
      </div>

      {/* Controlli di rilancio (P3) — desktop; su mobile c'è la MobileBottomBar */}
      <div className="hidden lg:block">
        {isRoleFull ? (
          <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/30 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-amber-400 font-bold text-sm">Slot Ruolo Completo</span>
            </div>
            <p className="text-gray-400 text-sms">
              Hai completato tutti gli slot per questo ruolo ({roleSlot?.filled}/{roleSlot?.total}). Non puoi fare offerte.
            </p>
          </div>
        ) : (
          <>
            <BidControlsShared
              bidAmount={parseInt(bidAmount || '0') || 0}
              setBidAmount={n => { setBidAmount(String(n)); }}
              onPlaceBid={onPlaceBid}
              currentPrice={auction.currentPrice}
              budget={membership?.currentBudget || 0}
              budgetLabel="budget"
              isSubmitting={isBidding}
              isDisabled={isTimerExpired}
              disabledLabel="Scaduto"
              isConnected={isConnected}
            />
            {myMaxBid !== null && roleSlotsLeft !== null && (
              <p className="mt-1.5 text-sm text-gray-400 text-center">
                La tua offerta max: <span className="font-mono font-bold text-accent-400">{myMaxBid}M</span>
                {' '}· ti restano <span className="font-bold text-gray-300">{roleSlotsLeft}</span> slot {auctionRole}
              </p>
            )}
          </>
        )}
      </div>

      {/* Ultimi rilanci a chip orizzontali (P4) */}
      {auction.bids.length > 0 && (
        <div className="border-t border-surface-50 pt-2.5">
          <BidChips
            bids={auction.bids.slice(0, 12).map(bid => ({
              id: bid.id,
              name: bid.bidder.user.username,
              amount: bid.amount,
              isMine: bid.bidder.user.username === currentUsername,
            }))}
          />
        </div>
      )}
    </div>
  )
}
