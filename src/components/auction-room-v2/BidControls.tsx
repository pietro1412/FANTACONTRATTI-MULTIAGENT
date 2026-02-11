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

  // Massive = +20 or whatever brings to budget (max)
  const massiveBid = Math.min(bidNum + 20, budget)

  return (
    <div className={`space-y-2 ${compact ? '' : 'bg-slate-800/40 backdrop-blur rounded-xl p-4 border border-white/5'}`}>
      {/* Quick Bid Buttons */}
      <div className="grid grid-cols-6 gap-1.5">
        {[1, 5, 10].map(n => {
          const newBid = bidNum + n
          return (
            <button
              key={n}
              onClick={() => setBidAmount(String(newBid))}
              disabled={isTimerExpired || budget < newBid}
              className={`py-2 rounded-lg text-sm font-bold font-mono transition-all min-h-[44px] ${
                isTimerExpired || budget < newBid
                  ? 'bg-slate-700/30 text-gray-600 cursor-not-allowed'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30 active:scale-95 hover:bg-sky-500/30'
              }`}
            >
              +{n}
            </button>
          )
        })}
        {/* Massive button */}
        <button
          onClick={() => setBidAmount(String(massiveBid))}
          disabled={isTimerExpired || budget < bidNum + 1}
          className={`py-2 rounded-lg text-sm font-bold font-mono transition-all min-h-[44px] col-span-1 ${
            isTimerExpired || budget < bidNum + 1
              ? 'bg-slate-700/30 text-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-red-500 to-orange-500 text-white active:scale-95 hover:from-red-400 hover:to-orange-400 shadow-lg shadow-red-500/20'
          }`}
        >
          <span className="flex items-center justify-center gap-0.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            +20
          </span>
        </button>
        <button
          onClick={() => setBidAmount(String(budget))}
          disabled={isTimerExpired || !budget}
          className={`py-2 rounded-lg text-sm font-bold font-mono transition-all min-h-[44px] col-span-2 ${
            isTimerExpired || !budget
              ? 'bg-slate-700/30 text-gray-600 cursor-not-allowed'
              : 'bg-accent-500 text-dark-900 active:scale-95 hover:bg-accent-400'
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
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-slate-700/50 text-white hover:bg-slate-700/70 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] border border-white/5"
        >
          -
        </button>
        {compact ? (
          <input
            type="number"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            disabled={isTimerExpired}
            className="flex-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-white text-center font-mono focus:border-sky-500 focus:outline-none"
            placeholder="Importo..."
            data-bid-input="true"
          />
        ) : (
          <Input
            type="number"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            disabled={isTimerExpired}
            className="flex-1 text-xl text-center bg-slate-800/60 border-white/10 text-white font-mono"
            placeholder="Importo..."
            data-bid-input="true"
          />
        )}
        <button
          type="button"
          onClick={() => setBidAmount(String(bidNum + 1))}
          disabled={isTimerExpired || bidNum + 1 > budget}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-slate-700/50 text-white hover:bg-slate-700/70 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] border border-white/5"
        >
          +
        </button>
        <button
          onClick={onPlaceBid}
          disabled={isTimerExpired || budget < bidNum}
          className={`px-6 py-2 rounded-lg font-bold font-mono transition-all min-h-[44px] ${
            isTimerExpired || budget < bidNum
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-sky-500 hover:bg-sky-400 text-white active:scale-95 shadow-lg shadow-sky-500/20'
          }`}
        >
          {isTimerExpired ? 'Scaduto' : `${bidNum}`}
        </button>
      </div>

      {/* Budget reminder */}
      {!compact && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Il tuo budget:</span>
          <span className="font-bold font-mono text-accent-400">{budget}</span>
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
