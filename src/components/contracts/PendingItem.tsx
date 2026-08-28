import { PlayerCell, Tag, getDurationColor, getAgeColor, DURATION_MULTIPLIERS, type ContractPlayer } from './shared'
import { Stepper } from './Stepper'
import { NOT_DISPONIBILE } from '@/utils/stat-format'

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
    <div className="grid contracts-grid items-center px-3 lg:px-4 py-2.5 border-b border-surface-50/60 hover:bg-surface-100/60 transition-colors">
      <PlayerCell
        player={player}
        onClick={onViewStats}
        sub={
          <>
            <span>{player.team}</span>
            <span className="text-gray-600">Acquisto {acquisitionPrice}M · min {minSalary}M</span>
            {duration === 1 && <Tag tone="danger">SCADE</Tag>}
          </>
        }
      />

      {/* Age */}
      <div className="flex lg:block items-center justify-between text-left lg:text-center">
        <span className="micro-label lg:hidden">Età</span>
        <span className={`stat-number text-base ${getAgeColor(player.age)}`}>
          {player.age != null ? player.age : NOT_DISPONIBILE}
        </span>
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

      <div className="flex lg:block items-center justify-between text-left lg:text-center">
        <span className="micro-label lg:hidden">Clausola</span>
        <div>
          <div className="stat-number text-base text-white">{newClausola}M</div>
          {validationError ? (
            <div className="font-mono text-[9px] text-danger-400" title={validationError}>! errore</div>
          ) : null}
        </div>
      </div>

      <div className="flex lg:block items-center justify-between text-left lg:text-center">
        <span className="micro-label lg:hidden">Rubata</span>
        <div className="stat-number text-base text-white">{newRubata}M</div>
      </div>

      {/* Fantamedia */}
      <div className="flex lg:block items-center justify-between text-left lg:text-center">
        <span className="micro-label lg:hidden">Fantamedia</span>
        <span className={`stat-number text-base ${player.computedStats?.avgRating != null ? 'text-primary-400' : 'text-gray-500'}`}>
          {player.computedStats?.avgRating != null ? player.computedStats.avgRating.toFixed(1) : NOT_DISPONIBILE}
        </span>
      </div>

      <div className="hidden lg:block" />
    </div>
  )
}
