import { Hourglass } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export interface ManagerRecognition {
  /** Stable key (category id, or synthetic for base/indemnity). */
  key: string
  category: string
  amount: number
  description: string
  /** Highlight as a "won" category (gold). */
  highlight?: boolean
}

interface ManagerPrizeSummaryProps {
  isFinalized: boolean
  baseReincrement: number
  /** Total accredited (null until finalized for non-base items). */
  total: number
  recognitions: ManagerRecognition[]
}

/** Manager-facing consultation view: total banner + recognition cards. */
export function ManagerPrizeSummary({
  isFinalized,
  baseReincrement,
  total,
  recognitions,
}: ManagerPrizeSummaryProps) {
  if (!isFinalized) {
    return (
      <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-accent-500/10 flex items-center justify-center mx-auto mb-4">
          <Hourglass size={28} className="text-accent-400" aria-hidden="true" />
        </div>
        <p className="font-display text-lg font-bold text-white mb-1">Premi non ancora convalidati</p>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          L&apos;admin della lega deve ancora finalizzare l&apos;assegnazione dei premi.
        </p>
        <div className="mt-5 inline-flex flex-col items-center bg-surface-300 rounded-xl px-6 py-3 border border-surface-50/20">
          <span className="micro-label">Re-incremento base garantito</span>
          <span className="stat-number text-2xl text-primary-400 mt-1">{baseReincrement}M</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Total accredited banner */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-accent-500/[0.12] to-accent-500/[0.03] border border-accent-500/40 rounded-2xl px-5 py-4">
        <span className="micro-label text-accent-400">Totale accreditato</span>
        <span className="text-[10px] font-mono font-bold text-secondary-400 bg-secondary-500/10 border border-secondary-500/35 rounded-full px-3 py-1">
          Finalizzato
        </span>
        <span className="ml-auto stat-number text-3xl text-accent-400">+{total}M</span>
      </div>

      {/* Recognitions */}
      <div>
        <div className="micro-label mb-3">I tuoi riconoscimenti</div>
        {recognitions.length === 0 ? (
          <EmptyState
            icon="🏅"
            title="Nessun riconoscimento individuale"
            description="Hai comunque ricevuto il re-incremento base di questa stagione."
            compact
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recognitions.map(r => (
              <div
                key={r.key}
                className={`rounded-xl p-4 border ${
                  r.highlight
                    ? 'bg-accent-500/[0.05] border-accent-500/40'
                    : 'bg-surface-300 border-surface-50/20'
                }`}
              >
                <div className={`micro-label text-[9.5px] ${r.highlight ? 'text-accent-400' : ''}`}>
                  {r.category}
                </div>
                <div className="stat-number text-3xl text-accent-400 mt-1.5">+{r.amount}M</div>
                <div className="text-[11px] text-gray-400 mt-1">{r.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
