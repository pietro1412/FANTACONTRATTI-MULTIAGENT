import { AuctionTimer } from '../AuctionTimer'
import { PlayerCard } from './PlayerCard'
import { BidControls } from './BidControls'
import type { Auction, Membership } from '../../types/auctionroom.types'

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
}: BiddingPanelProps) {
  const isTimerCritical = timeLeft !== null && timeLeft <= 10

  return (
    <div className="space-y-4">
      {/* 2-column layout on desktop */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* Left: Player Card with photo */}
        <div>
          <PlayerCard
            name={auction.player.name}
            team={auction.player.team}
            position={auction.player.position}
            quotation={auction.player.quotation}
            age={auction.player.age}
            apiFootballId={auction.player.apiFootballId}
            size="lg"
          />
        </div>

        {/* Right: Price + Timer */}
        <div className="flex flex-col items-center justify-center">
          {/* Timer */}
          {auction.timerExpiresAt && (
            <div className="w-full mb-3">
              <AuctionTimer timeLeft={timeLeft} totalSeconds={timerSetting} className="w-full" />
            </div>
          )}

          {/* Current Price - HUGE */}
          <div className={`relative rounded-xl p-5 text-center w-full border-2 overflow-hidden ${
            isTimerCritical
              ? 'border-red-500/50 bg-gradient-to-br from-red-950/30 to-slate-900/80'
              : 'border-sky-500/30 bg-gradient-to-br from-slate-800/50 to-slate-900/80'
          }`}>
            <p className="text-sm text-sky-400 uppercase tracking-wider font-bold mb-2">Offerta Corrente</p>
            <p className={`text-7xl lg:text-9xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r mb-3 ${
              isTimerCritical
                ? 'from-red-400 via-white to-red-400 animate-pulse'
                : 'from-sky-400 via-white to-sky-400'
            }`}>
              {auction.currentPrice}
            </p>
            {auction.bids.length > 0 && auction.bids[0] && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
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

      {/* Bid Controls - Hidden on mobile (MobileBottomBar handles it) */}
      <div className="hidden lg:block">
        <BidControls
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          onPlaceBid={onPlaceBid}
          currentPrice={auction.currentPrice}
          isTimerExpired={isTimerExpired}
          budget={membership?.currentBudget || 0}
          isAdmin={isAdmin}
          onCloseAuction={onCloseAuction}
        />
      </div>

      {/* Bid History */}
      {auction.bids.length > 0 && (
        <div className="border-t border-white/10 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-gray-400 font-medium">Storico Offerte</h4>
            <span className="text-[10px] text-gray-500 font-mono">{auction.bids.length} offerte</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {auction.bids.map((bid, i) => (
              <div
                key={bid.id}
                className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs ${
                  i === 0
                    ? 'bg-sky-500/15 border border-sky-500/25'
                    : 'bg-slate-800/40'
                }`}
              >
                <span className={`${i === 0 ? 'text-white font-medium' : 'text-gray-300'} ${
                  bid.bidder.user.username === currentUsername ? 'text-secondary-400' : ''
                }`}>
                  {bid.bidder.user.username}
                  {bid.bidder.user.username === currentUsername && ' (tu)'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${i === 0 ? 'text-sky-400' : 'text-white'}`}>
                    {bid.amount}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono">
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
