import { AuctionTimer } from '../AuctionTimer'
import { BidControls } from './BidControls'
import type { Auction, Membership } from '../../types/auctionroom.types'

interface MobileBottomBarProps {
  auction: Auction | null
  timeLeft: number | null
  timerSetting: number
  isTimerExpired: boolean
  isUserWinning: boolean
  membership: Membership | null
  bidAmount: string
  setBidAmount: (val: string) => void
  onPlaceBid: () => void
}

export function MobileBottomBar({
  auction,
  timeLeft,
  timerSetting,
  isTimerExpired,
  isUserWinning,
  membership,
  bidAmount,
  setBidAmount,
  onPlaceBid,
}: MobileBottomBarProps) {
  if (!auction) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="bg-surface-200 border-t border-surface-50/20 p-3 shadow-2xl">
        {/* Timer + Current Info */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {auction.timerExpiresAt && (
              <AuctionTimer timeLeft={timeLeft} totalSeconds={timerSetting} compact />
            )}
            <div>
              <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{auction.player.name}</p>
              <p className="text-lg font-bold text-white">{auction.currentPrice}</p>
            </div>
          </div>
          {isUserWinning && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] rounded-full font-medium">
              Vincendo
            </span>
          )}
        </div>

        {/* Bid Controls */}
        <BidControls
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          onPlaceBid={onPlaceBid}
          currentPrice={auction.currentPrice}
          isTimerExpired={isTimerExpired}
          budget={membership?.currentBudget || 0}
          compact
        />
      </div>
    </div>
  )
}
