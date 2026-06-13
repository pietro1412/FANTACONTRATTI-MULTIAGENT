import { useState } from 'react'

export interface BidControlsSharedProps {
  bidAmount: number
  setBidAmount: (amount: number) => void
  onPlaceBid: () => void
  /** Offerta corrente sul piatto: il rilancio minimo è currentPrice + 1 */
  currentPrice: number
  /** Tetto massimo offribile (budget asta / bilancio rubata) */
  budget: number
  /** Nome della risorsa nei warning: "budget" (asta) o "bilancio" (rubata) */
  budgetLabel?: string
  /** Limite di strategia personale (rubata): warning vicino, alert oltre */
  strategyMaxBid?: number | null
  /** T-001: rilancio in corso — spinner e controlli disabilitati */
  isSubmitting?: boolean
  /** Disabilitazione esterna (timer scaduto, non in gara) */
  isDisabled?: boolean
  /** Etichetta del bottone quando isDisabled (es. "Scaduto") */
  disabledLabel?: string
  /** T-003: connessione persa — banner e controlli disabilitati */
  isConnected?: boolean
  /** Verbo del bottone principale: "Rilancia" (default) o "Offri" (svincolati) */
  actionLabel?: string
  /** Spaziature ridotte (arena orizzontale rubata) */
  compact?: boolean
}

const QUICK_BIDS = [1, 5, 10, 20] as const

/**
 * P3 — Controlli di rilancio condivisi asta/rubata (mockup cockpit):
 * quick bid +1/+5/+10 blu e +20 passion, MAX oro, stepper [−][importo][+],
 * RILANCIA verde con glow, warning soglie budget/strategia.
 * Flussi testati preservati: T-001 (loading), T-002 (conferma offerta
 * elevata ≥75% o MAX), T-003 (connessione persa).
 */
export function BidControlsShared({
  bidAmount,
  setBidAmount,
  onPlaceBid,
  currentPrice,
  budget,
  budgetLabel = 'budget',
  strategyMaxBid = null,
  isSubmitting = false,
  isDisabled = false,
  disabledLabel = 'Scaduto',
  isConnected = true,
  actionLabel = 'Rilancia',
}: BidControlsSharedProps) {
  const [showHighConfirm, setShowHighConfirm] = useState(false)

  const minBid = currentPrice + 1
  const isLocked = isDisabled || isSubmitting || !isConnected
  const hasBudget = Number.isFinite(budget) && budget > 0
  const isHighBid = hasBudget && bidAmount >= budget * 0.75

  // T-002: high bid (>= 75% budget) and MAX require explicit confirmation
  function handleBidClick() {
    if (isHighBid && !showHighConfirm) {
      setShowHighConfirm(true)
      return
    }
    setShowHighConfirm(false)
    onPlaceBid()
  }

  function handleMaxClick() {
    setBidAmount(Math.floor(budget))
    setShowHighConfirm(true)
  }

  function updateBid(value: number) {
    setShowHighConfirm(false)
    setBidAmount(value)
  }

  return (
    <div className="space-y-2">
      {/* T-003: connection lost banner */}
      {!isConnected && (
        <div className="rounded-lg p-2.5 bg-danger-500/10 border border-danger-500/30 flex items-center gap-2">
          <span className="text-danger-400 text-sm font-semibold">
            Connessione persa — riconnessione in corso...
          </span>
        </div>
      )}

      {/* T-002: high bid confirmation */}
      {showHighConfirm && (
        <div className="rounded-xl p-3 bg-surface-300 border-2 border-accent-500/50 space-y-2.5">
          <div className="text-center">
            <p className="text-accent-400 font-display font-bold text-base">Conferma offerta elevata</p>
            <p className="text-gray-300 text-sm mt-1">
              Stai per offrire <span className="text-white font-mono font-bold">{bidAmount}M</span>
              {hasBudget && bidAmount >= budget && ` (tutto il ${budgetLabel})`}
              {hasBudget && bidAmount < budget && ` (${Math.round((bidAmount / budget) * 100)}% del ${budgetLabel})`}
            </p>
            {hasBudget && (
              <p className="text-gray-400 text-xs mt-1">Residuo dopo l'offerta: {budget - bidAmount}M</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowHighConfirm(false); }}
              className="flex-1 py-2 rounded-lg text-sm font-bold bg-surface-100/50 text-gray-300 hover:bg-surface-100/70 border border-surface-50 min-h-[44px]"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleBidClick}
              disabled={isLocked}
              className="flex-1 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-danger-500 to-passion-500 text-white active:scale-95 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Conferma {bidAmount}M
            </button>
          </div>
        </div>
      )}

      {/* Quick bid row: +1/+5/+10 blu · +20 passion · MAX oro */}
      <div className="grid grid-cols-5 gap-1.5">
        {QUICK_BIDS.map(n => {
          const newBid = bidAmount + n
          const disabled = isLocked || newBid > budget
          return (
            <button
              key={n}
              type="button"
              onClick={() => { updateBid(newBid); }}
              disabled={disabled}
              className={`py-2 rounded-[9px] stat-number text-base transition-all min-h-[44px] active:scale-95 ${
                disabled
                  ? 'bg-surface-100/30 text-gray-500 cursor-not-allowed'
                  : n === 20
                    ? 'bg-passion-500/10 text-passion-400 border border-passion-500/50 hover:bg-passion-500/20'
                    : 'bg-primary-500/10 text-primary-400 border border-primary-500/45 hover:bg-primary-500/20'
              }`}
            >
              +{n}
            </button>
          )
        })}
        {/* T-002: MAX triggers confirmation */}
        <button
          type="button"
          onClick={handleMaxClick}
          disabled={isLocked || !hasBudget || budget <= currentPrice}
          className={`py-2 rounded-[9px] text-xs font-mono font-bold tracking-[0.09em] transition-all min-h-[44px] active:scale-95 ${
            isLocked || !hasBudget || budget <= currentPrice
              ? 'bg-surface-100/30 text-gray-500 cursor-not-allowed'
              : 'bg-accent-500/10 text-accent-400 border border-accent-500/50 hover:bg-accent-500/20'
          }`}
        >
          MAX
        </button>
      </div>

      {/* Stepper [−][importo][+] + RILANCIA */}
      <div className="flex items-stretch gap-2">
        <div className="flex items-stretch rounded-[11px] border border-surface-50 bg-surface-300 overflow-hidden">
          <button
            type="button"
            onClick={() => { updateBid(Math.max(minBid, bidAmount - 1)); }}
            disabled={isLocked || bidAmount <= minBid}
            aria-label="Diminuisci offerta"
            className="w-11 bg-surface-200 text-white stat-number text-xl border-r border-surface-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
          >
            −
          </button>
          <div className="flex flex-col items-center justify-center min-w-[84px] px-2 py-1">
            <input
              type="number"
              inputMode="numeric"
              value={Number.isFinite(bidAmount) ? bidAmount : ''}
              onChange={e => { updateBid(parseInt(e.target.value) || 0); }}
              disabled={isLocked}
              data-bid-input="true"
              aria-label="Importo offerta"
              className="w-full bg-transparent text-center stat-number text-2xl text-accent-300 leading-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[9px] text-gray-500 uppercase tracking-[0.09em] mt-0.5">tua offerta</span>
          </div>
          <button
            type="button"
            onClick={() => { updateBid(bidAmount + 1); }}
            disabled={isLocked || bidAmount + 1 > budget}
            aria-label="Aumenta offerta"
            className="w-11 bg-surface-200 text-white stat-number text-xl border-l border-surface-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
          >
            +
          </button>
        </div>

        {/* T-001: main bid button with loading state */}
        <button
          type="button"
          onClick={handleBidClick}
          disabled={isLocked || bidAmount <= currentPrice || bidAmount > budget}
          className={`flex-1 rounded-[11px] py-2.5 font-display font-extrabold uppercase tracking-[0.05em] text-base transition-all whitespace-nowrap min-h-[44px] ${
            isLocked || bidAmount <= currentPrice || bidAmount > budget
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'text-dark-300 bg-gradient-to-b from-secondary-400 to-secondary-500 hover:from-secondary-300 hover:to-secondary-400 shadow-glow-green active:scale-[0.99]'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </span>
          ) : isDisabled ? disabledLabel : (
            <>{actionLabel} <span className="font-mono">{bidAmount}M</span></>
          )}
        </button>
      </div>

      {/* Warning soglia budget (asta: 75% del budget residuo) */}
      {isHighBid && !showHighConfirm && (
        <div className="flex items-center gap-2 rounded-[9px] border border-accent-500/30 bg-accent-500/[0.07] px-3 py-1.5 text-xs text-gray-300">
          <span className="w-2 h-2 rounded-full bg-accent-500 shadow-[0_0_7px_theme(colors.accent.500)] flex-shrink-0" aria-hidden="true" />
          <span>
            Attenzione: con <b className="text-accent-400 font-semibold">{bidAmount}M</b> impegni
            il <b className="text-accent-400 font-semibold">{Math.round((bidAmount / budget) * 100)}% del {budgetLabel}</b>.
          </span>
        </div>
      )}

      {/* Warning limite strategia (rubata) */}
      {strategyMaxBid != null && bidAmount > strategyMaxBid && (
        <div className="flex items-center gap-2 rounded-[9px] border border-danger-500/40 bg-danger-500/10 px-3 py-1.5 text-xs">
          <span className="text-danger-400 font-bold">
            OLTRE IL LIMITE — la tua strategia era max {strategyMaxBid}M
          </span>
        </div>
      )}
      {strategyMaxBid != null && bidAmount <= strategyMaxBid && bidAmount >= strategyMaxBid * 0.8 && (
        <div className="flex items-center gap-2 rounded-[9px] border border-accent-500/30 bg-accent-500/[0.07] px-3 py-1.5 text-xs text-gray-300">
          <span className="w-2 h-2 rounded-full bg-accent-500 shadow-[0_0_7px_theme(colors.accent.500)] flex-shrink-0" aria-hidden="true" />
          <span>
            Vicino al tuo <b className="text-accent-400 font-semibold">limite strategia ({strategyMaxBid}M)</b>
            {' '}— margine {strategyMaxBid - bidAmount}M.
          </span>
        </div>
      )}
    </div>
  )
}
