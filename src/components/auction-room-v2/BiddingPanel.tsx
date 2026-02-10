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
  return (
    <div className="space-y-4">
      {/* Timer */}
      {auction.timerExpiresAt && (
        <AuctionTimer timeLeft={timeLeft} totalSeconds={timerSetting} className="w-full" />
      )}

      {/* Player Card */}
      <PlayerCard
        name={auction.player.name}
        team={auction.player.team}
        position={auction.player.position}
        quotation={auction.player.quotation}
        size="md"
      />

      {/* Current Price */}
      <div className="relative rounded-xl p-5 text-center border-2 border-primary-500/30 bg-gradient-to-br from-surface-300 via-surface-200 to-surface-300 overflow-hidden">
        <div className="flex items-center justify-center gap-2 mb-2">
          <p className="text-sm text-primary-400 uppercase tracking-wider font-bold">Offerta Corrente</p>
        </div>
        <p className="text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-white to-primary-400 mb-2">
          {auction.currentPrice}
        </p>
        {auction.bids.length > 0 && auction.bids[0] && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
            auction.bids[0].bidder.user.username === currentUsername
              ? 'bg-green-500/20 border border-green-500/50'
              : 'bg-primary-500/20 border border-primary-500/30'
          }`}>
            <span className={`font-bold text-sm ${
              auction.bids[0].bidder.user.username === currentUsername ? 'text-green-400' : 'text-primary-300'
            }`}>
              {auction.bids[0].bidder.user.username}
              {auction.bids[0].bidder.user.username === currentUsername && ' (SEI TU!)'}
            </span>
          </div>
        )}
        {auction.bids.length === 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-400/50">
            <span className="text-gray-400 text-sm">Base d'asta:</span>
            <span className="text-white font-bold">{auction.basePrice}</span>
          </div>
        )}
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
        <div className="border-t border-surface-50/20 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-gray-400 font-medium">Storico Offerte</h4>
            <span className="text-[10px] text-gray-500">{auction.bids.length} offerte</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {auction.bids.map((bid, i) => (
              <div
                key={bid.id}
                className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs ${
                  i === 0
                    ? 'bg-primary-500/15 border border-primary-500/25'
                    : 'bg-surface-300/50'
                }`}
              >
                <span className={`${i === 0 ? 'text-white font-medium' : 'text-gray-300'} ${
                  bid.bidder.user.username === currentUsername ? 'text-secondary-400' : ''
                }`}>
                  {bid.bidder.user.username}
                  {bid.bidder.user.username === currentUsername && ' (tu)'}
                </span>
                <span className={`font-mono font-bold ${i === 0 ? 'text-primary-400' : 'text-white'}`}>
                  {bid.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
