import { useState } from 'react'
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
  isBidding?: boolean
  isConnected?: boolean
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
  isBidding = false,
  isConnected = true,
}: BidControlsProps) {
  const bidNum = parseInt(bidAmount || '0')
  const [showMaxConfirm, setShowMaxConfirm] = useState(false)

  // Massive = +20 or whatever brings to budget (max)
  const massiveBid = Math.min(bidNum + 20, budget)

  // T-001/T-003: disable all controls when bidding or disconnected
  const isDisabled = isTimerExpired || isBidding || !isConnected

  // T-002: Check if bid is high (>= 75% of budget)
  function handleBidClick() {
    if (bidNum >= budget * 0.75) {
      setShowMaxConfirm(true)
    } else {
      onPlaceBid()
    }
  }

  function handleMaxClick() {
    setBidAmount(String(budget))
    setShowMaxConfirm(true)
  }

  function confirmHighBid() {
    setShowMaxConfirm(false)
    onPlaceBid()
  }

  return (
    <div className={`space-y-2 ${compact ? '' : 'bg-slate-800/40 backdrop-blur rounded-xl p-4 border border-white/5'}`}>
      {/* T-003: Connection lost banner */}
      {!isConnected && (
        <div className="rounded-lg p-2.5 bg-red-500/10 border border-red-500/30 flex items-center gap-2">
          <span className="text-red-400 text-sm">&#9889;</span>
          <span className="text-red-400 text-sm font-semibold">Connessione persa — riconnessione in corso...</span>
        </div>
      )}

      {/* T-002: MAX bid confirmation modal */}
      {showMaxConfirm && (
        <div className="rounded-xl p-4 bg-surface-300 border-2 border-amber-500/50 space-y-3">
          <div className="text-center">
            <p className="text-amber-400 font-bold text-base">Conferma offerta elevata</p>
            <p className="text-gray-300 text-sm mt-1">
              Stai per offrire <span className="text-white font-mono font-bold">{bidNum}</span> crediti
              {bidNum >= budget && ' (tutto il budget)'}
              {bidNum < budget && bidNum >= budget * 0.75 && ` (${Math.round(bidNum / budget * 100)}% del budget)`}
            </p>
            <p className="text-gray-400 text-xs mt-1">Budget residuo: {budget - bidNum}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMaxConfirm(false)}
              className="flex-1 py-2 rounded-lg text-sm font-bold bg-slate-700/50 text-gray-300 hover:bg-slate-700/70 border border-white/10 min-h-[44px]"
            >
              Annulla
            </button>
            <button
              onClick={confirmHighBid}
              className="flex-1 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-red-500 to-orange-500 text-white active:scale-95 min-h-[44px]"
            >
              Conferma {bidNum}
            </button>
          </div>
        </div>
      )}

      {/* Quick Bid Buttons */}
      <div className="grid grid-cols-6 gap-1.5">
        {[1, 5, 10].map(n => {
          const newBid = bidNum + n
          return (
            <button
              key={n}
              onClick={() => setBidAmount(String(newBid))}
              disabled={isDisabled || budget < newBid}
              className={`py-2 rounded-lg text-sm font-bold font-mono transition-all min-h-[44px] ${
                isDisabled || budget < newBid
                  ? 'bg-slate-700/30 text-gray-500 cursor-not-allowed'
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
          disabled={isDisabled || budget < bidNum + 1}
          className={`py-2 rounded-lg text-sm font-bold font-mono transition-all min-h-[44px] col-span-1 ${
            isDisabled || budget < bidNum + 1
              ? 'bg-slate-700/30 text-gray-500 cursor-not-allowed'
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
        {/* T-002: MAX button triggers confirmation */}
        <button
          onClick={handleMaxClick}
          disabled={isDisabled || !budget}
          className={`py-2 rounded-lg text-sm font-bold font-mono transition-all min-h-[44px] col-span-2 ${
            isDisabled || !budget
              ? 'bg-slate-700/30 text-gray-500 cursor-not-allowed'
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
          disabled={isDisabled || bidNum <= currentPrice + 1}
          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-slate-700/50 text-white hover:bg-slate-700/70 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] border border-white/5 active:scale-95 transition-transform"
        >
          -
        </button>
        {compact ? (
          <input
            type="number"
            inputMode="numeric"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            disabled={isDisabled}
            className="flex-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-white text-center font-mono focus:border-sky-500 focus:outline-none"
            placeholder="Importo..."
            data-bid-input="true"
          />
        ) : (
          <Input
            type="number"
            inputMode="numeric"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            disabled={isDisabled}
            className="flex-1 text-sml text-center bg-slate-800/60 border-white/10 text-white font-mono"
            placeholder="Importo..."
            data-bid-input="true"
          />
        )}
        <button
          type="button"
          onClick={() => setBidAmount(String(bidNum + 1))}
          disabled={isDisabled || bidNum + 1 > budget}
          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-slate-700/50 text-white hover:bg-slate-700/70 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] border border-white/5 active:scale-95 transition-transform"
        >
          +
        </button>
        {/* T-001: Main bid button with loading state */}
        <button
          onClick={handleBidClick}
          disabled={isDisabled || budget < bidNum}
          className={`px-6 py-2 rounded-lg font-bold font-mono transition-all min-h-[44px] ${
            isDisabled || budget < bidNum
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-sky-500 hover:bg-sky-400 text-white active:scale-95 shadow-lg shadow-sky-500/20'
          }`}
        >
          {isBidding ? (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            </span>
          ) : isTimerExpired ? 'Scaduto' : `${bidNum}`}
        </button>
      </div>

      {/* Budget reminder */}
      {!compact && (
        <div className="flex items-center justify-between text-sms text-gray-400">
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
