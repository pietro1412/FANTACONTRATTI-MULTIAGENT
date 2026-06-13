import { Check, Lock } from 'lucide-react'
import type { ReactNode } from 'react'

type StepChip = 'ok' | 'todo' | 'locked'

interface StepCardProps {
  num: number
  title: string
  /** Status chip shown at the right of the header. */
  chipLabel: string
  chipKind: StepChip
  /** When true the card is rendered as a decision zone (gold border). */
  zone?: boolean
  /** When true the badge is rendered as a "done" check. */
  done?: boolean
  /** Optional extra control aligned to the right of the header (e.g. + Categoria). */
  headerAction?: ReactNode
  children: ReactNode
}

const CHIP_CLASS: Record<StepChip, string> = {
  ok: 'text-secondary-400 bg-secondary-500/10 border-secondary-500/35',
  todo: 'text-accent-400 bg-accent-500/10 border-accent-500/40',
  locked: 'text-gray-500 border-surface-50/40',
}

/** Card wrapping a single admin prize step. */
export function StepCard({
  num,
  title,
  chipLabel,
  chipKind,
  zone = false,
  done = false,
  headerAction,
  children,
}: StepCardProps) {
  const badgeClass = zone
    ? 'bg-accent-400 text-surface-400'
    : done
      ? 'bg-secondary-500 text-surface-400'
      : 'bg-surface-100 text-gray-400'

  return (
    <div
      className={`bg-surface-200 rounded-2xl overflow-hidden ${
        zone ? 'arena-gold' : 'border border-surface-50/20'
      }`}
    >
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-surface-50/20">
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center stat-number text-[13px] flex-shrink-0 ${badgeClass}`}
          aria-hidden="true"
        >
          {done ? <Check size={14} strokeWidth={3} /> : num}
        </span>
        <h3 className="font-display text-[15px] font-bold text-white">{title}</h3>
        <span
          className={`ml-auto flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wide rounded-md px-2.5 py-1 border ${CHIP_CLASS[chipKind]}`}
        >
          {chipKind === 'locked' && <Lock size={11} aria-hidden="true" />}
          {chipLabel}
        </span>
        {headerAction}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}
