import { Check, Lock } from 'lucide-react'

export type StepStatus = 'done' | 'current' | 'todo' | 'locked'

export interface PrizeStep {
  num: number
  title: string
  status: StepStatus
  hint: string
}

interface PrizeStepperProps {
  steps: PrizeStep[]
}

/** Horizontal stepper of the 4 prize phases with derived status. */
export function PrizeStepper({ steps }: PrizeStepperProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {steps.map(step => {
        const isDone = step.status === 'done'
        const isCurrent = step.status === 'current'
        const isLocked = step.status === 'locked'

        const cardClass = isCurrent
          ? 'border-accent-500 bg-accent-500/[0.06] shadow-[0_0_0_1px_rgba(245,158,11,0.2)]'
          : isDone
            ? 'border-secondary-500/40'
            : isLocked
              ? 'border-surface-50/20 opacity-50'
              : 'border-surface-50/20'

        const numClass = isDone
          ? 'bg-secondary-500 text-surface-400'
          : isCurrent
            ? 'bg-accent-400 text-surface-400'
            : 'bg-surface-100 text-gray-400'

        const hintClass = isDone
          ? 'text-secondary-400'
          : isCurrent
            ? 'text-accent-400'
            : 'text-gray-500'

        return (
          <div
            key={step.num}
            className={`flex items-center gap-3 bg-surface-200 border rounded-xl px-3.5 py-3 ${cardClass}`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center stat-number text-sm flex-shrink-0 ${numClass}`}
              aria-hidden="true"
            >
              {isDone ? <Check size={15} strokeWidth={3} /> : isLocked ? <Lock size={13} /> : step.num}
            </span>
            <div className="min-w-0">
              <div className="micro-label text-[8.5px]">Step {step.num}</div>
              <div className="font-display text-[13px] font-bold text-white truncate">{step.title}</div>
              <div className={`text-[10.5px] mt-0.5 ${hintClass}`}>{step.hint}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
