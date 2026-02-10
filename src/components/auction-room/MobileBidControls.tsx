import { AuctionTimer } from '../AuctionTimer'
import type { Auction, Membership } from '../../types/auctionroom.types'

interface MobileBidControlsProps {
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

export function MobileBidControls({
  auction,
  timeLeft,
  timerSetting,
  isTimerExpired,
  isUserWinning,
  membership,
  bidAmount,
  setBidAmount,
  onPlaceBid,
}: MobileBidControlsProps) {
  if (!auction) return null

  return (
    <div className="bid-controls-sticky lg:hidden">
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-3 shadow-lg">
        {/* Timer + Current Price Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {auction.timerExpiresAt && (
              <AuctionTimer
                timeLeft={timeLeft}
                totalSeconds={timerSetting}
                compact={true}
              />
            )}
            <div>
              <p className="text-xs text-gray-400">{auction.player.name}</p>
              <p className="text-lg font-bold text-white">{auction.currentPrice}</p>
            </div>
          </div>
          {isUserWinning && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
              Vincendo
            </span>
          )}
        </div>

        {/* Quick Bid Buttons */}
        <div className="grid grid-cols-5 gap-1.5 mb-2">
          {[1, 5, 10, 20].map(n => {
            const newBid = parseInt(bidAmount || '0') + n
            return (
              <button
                key={n}
                onClick={() => setBidAmount(String(newBid))}
                disabled={isTimerExpired || (membership?.currentBudget || 0) < newBid}
                className={`py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
                  isTimerExpired || (membership?.currentBudget || 0) < newBid
                    ? 'bg-surface-400/50 text-gray-600 cursor-not-allowed'
                    : 'bg-primary-500/20 text-primary-400 border border-primary-500/30 active:scale-95'
                }`}
              >
                +{n}
              </button>
            )
          })}
          <button
            onClick={() => setBidAmount(String(membership?.currentBudget || 0))}
            disabled={isTimerExpired || !membership?.currentBudget}
            className={`py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
              isTimerExpired || !membership?.currentBudget
                ? 'bg-surface-400/50 text-gray-600 cursor-not-allowed'
                : 'bg-accent-500 text-dark-900 active:scale-95'
            }`}
          >
            MAX
          </button>
        </div>

        {/* Custom Bid Input with +/- */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
            disabled={isTimerExpired || parseInt(bidAmount || '0') <= auction.currentPrice + 1}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &minus;
          </button>
          <input
            type="number"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            disabled={isTimerExpired}
            className="flex-1 bg-surface-300 border border-surface-50/30 rounded-lg px-3 py-2 text-white text-center font-mono"
            placeholder="Importo..."
          />
          <button
            type="button"
            onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
            disabled={isTimerExpired || parseInt(bidAmount || '0') + 1 > (membership?.currentBudget || 0)}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
          <button
            onClick={onPlaceBid}
            disabled={isTimerExpired || !membership || membership.currentBudget < (parseInt(bidAmount) || 0)}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${
              isTimerExpired || !membership || membership.currentBudget < (parseInt(bidAmount) || 0)
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'btn-primary active:scale-95'
            }`}
          >
            {isTimerExpired ? 'Scaduto' : 'Offri'}
          </button>
        </div>
      </div>
    </div>
  )
}
