import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface BidControlsProps {
  bidAmount: string
  setBidAmount: (amount: string) => void
  onPlaceBid: () => void
  currentPrice: number
  isTimerExpired: boolean
  budget: number
  isAdmin?: boolean
  onCloseAuction?: () => void
  compact?: boolean
}

export function BidControls({
  bidAmount,
  setBidAmount,
  onPlaceBid,
  currentPrice,
  isTimerExpired,
  budget,
  isAdmin,
  onCloseAuction,
  compact,
}: BidControlsProps) {
  const bidNum = parseInt(bidAmount || '0')

  return (
    <div className={`space-y-2 ${compact ? '' : 'bg-surface-300/50 rounded-xl p-4'}`}>
      {/* Quick Bid Buttons */}
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 5, 10, 20].map(n => {
          const newBid = bidNum + n
          return (
            <button
              key={n}
              onClick={() => setBidAmount(String(newBid))}
              disabled={isTimerExpired || budget < newBid}
              className={`py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
                isTimerExpired || budget < newBid
                  ? 'bg-surface-400/50 text-gray-600 cursor-not-allowed'
                  : 'bg-primary-500/20 text-primary-400 border border-primary-500/30 active:scale-95'
              }`}
            >
              +{n}
            </button>
          )
        })}
        <button
          onClick={() => setBidAmount(String(budget))}
          disabled={isTimerExpired || !budget}
          className={`py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
            isTimerExpired || !budget
              ? 'bg-surface-400/50 text-gray-600 cursor-not-allowed'
              : 'bg-accent-500 text-dark-900 active:scale-95'
          }`}
        >
          MAX
        </button>
      </div>

      {/* Main Bid Input with +/- */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setBidAmount(String(Math.max(currentPrice + 1, bidNum - 1)))}
          disabled={isTimerExpired || bidNum <= currentPrice + 1}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          −
        </button>
        {compact ? (
          <input
            type="number"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            disabled={isTimerExpired}
            className="flex-1 bg-surface-300 border border-surface-50/30 rounded-lg px-3 py-2 text-white text-center font-mono"
            placeholder="Importo..."
            data-bid-input="true"
          />
        ) : (
          <Input
            type="number"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            disabled={isTimerExpired}
            className="flex-1 text-xl text-center bg-surface-300 border-surface-50/30 text-white font-mono"
            placeholder="Importo..."
            data-bid-input="true"
          />
        )}
        <button
          type="button"
          onClick={() => setBidAmount(String(bidNum + 1))}
          disabled={isTimerExpired || bidNum + 1 > budget}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          +
        </button>
        <button
          onClick={onPlaceBid}
          disabled={isTimerExpired || budget < bidNum}
          className={`px-6 py-2 rounded-lg font-bold transition-all min-h-[44px] ${
            isTimerExpired || budget < bidNum
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'btn-primary active:scale-95'
          }`}
        >
          {isTimerExpired ? 'Scaduto' : 'Offri'}
        </button>
      </div>

      {/* Budget reminder */}
      {!compact && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Il tuo budget:</span>
          <span className="font-bold text-accent-400">{budget}</span>
        </div>
      )}

      {/* Admin close auction */}
      {isAdmin && onCloseAuction && !compact && (
        <Button variant="secondary" onClick={onCloseAuction} className="w-full mt-2">
          Chiudi Asta Manualmente
        </Button>
      )}
    </div>
  )
}
