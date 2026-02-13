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
  isUserWinning,
  currentUsername,
  membership,
  bidAmount,
  setBidAmount,
  onPlaceBid,
  isAdmin,
  onCloseAuction,
  myRosterSlots,
  isBidding = false,
  isConnected = true,
}: BiddingPanelProps) {
  const isTimerCritical = timeLeft !== null && timeLeft <= 10

  // Check if role slot is full
  const auctionRole = auction.player.position as 'P' | 'D' | 'C' | 'A'
  const roleSlot = myRosterSlots?.slots[auctionRole]
  const isRoleFull = roleSlot ? roleSlot.filled >= roleSlot.total : false

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

        {/* Right: Timer (left) + Price (right) in ONE unified box */}
        <div className="flex">
          <div className={`relative rounded-xl p-5 w-full border-2 overflow-hidden flex items-center ${
            isTimerCritical
              ? 'border-red-500/50 bg-gradient-to-br from-red-950/30 to-slate-900/80'
              : 'border-sky-500/30 bg-gradient-to-br from-slate-800/50 to-slate-900/80'
          }`}>
            {/* Left side: Timer (bigger) */}
            <div className="flex-shrink-0 mr-5">
              {auction.timerExpiresAt && (
                <AuctionTimer timeLeft={timeLeft} totalSeconds={timerSetting} compact compactSize="md" />
              )}
            </div>

            {/* Right side: Label + Price + Bidder (manager + team) */}
            <div className="flex-1 text-center">
              <p className="text-sm text-sky-400 uppercase tracking-wider font-bold mb-1">Offerta Corrente</p>

              <p className={`text-5xl lg:text-6xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r mb-2 ${
                isTimerCritical
                  ? 'from-red-400 via-white to-red-400 animate-pulse'
                  : 'from-sky-400 via-white to-sky-400'
              }`}>
                {auction.currentPrice}
              </p>
              {auction.bids.length > 0 && auction.bids[0] && (
                <div className={`inline-flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl ${
                  auction.bids[0].bidder.user.username === currentUsername
                    ? 'bg-green-500/20 border border-green-500/50'
                    : 'bg-sky-500/20 border border-sky-500/30'
                }`}>
                  <span className={`font-bold text-sm ${
                    auction.bids[0].bidder.user.username === currentUsername ? 'text-green-400' : 'text-sky-300'
                  }`}>
                    {auction.bids[0].bidder.user.username}
                    {auction.bids[0].bidder.user.username === currentUsername && ' (SEI TU!)'}
                  </span>
                  {auction.bids[0].bidder.teamName && (
                    <span className="text-sm text-gray-400">{auction.bids[0].bidder.teamName}</span>
                  )}
                </div>
              )}
              {auction.bids.length === 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50">
                  <span className="text-gray-400 text-sm">Base d'asta:</span>
                  <span className="text-white font-bold font-mono">{auction.basePrice}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bid Controls - Hidden on mobile (MobileBottomBar handles it) */}
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
          <BidControls
            bidAmount={bidAmount}
            setBidAmount={setBidAmount}
            onPlaceBid={onPlaceBid}
            currentPrice={auction.currentPrice}
            isTimerExpired={isTimerExpired}
            budget={membership?.currentBudget || 0}
            isAdmin={isAdmin}
            onCloseAuction={onCloseAuction}
            isBidding={isBidding}
            isConnected={isConnected}
          />
        )}
      </div>

      {/* Bid History */}
      {auction.bids.length > 0 && (
        <div className="border-t border-white/10 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sms text-gray-400 font-medium">Storico Offerte</h4>
            <span className="text-sm text-gray-500 font-mono">{auction.bids.length} offerte</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {auction.bids.map((bid, i) => (
              <div
                key={bid.id}
                className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sms ${
                  i === 0
                    ? 'bg-sky-500/15 border border-sky-500/25'
                    : 'bg-slate-800/40'
                }`}
              >
                <span className={`${i === 0 ? 'text-white font-medium' : 'text-gray-300'} ${
                  bid.bidder.user.username === currentUsername ? 'text-secondary-400' : ''
                }`}>
                  {bid.bidder.user.username}
                  {bid.bidder.teamName && <span className="text-gray-500 ml-1">({bid.bidder.teamName})</span>}
                  {bid.bidder.user.username === currentUsername && ' (tu)'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${i === 0 ? 'text-sky-400' : 'text-white'}`}>
                    {bid.amount}
                  </span>
                  <span className="text-sm text-gray-600 font-mono">
                    {new Date(bid.placedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
