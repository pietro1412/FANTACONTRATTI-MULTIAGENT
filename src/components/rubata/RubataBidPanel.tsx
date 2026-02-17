import { Button } from '../ui/Button'
import type { ActiveAuction } from '../../types/rubata.types'

interface RubataBidPanelProps {
  activeAuction: ActiveAuction
  myMemberId: string | undefined
  bidAmount: number
  setBidAmount: (v: number | ((prev: number) => number)) => void
  isSubmitting: boolean
  onBid: () => void
}

export function RubataBidPanel({
  activeAuction,
  myMemberId,
  bidAmount,
  setBidAmount,
  isSubmitting,
  onBid,
}: RubataBidPanelProps) {
  return (
    <div className="mb-6 bg-surface-200 rounded-2xl border-4 border-danger-500 overflow-hidden auction-highlight shadow-2xl">
      <div className="p-5 border-b border-surface-50/20 bg-gradient-to-r from-danger-600/30 via-danger-500/20 to-danger-600/30">
        <h3 className="text-xl font-black text-danger-400 flex items-center justify-center gap-3 uppercase tracking-wide">
          <span className="text-3xl animate-pulse">🔥</span>
          <span className="text-white">ASTA IN CORSO</span>
          <span className="text-3xl animate-pulse">🔥</span>
        </h3>
        <p className="text-center text-2xl font-bold text-white mt-2">
          {activeAuction.player.name}
        </p>
      </div>
      <div className="p-5">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="bg-surface-300 p-4 rounded-xl border border-surface-50/20 mb-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">Base</p>
                  <p className="font-bold text-white text-xl">{activeAuction.basePrice}M</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Offerta attuale</p>
                  <p className="font-bold text-primary-400 text-2xl">{activeAuction.currentPrice}M</p>
                </div>
              </div>
            </div>

            {/* Bid Form - only if not the seller */}
            {activeAuction.sellerId !== myMemberId && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setBidAmount(prev => Math.max(activeAuction.currentPrice + 1, prev - 1)); }}
                    disabled={bidAmount <= activeAuction.currentPrice + 1}
                    className="w-12 h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-2xl font-bold hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setBidAmount(Math.max(activeAuction.currentPrice + 1, val))
                      }}
                      className="w-full text-center text-3xl font-bold bg-transparent text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={activeAuction.currentPrice + 1}
                    />
                    <p className="text-xs text-gray-500">Min: {activeAuction.currentPrice + 1}M</p>
                  </div>
                  <button
                    onClick={() => { setBidAmount(prev => prev + 1); }}
                    className="w-12 h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-2xl font-bold hover:bg-surface-200 transition-all"
                  >
                    +
                  </button>
                </div>
                <Button
                  onClick={onBid}
                  disabled={isSubmitting || bidAmount <= activeAuction.currentPrice}
                  className="w-full py-3 text-lg"
                >
                  RILANCIA {bidAmount}M
                </Button>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-medium text-white mb-3">Ultime offerte</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeAuction.bids.length === 0 ? (
                <p className="text-gray-500 text-sm">Nessuna offerta ancora</p>
              ) : (
                activeAuction.bids.map((bid, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl ${bid.isWinning ? 'bg-secondary-500/20 border border-secondary-500/40' : 'bg-surface-300 border border-surface-50/20'}`}
                  >
                    <span className="font-medium text-white">{bid.bidder}</span>
                    <span className="ml-2 font-mono text-primary-400">{bid.amount}M</span>
                    {bid.isWinning && (
                      <span className="ml-2 text-secondary-400 text-sm font-medium">✓ Vincente</span>
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
