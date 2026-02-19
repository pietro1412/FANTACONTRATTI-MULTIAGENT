import { Button } from '../ui/Button'
import type { ActiveAuction } from '../../types/rubata.types'

interface RubataBidPanelProps {
  activeAuction: ActiveAuction
  myMemberId: string | undefined
  bidAmount: number
  setBidAmount: (v: number | ((prev: number) => number)) => void
  isSubmitting: boolean
  onBid: () => void
  myBudget?: number | null
}

export function RubataBidPanel({
  activeAuction,
  myMemberId,
  bidAmount,
  setBidAmount,
  isSubmitting,
  onBid,
  myBudget,
}: RubataBidPanelProps) {
  const isUserWinning = activeAuction.bids.length > 0 && activeAuction.bids[0]?.bidderId === myMemberId
  const isSeller = activeAuction.sellerId === myMemberId
  const minBid = activeAuction.currentPrice + 1
  const budget = myBudget ?? Infinity

  const quickBidAmounts = [1, 5, 10, 20] as const

  return (
    <div className="mb-6 bg-surface-200 rounded-2xl border-4 border-danger-500 overflow-hidden auction-highlight shadow-2xl">
      {/* Header */}
      <div className="p-5 border-b border-surface-50/20 bg-gradient-to-r from-danger-600/30 via-danger-500/20 to-danger-600/30">
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl animate-pulse">🔥</span>
          <div className="text-center">
            <h3 className="text-xl font-black text-danger-400 uppercase tracking-wide">ASTA IN CORSO</h3>
            <p className="text-2xl font-bold text-white mt-1">{activeAuction.player.name}</p>
          </div>
          <span className="text-3xl animate-pulse">🔥</span>
        </div>
        {/* Winning badge */}
        {isUserWinning && (
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-secondary-500/20 border border-secondary-500/40 text-secondary-400 font-bold text-sm animate-pulse">
              ✅ Stai vincendo!
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            {/* Price display */}
            <div className="bg-surface-300 p-4 rounded-xl border border-surface-50/20 mb-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">Base</p>
                  <p className="font-bold text-white text-xl">{activeAuction.basePrice}M</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Offerta attuale</p>
                  <p className={`font-bold text-2xl font-mono ${isUserWinning ? 'text-secondary-400' : 'text-primary-400'}`}>
                    {activeAuction.currentPrice}M
                  </p>
                </div>
              </div>
            </div>

            {/* Bid Form - only if not the seller */}
            {!isSeller && (
              <div className="space-y-3">
                {/* Quick bid buttons */}
                <div className="grid grid-cols-5 gap-1.5">
                  {quickBidAmounts.map((increment) => (
                    <button
                      key={increment}
                      onClick={() => { setBidAmount(activeAuction.currentPrice + increment); }}
                      disabled={isSubmitting || activeAuction.currentPrice + increment > budget}
                      className={`py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 min-h-[44px] ${
                        increment === 20
                          ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-400 hover:to-orange-400 disabled:opacity-30 disabled:cursor-not-allowed'
                          : 'bg-sky-500/20 border border-sky-500/30 text-sky-400 hover:bg-sky-500/30 disabled:opacity-30 disabled:cursor-not-allowed'
                      }`}
                    >
                      +{increment}
                    </button>
                  ))}
                  <button
                    onClick={() => { setBidAmount(Math.floor(budget)); }}
                    disabled={isSubmitting || budget <= activeAuction.currentPrice}
                    className="py-2.5 rounded-lg text-sm font-bold bg-accent-500 text-dark-900 hover:bg-accent-400 transition-all active:scale-95 min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    MAX
                  </button>
                </div>

                {/* Manual input with +/- */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setBidAmount(prev => Math.max(minBid, prev - 1)); }}
                    disabled={bidAmount <= minBid}
                    className="w-12 h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-2xl font-bold hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={bidAmount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setBidAmount(Math.max(minBid, val))
                      }}
                      className="w-full text-center text-3xl font-bold bg-transparent text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={minBid}
                    />
                    <p className="text-xs text-gray-500">Min: {minBid}M</p>
                  </div>
                  <button
                    onClick={() => { setBidAmount(prev => prev + 1); }}
                    disabled={isSubmitting}
                    className="w-12 h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-2xl font-bold hover:bg-surface-200 transition-all active:scale-95"
                  >
                    +
                  </button>
                </div>

                {/* Submit button */}
                <Button
                  onClick={onBid}
                  disabled={isSubmitting || bidAmount <= activeAuction.currentPrice || bidAmount > budget}
                  className="w-full py-3 text-lg"
                >
                  RILANCIA {bidAmount}M
                </Button>

                {/* Budget reminder */}
                {myBudget != null && (
                  <div className="flex items-center justify-between text-sm px-1">
                    <span className="text-gray-500">Il tuo budget:</span>
                    <span className={`font-bold font-mono ${myBudget < 50 ? 'text-warning-400' : 'text-accent-400'}`}>
                      {myBudget}M
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bid history */}
          <div>
            <h4 className="font-medium text-white mb-3">Ultime offerte</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeAuction.bids.length === 0 ? (
                <p className="text-gray-500 text-sm">Nessuna offerta ancora</p>
              ) : (
                activeAuction.bids.map((bid, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl ${
                      bid.isWinning
                        ? 'bg-secondary-500/20 border border-secondary-500/40'
                        : bid.bidderId === myMemberId
                        ? 'bg-primary-500/10 border border-primary-500/30'
                        : 'bg-surface-300 border border-surface-50/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${bid.bidderId === myMemberId ? 'text-primary-400' : 'text-white'}`}>
                        {bid.bidder}
                      </span>
                      <span className="font-mono font-bold text-primary-400">{bid.amount}M</span>
                    </div>
                    {bid.isWinning && (
                      <span className="text-secondary-400 text-sm font-medium">✓ Vincente</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
