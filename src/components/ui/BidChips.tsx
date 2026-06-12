import { memo } from 'react'
import { Monogram } from './Monogram'

export interface BidChipItem {
  id: string | number
  name: string
  amount: number
  isMine?: boolean
}

export interface BidChipsProps {
  bids: BidChipItem[]
  /** Micro-label a sinistra (default "Ultimi rilanci") */
  label?: string
  /** Quanti chip mostrare al massimo (default 12) */
  maxVisible?: number
  className?: string
}

/**
 * P4 — "Ultimi rilanci" a chip orizzontali (mockup cockpit): pillole con
 * monogramma, nome e importo mono oro; il primo chip (offerta in testa)
 * è evidenziato con bordo oro. Scroll orizzontale oltre la larghezza.
 */
export const BidChips = memo(function BidChips({
  bids,
  label = 'Ultimi rilanci',
  maxVisible = 12,
  className = '',
}: BidChipsProps) {
  if (bids.length === 0) return null

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <span className="micro-label flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 min-w-0">
        {bids.slice(0, maxVisible).map((bid, i) => (
          <span
            key={bid.id}
            className={`inline-flex items-center gap-1.5 rounded-full border pl-1 pr-3 py-1 text-xs flex-shrink-0 ${
              i === 0
                ? 'border-accent-500/55 bg-accent-500/10'
                : 'border-surface-50 bg-surface-300'
            }`}
          >
            <Monogram
              name={bid.name}
              size="sm"
              className={i === 0 ? 'border-accent-500/60 text-accent-400' : ''}
            />
            <b className={`font-semibold ${bid.isMine ? 'text-secondary-400' : 'text-gray-200'}`}>
              {bid.name}{bid.isMine && ' (tu)'}
            </b>
            <span className="font-mono font-bold text-[11px] text-accent-400">{bid.amount}M</span>
          </span>
        ))}
      </div>
    </div>
  )
})
