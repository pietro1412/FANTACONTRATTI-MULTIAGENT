import { PlayerCell, getDurationColor, DURATION_MULTIPLIERS, type ContractPlayer } from './shared'
import { Stepper } from './Stepper'

export interface PendingItemProps {
  player: ContractPlayer
  acquisitionPrice: number
  minSalary: number
  salary: number
  duration: number
  validationError?: string
  inContrattiPhase: boolean
  isConsolidated: boolean
  onSalaryChange: (value: number) => void
  onDurationChange: (value: number) => void
  onViewStats: () => void
}

/**
 * A single "Da Impostare" (new contract) line. Same row grid as RenewalItem so
 * the Nuovi tab reads consistently; collapses to a card on mobile.
 */
export function PendingItem({
  player,
  acquisitionPrice,
  minSalary,
  salary,
  duration,
  validationError,
  inContrattiPhase,
  isConsolidated,
  onSalaryChange,
  onDurationChange,
  onViewStats,
}: PendingItemProps) {
  const multiplier = DURATION_MULTIPLIERS[duration] || 7
  const newClausola = salary * multiplier
  const newRubata = newClausola + salary
  const editable = inContrattiPhase && !isConsolidated

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_112px_132px_118px_96px_92px] gap-2 lg:gap-2.5 items-center px-3 lg:px-4 py-2.5 border-b border-surface-50/60 hover:bg-surface-100/60 transition-colors">
      <PlayerCell
        player={player}
        onClick={onViewStats}
        sub={
          <>
            <span>{player.team}</span>
            {player.age != null && <span>· {player.age}</span>}
          </>
        }
      />

      <div className="flex lg:block items-center justify-between text-left lg:text-right">
        <span className="micro-label lg:hidden">Acquisto</span>
        <div>
          <div className="stat-number text-base text-gray-400">{acquisitionPrice}M</div>
          <div className="font-mono text-[9.5px] text-warning-400">min {minSalary}M</div>
        </div>
      </div>

      <div className="flex lg:justify-center items-center justify-between">
        <span className="micro-label lg:hidden">Ingaggio</span>
        {editable ? (
          <Stepper
            value={salary}
            unit="ing."
            tone="gold"
            onDecrement={() => { onSalaryChange(Math.max(minSalary, salary - 1)) }}
            onIncrement={() => { onSalaryChange(salary + 1) }}
            decDisabled={salary <= minSalary}
          />
        ) : (
          <span className="stat-number text-base text-accent-400">{salary}M</span>
        )}
      </div>

      <div className="flex lg:justify-center items-center justify-between">
        <span className="micro-label lg:hidden">Durata</span>
        {editable ? (
          <Stepper
            value={duration}
            unit="sem"
            tone="primary"
            onDecrement={() => { onDurationChange(Math.max(1, duration - 1)) }}
            onIncrement={() => { onDurationChange(Math.min(4, duration + 1)) }}
            decDisabled={duration <= 1}
            incDisabled={duration >= 4}
          />
        ) : (
          <span className={`stat-number text-base ${getDurationColor(duration)}`}>{duration}s</span>
        )}
      </div>

      <div className="flex lg:block items-center justify-between text-left lg:text-right">
        <span className="micro-label lg:hidden">Clausola</span>
        <div>
          <div className="stat-number text-base text-white">{newClausola}M</div>
          {validationError ? (
            <div className="font-mono text-[9px] text-danger-400" title={validationError}>! errore</div>
          ) : (
            <div className="font-mono text-[9px] text-accent-400">rub. {newRubata}</div>
          )}
        </div>
      </div>

      <div className="hidden lg:block" />
    </div>
  )
}
