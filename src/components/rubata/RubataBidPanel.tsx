import { useState } from 'react'
import { Button } from '../ui/Button'
import { TeamLogo } from './TeamLogo'
import { POSITION_COLORS } from '../../types/rubata.types'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import type { ActiveAuction } from '../../types/rubata.types'

interface RubataBidPanelProps {
  activeAuction: ActiveAuction
  myMemberId: string | undefined
  bidAmount: number
  setBidAmount: (v: number | ((prev: number) => number)) => void
  isSubmitting: boolean
  onBid: () => void
  myBudget?: number | null
  myMaxBid?: number | null
}

export function RubataBidPanel({
  activeAuction,
  myMemberId,
  bidAmount,
  setBidAmount,
  isSubmitting,
  onBid,
  myBudget,
  myMaxBid,
}: RubataBidPanelProps) {
  const [highBidConfirmed, setHighBidConfirmed] = useState(false)

  const isUserWinning = activeAuction.bids.length > 0 && activeAuction.bids[0]?.bidderId === myMemberId
  const isSeller = activeAuction.sellerId === myMemberId
  const minBid = activeAuction.currentPrice + 1
  const budget = myBudget ?? Infinity
  const isHighBid = myBudget != null && bidAmount >= budget * 0.75

  const quickBidAmounts = [1, 5, 10, 20] as const

  // Reset confirmation when bid amount changes below threshold
  const handleSetBidAmount = (v: number | ((prev: number) => number)) => {
    setHighBidConfirmed(false)
    setBidAmount(v)
  }

  const handleBidClick = () => {
    if (isHighBid && !highBidConfirmed) {
      setHighBidConfirmed(true)
      return
    }
    setHighBidConfirmed(false)
    onBid()
  }

  return (
    <div className="mb-6 bg-surface-200 rounded-2xl border-4 border-danger-500 overflow-hidden auction-highlight shadow-2xl animate-[fadeIn_0.3s_ease-out]">
      {/* Header with player card */}
      <div className="p-3 md:p-5 border-b border-surface-50/20 bg-gradient-to-r from-danger-600/30 via-danger-500/20 to-danger-600/30">
        <h3 className="text-center text-lg md:text-xl font-black text-danger-400 uppercase tracking-wide mb-2 md:mb-3">
          <span className="inline-block animate-pulse">🔥</span> ASTA IN CORSO <span className="inline-block animate-pulse">🔥</span>
        </h3>

        {/* Player card — pattern Svincolati */}
        <div className="text-center p-3 md:p-4 bg-surface-300/50 rounded-xl border border-surface-50/20">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-3">
            {activeAuction.player.apiFootballId && (
              <img
                src={getPlayerPhotoUrl(activeAuction.player.apiFootballId)}
                alt={activeAuction.player.name}
                className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-bold border ${POSITION_COLORS[activeAuction.player.position] ?? ''}`}>
              {activeAuction.player.position}
            </span>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg p-0.5 md:p-1">
              <TeamLogo team={activeAuction.player.team} />
            </div>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-0.5 md:mb-1 truncate">{activeAuction.player.name}</h2>
          <p className="text-sm md:text-base text-gray-400">{activeAuction.player.team}</p>
        </div>

        {/* Winning badge */}
        {isUserWinning && (
          <div className="mt-3 flex justify-center animate-[fadeIn_0.3s_ease-out]">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-secondary-500/20 border border-secondary-500/40 text-secondary-400 font-bold text-sm animate-pulse">
              ✅ Stai vincendo!
            </span>
          </div>
        )}
      </div>

      <div className="p-3 md:p-5">
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <div>
            {/* Price display — gradient + urgency */}
            <div className={`bg-surface-300 p-3 md:p-4 rounded-xl border mb-3 md:mb-4 transition-all ${
              isUserWinning
                ? 'border-secondary-500/40 bg-secondary-500/5'
                : 'border-surface-50/20'
            }`}>
              <div className="grid grid-cols-2 gap-2 md:gap-4 text-center">
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Base</p>
                  <p className="font-bold text-white text-lg md:text-xl">{activeAuction.basePrice}M</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Offerta attuale</p>
                  <p
                    className={`font-black font-mono transition-all ${
                      isUserWinning
                        ? 'text-2xl md:text-3xl text-secondary-400'
                        : 'text-2xl md:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400 animate-pulse'
                    }`}
                    aria-live="polite"
                    aria-label={`Offerta attuale: ${activeAuction.currentPrice} milioni`}
                  >
                    {activeAuction.currentPrice}M
                  </p>
                  {/* Highest bidder label */}
                  {activeAuction.bids.length > 0 && (
                    <p className={`text-xs mt-1 ${isUserWinning ? 'text-secondary-400' : 'text-gray-500'}`}>
                      {isUserWinning ? '👤 Tu' : `👤 ${activeAuction.bids[0]?.bidder ?? ''}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bid Form - only if not the seller */}
            {!isSeller && (
              <div className="space-y-3">
                {/* Quick bid buttons — 3 cols mobile, 5 cols desktop */}
                <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
                  {quickBidAmounts.map((increment) => (
                    <button
                      key={increment}
                      onClick={() => { handleSetBidAmount(activeAuction.currentPrice + increment); }}
                      disabled={isSubmitting || activeAuction.currentPrice + increment > budget}
                      className={`py-2 md:py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 min-h-[44px] ${
                        increment === 20
                          ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-400 hover:to-orange-400 disabled:opacity-30 disabled:cursor-not-allowed'
                          : 'bg-sky-500/20 border border-sky-500/30 text-sky-400 hover:bg-sky-500/30 disabled:opacity-30 disabled:cursor-not-allowed'
                      }`}
                    >
                      +{increment}
                    </button>
                  ))}
                  <button
                    onClick={() => { handleSetBidAmount(Math.floor(budget)); }}
                    disabled={isSubmitting || budget <= activeAuction.currentPrice}
                    className="py-2 md:py-2.5 rounded-lg text-sm font-bold bg-accent-500 text-dark-900 hover:bg-accent-400 transition-all active:scale-95 min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    MAX
                  </button>
                </div>

                {/* Manual input with +/- */}
                <div className="flex items-center gap-1.5 md:gap-2">
                  <button
                    onClick={() => { handleSetBidAmount(prev => Math.max(minBid, prev - 1)); }}
                    disabled={bidAmount <= minBid}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-xl md:text-2xl font-bold hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex-shrink-0"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center min-w-0">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={bidAmount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        handleSetBidAmount(Math.max(minBid, val))
                      }}
                      className="w-full text-center text-2xl md:text-3xl font-bold bg-transparent text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={minBid}
                    />
                    <p className="text-xs text-gray-500">Min: {minBid}M</p>
                  </div>
                  <button
                    onClick={() => { handleSetBidAmount(prev => prev + 1); }}
                    disabled={isSubmitting}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-xl md:text-2xl font-bold hover:bg-surface-200 transition-all active:scale-95 flex-shrink-0"
                  >
                    +
                  </button>
                </div>

                {/* High bid warning */}
                {isHighBid && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-500/20 border border-warning-500/40 animate-[fadeIn_0.2s_ease-out]">
                    <span className="text-warning-400 text-lg">⚠️</span>
                    <span className="text-warning-400 text-sm font-medium">
                      Stai offrendo il {Math.round((bidAmount / budget) * 100)}% del tuo bilancio!
                    </span>
                  </div>
                )}

                {/* maxBid strategy warning */}
                {myMaxBid != null && activeAuction.currentPrice >= myMaxBid && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-500/20 border border-danger-500/40 animate-[fadeIn_0.2s_ease-out]">
                    <span className="text-danger-400 text-lg">🚫</span>
                    <span className="text-danger-400 text-sm font-bold">
                      OLTRE IL LIMITE — la tua strategia era max {myMaxBid}M
                    </span>
                  </div>
                )}
                {myMaxBid != null && activeAuction.currentPrice < myMaxBid && activeAuction.currentPrice >= myMaxBid * 0.8 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/20 border border-orange-500/40 animate-[fadeIn_0.2s_ease-out]">
                    <span className="text-orange-400 text-lg">⚡</span>
                    <span className="text-orange-400 text-sm font-medium">
                      Vicino al tuo limite strategia ({myMaxBid}M)
                    </span>
                  </div>
                )}

                {/* Submit button */}
                <Button
                  onClick={handleBidClick}
                  disabled={isSubmitting || bidAmount <= activeAuction.currentPrice || bidAmount > budget}
                  className={`w-full py-3 text-lg transition-all active:scale-[0.98] ${
                    highBidConfirmed ? 'animate-pulse' : ''
                  }`}
                  variant={highBidConfirmed ? 'danger' : undefined}
                >
                  {highBidConfirmed ? `⚠️ CONFERMA ${bidAmount}M` : `RILANCIA ${bidAmount}M`}
                </Button>

                {/* Budget reminder */}
                {myBudget != null && (
                  <div className="flex items-center justify-between text-sm px-1">
                    <span className="text-gray-500">Il tuo bilancio:</span>
                    <span className={`font-bold font-mono ${myBudget < 50 ? 'text-warning-400' : 'text-accent-400'}`}>
                      {myBudget}M
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bid history — enhanced styling */}
          <div>
            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
              <span>📜</span> Ultime offerte
              {activeAuction.bids.length > 0 && (
                <span className="text-xs text-gray-500 font-normal">({activeAuction.bids.length})</span>
              )}
            </h4>
            <div className="space-y-2 max-h-32 md:max-h-48 overflow-y-auto">
              {activeAuction.bids.length === 0 ? (
                <p className="text-gray-500 text-sm">Nessuna offerta ancora</p>
              ) : (
                activeAuction.bids.map((bid, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl transition-all animate-[fadeIn_0.2s_ease-out] ${
                      bid.isWinning
                        ? 'bg-secondary-500/20 border border-secondary-500/40'
                        : bid.bidderId === myMemberId
                        ? 'bg-primary-500/10 border border-primary-500/30'
                        : 'bg-surface-300 border border-surface-50/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Winning star icon */}
                        {bid.isWinning && (
                          <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </span>
                        )}
                        <span className={`font-medium truncate ${
                          bid.bidderId === myMemberId ? 'text-primary-400' : 'text-white'
                        }`}>
                          {bid.bidderId === myMemberId ? `${bid.bidder} (Tu)` : bid.bidder}
                        </span>
                      </div>
                      <span className={`font-mono font-bold flex-shrink-0 ${
                        bid.isWinning ? 'text-secondary-400' : 'text-primary-400'
                      }`}>
                        {bid.amount}M
                      </span>
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
