import { AuctionTimer } from '../AuctionTimer'
import { PlayerCard } from './PlayerCard'
import { BidControls } from './BidControls'
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
}

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
}: BiddingPanelProps) {
  const isTimerCritical = timeLeft !== null && timeLeft <= 10

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

  return (
    <div className="space-y-4">
      {/* 2-column layout on desktop — equal height */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0 items-stretch">
        {/* Left: Player Card with photo — stretch to fill */}
        <div className="flex">
          <div className="w-full">
            <PlayerCard
              name={auction.player.name}
              team={auction.player.team}
              position={auction.player.position}
              quotation={auction.player.quotation}
              age={auction.player.age}
              apiFootballId={auction.player.apiFootballId}
              appearances={auction.player.appearances}
              goals={auction.player.goals}
              assists={auction.player.assists}
              avgRating={auction.player.avgRating}
              size="lg"
            />
          </div>
        </div>

        {/* Right column: ONE decision zone — price/timer box with bid controls right under it */}
        <div className="flex flex-col gap-3">
          <div className={`relative rounded-xl p-5 w-full flex-1 border overflow-hidden flex items-center ${
            isTimerCritical
              ? 'border-red-500/60 bg-gradient-to-br from-red-950/40 to-surface-300'
              : 'border-danger-500/30 bg-gradient-to-br from-danger-950/15 to-surface-300'
          }`}>
            {/* Left side: Timer (bigger) */}
            <div className="flex-shrink-0 mr-5">
              {auction.timerExpiresAt && (
                <AuctionTimer timeLeft={timeLeft} totalSeconds={timerSetting} compact compactSize="md" />
              )}
            </div>

            {/* Right side: Label + Price + Bidder */}
            <div className="flex-1 text-center">
              <p className="text-sm text-gray-400 uppercase tracking-widest font-bold mb-1">Offerta Corrente</p>

              <p className={`stat-number text-6xl lg:text-7xl font-black mb-2 leading-none ${
                isTimerCritical ? 'text-red-400 animate-pulse' : 'text-white'
              }`}>
                {auction.currentPrice}<span className="text-2xl text-gray-500 font-bold align-baseline">M</span>
              </p>
              {auction.bids.length > 0 && auction.bids[0] && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                  auction.bids[0].bidder.user.username === currentUsername
                    ? 'bg-green-500/15 border-green-500/40'
                    : 'bg-primary-500/15 border-primary-500/40'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    auction.bids[0].bidder.user.username === currentUsername
                      ? 'bg-green-500/30 text-green-300'
                      : 'bg-primary-500/30 text-primary-300'
                  }`}>
                    {auction.bids[0].bidder.user.username.slice(0, 2).toUpperCase()}
                  </span>
                  <span className={`font-bold text-sm ${
                    auction.bids[0].bidder.user.username === currentUsername ? 'text-green-400' : 'text-primary-300'
                  }`}>
                    {auction.bids[0].bidder.user.username === currentUsername
                      ? 'offerta tua'
                      : `offerta di ${auction.bids[0].bidder.user.username}`}
                  </span>
                </div>
              )}
              {auction.bids.length === 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-300/50">
                  <span className="text-gray-400 text-sm">Base d'asta:</span>
                  <span className="text-white font-bold font-mono">{auction.basePrice}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bid controls inside the decision zone — hidden on mobile (MobileBottomBar handles it) */}
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
                <BidControls
                  bidAmount={bidAmount}
                  setBidAmount={setBidAmount}
                  onPlaceBid={onPlaceBid}
                  currentPrice={auction.currentPrice}
                  isTimerExpired={isTimerExpired}
                  budget={membership?.currentBudget || 0}
                  isBidding={isBidding}
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
        </div>
      </div>

      {/* Last bids — compact horizontal strip */}
      {auction.bids.length > 0 && (
        <div className="border-t border-surface-50 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="micro-label">Ultimi rilanci</h4>
            <span className="text-sm text-gray-500 font-mono">{auction.bids.length} offerte</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {auction.bids.slice(0, 12).map((bid, i) => {
              const isMine = bid.bidder.user.username === currentUsername
              return (
                <span
                  key={bid.id}
                  title={new Date(bid.placedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sms whitespace-nowrap flex-shrink-0 ${
                    i === 0
                      ? 'bg-sky-500/15 border border-sky-500/30 text-white font-medium'
                      : 'bg-surface-300/40 text-gray-400'
                  }`}
                >
                  <span className={isMine ? 'text-secondary-400 font-semibold' : ''}>
                    {bid.bidder.user.username}{isMine && ' (tu)'}
                  </span>
                  <span className={`font-mono font-bold ${i === 0 ? 'text-sky-400' : 'text-gray-300'}`}>
                    {bid.amount}M
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
