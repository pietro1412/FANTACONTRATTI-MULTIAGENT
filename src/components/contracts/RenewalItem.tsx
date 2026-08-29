import { RotateCcw } from 'lucide-react'
import { PlayerCell, Tag, getDurationColor, DURATION_MULTIPLIERS, type ContractPlayer } from './shared'
import { getRenewalConstraints } from './renewal-logic'
import { Stepper } from './Stepper'
import { NOT_DISPONIBILE, getAgeColor } from '@/utils/stat-format'

export interface RenewalItemContract {
  id: string
  salary: number
  duration: number
  initialSalary: number
  rescissionClause: number
  canRenew: boolean
  canSpalmare: boolean
  draftSalary: number | null
  draftDuration: number | null
  wasModified?: boolean
  isExitedPlayer?: boolean
  exitReason?: string | null
  indemnityCompensation?: number
  player: ContractPlayer
  acquisitionType: string
}

export interface RenewalItemProps {
  contract: RenewalItemContract
  newSalary: number
  newDuration: number
  validationError?: string
  isMarkedForRelease: boolean
  /** undefined = still to decide (only meaningful when contract.isExitedPlayer). */
  exitDecision: 'KEEP' | 'RELEASE' | undefined
  inContrattiPhase: boolean
  isConsolidated: boolean
  onSalaryChange: (value: number) => void
  onDurationChange: (value: number) => void
  onResetContract: () => void
  onToggleRelease: () => void
  onSetExitDecision: (decision: 'KEEP' | 'RELEASE') => void
  onUndoExitDecision: () => void
  onViewStats: () => void
}

function renderTags(p: {
  canSpalmare: boolean
  isMarkedForRelease: boolean
  newSalary: number
  salary: number
  isKeptExited: boolean
  isTrade: boolean
}) {
  return (
    <>
      {p.canSpalmare && !p.isMarkedForRelease && (
        p.newSalary < p.salary
          ? <Tag tone="secondary">SPALMATO</Tag>
          : <Tag tone="primary">SPALMABILE</Tag>
      )}
      {p.isTrade && <Tag tone="accent">SCAMBIO</Tag>}
      {p.isMarkedForRelease && <Tag tone="danger">DA TAGLIARE</Tag>}
      {p.isKeptExited && <Tag tone="secondary">MANTENUTO</Tag>}
      {!p.isMarkedForRelease && !p.isKeptExited && p.newSalary > p.salary && <Tag tone="primary">RIALZO</Tag>}
    </>
  )
}

/**
 * A single renewal line. Renders a desktop grid row by default; the page lays it
 * out inside a flex column so the same component serves desktop and mobile (the
 * grid collapses naturally). One source of truth removes the ~290-line
 * mobile/desktop duplication of the previous Rinnovi table.
 */
export function RenewalItem({
  contract: c,
  newSalary,
  newDuration,
  validationError,
  isMarkedForRelease,
  exitDecision,
  inContrattiPhase,
  isConsolidated,
  onSalaryChange,
  onDurationChange,
  onResetContract,
  onToggleRelease,
  onSetExitDecision,
  onUndoExitDecision,
  onViewStats,
}: RenewalItemProps) {
  const isKeptExited = !!c.isExitedPlayer && exitDecision === 'KEEP'
  const isReleasedExited = !!c.isExitedPlayer && exitDecision === 'RELEASE'
  const isUndecidedExited = !!c.isExitedPlayer && exitDecision == null
  const isEstero = c.exitReason === 'ESTERO'
  const indemnity = c.indemnityCompensation || 0

  const k = getRenewalConstraints({
    salary: c.salary,
    duration: c.duration,
    initialSalary: c.initialSalary,
    canSpalmare: c.canSpalmare,
    newSalary,
    newDuration,
  })

  const releaseCost = Math.ceil((c.salary * c.duration) / 2)
  const editable = c.canRenew && inContrattiPhase && !isConsolidated && !isMarkedForRelease
    && !isUndecidedExited && !isReleasedExited

  const rating = c.player.computedStats?.avgRating
  const sub = (
    <>
      <span>{c.player.team}</span>
      {(isUndecidedExited || isReleasedExited) && (
        <>
          <Tag tone={isEstero ? 'accent' : 'primary'}>{isEstero ? 'ESTERO' : 'RETROCESSO'}</Tag>
          {isEstero && isUndecidedExited && (
            <span className="text-secondary-400">ind. se rilasci {indemnity}M</span>
          )}
        </>
      )}
      {c.duration === 1 && !isReleasedExited && <Tag tone="danger">SCADE</Tag>}
      {!isUndecidedExited && !isReleasedExited && renderTags({
        canSpalmare: c.canSpalmare,
        isMarkedForRelease,
        newSalary,
        salary: c.salary,
        isKeptExited,
        isTrade: c.acquisitionType === 'TRADE',
      })}
    </>
  )

  // Consolidated read-only view values
  const consolidatedClause = c.draftSalary != null && c.draftDuration != null
    ? c.draftSalary * (DURATION_MULTIPLIERS[c.draftDuration] || 7)
    : null

  return (
    <div
      className={`grid contracts-grid items-center px-3 lg:px-4 py-2.5 border-b border-surface-50/60 hover:bg-surface-100/60 transition-colors ${
        isMarkedForRelease || isReleasedExited ? 'opacity-60' : ''
      } ${isKeptExited ? 'bg-secondary-500/[0.04]' : ''} ${isUndecidedExited ? 'bg-accent-500/[0.03]' : ''}`}
    >
      {/* Player */}
      <PlayerCell
        player={c.player}
        onClick={onViewStats}
        nameClassName={isMarkedForRelease || isReleasedExited ? 'text-gray-400 line-through' : 'text-primary-400 hover:text-primary-300'}
        sub={sub}
      />

      {/* Age */}
      <div className="flex lg:block items-center justify-between text-left lg:text-center">
        <span className="micro-label lg:hidden">Età</span>
        <span className={`stat-number text-base ${getAgeColor(c.player.age)}`}>
          {c.player.age != null ? c.player.age : NOT_DISPONIBILE}
        </span>
      </div>

      {/* Salary (draft value; the stepper glows gold when it differs from the
          signed contract — the reset lives in the Azione column as "Cancella
          rinnovo", replacing Taglia, since the two are mutually exclusive). */}
      <div className="flex lg:justify-center items-center justify-between">
        <span className="micro-label lg:hidden">Ingaggio</span>
        {editable ? (
          <Stepper
            value={newSalary}
            unit="ing."
            tone="gold"
            onDecrement={() => { onSalaryChange(Math.max(k.minSalaryAllowed, newSalary - 1)) }}
            onIncrement={() => { onSalaryChange(newSalary + 1) }}
            decDisabled={!k.canDecreaseSalary}
            decTitle={!k.canDecreaseSalary ? (c.canSpalmare ? 'Ingaggio minimo raggiunto' : 'Riduci prima la durata') : undefined}
          />
        ) : isConsolidated && c.draftSalary != null ? (
          <span className="stat-number text-base text-accent-400">{c.draftSalary}M</span>
        ) : isUndecidedExited ? (
          <span className="stat-number text-base text-gray-300">{c.salary}M</span>
        ) : (
          <span className="text-gray-500 text-sm">—</span>
        )}
      </div>

      {/* Duration (draft value, same treatment) */}
      <div className="flex lg:justify-center items-center justify-between">
        <span className="micro-label lg:hidden">Durata</span>
        {editable ? (
          <Stepper
            value={newDuration}
            unit="sem"
            tone="primary"
            onDecrement={() => { onDurationChange(newDuration - 1) }}
            onIncrement={() => { onDurationChange(newDuration + 1) }}
            decDisabled={!k.canDecreaseDuration}
            incDisabled={newDuration >= 4 || !k.canIncreaseDuration}
            decTitle={k.durationHint ?? undefined}
            incTitle={!k.canIncreaseDuration ? 'Aumenta prima l\'ingaggio' : undefined}
          />
        ) : isConsolidated && c.draftDuration != null ? (
          <span className={`stat-number text-base ${getDurationColor(c.draftDuration)}`}>{c.draftDuration}s</span>
        ) : isUndecidedExited ? (
          <span className={`stat-number text-base ${getDurationColor(c.duration)}`}>{c.duration}s</span>
        ) : (
          <span className="text-gray-500 text-sm">—</span>
        )}
      </div>

      {/* Renewal clause */}
      <div className="flex lg:block items-center justify-between text-left lg:text-center">
        <span className="micro-label lg:hidden">Clausola</span>
        {isMarkedForRelease ? (
          <div>
            <div className="font-mono text-[10px] font-bold text-danger-400">costo taglio</div>
            <div className="stat-number text-base text-danger-400">−{releaseCost}M</div>
          </div>
        ) : isReleasedExited ? (
          <div>
            <div className="font-mono text-[10px] font-bold text-secondary-400">indennizzo</div>
            <div className="stat-number text-base text-secondary-400">+{indemnity}M</div>
          </div>
        ) : isConsolidated && consolidatedClause != null ? (
          <span className="stat-number text-base text-white">{consolidatedClause}M</span>
        ) : (
          <div>
            <div className={`stat-number text-base ${k.hasChanges ? 'text-accent-400 text-glow-gold' : 'text-gray-500'}`}>{k.newRescissionClause}M</div>
            {validationError ? (
              <div className="font-mono text-[9px] text-danger-400" title={validationError}>! errore</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Rubata (single value: updates with the renewal, stays the previous one otherwise) */}
      <div className="flex lg:block items-center justify-between text-left lg:text-center">
        <span className="micro-label lg:hidden">Rubata</span>
        {isMarkedForRelease || isReleasedExited ? (
          <span className="text-gray-500 text-sm">—</span>
        ) : isConsolidated && consolidatedClause != null && c.draftSalary != null ? (
          <span className="stat-number text-base text-white">{consolidatedClause + c.draftSalary}M</span>
        ) : (
          <span className={`stat-number text-base ${k.hasChanges ? 'text-accent-400 text-glow-gold' : 'text-gray-500'}`}>{k.newRubata}M</span>
        )}
      </div>

      {/* Fantamedia */}
      <div className="flex lg:block items-center justify-between text-left lg:text-center">
        <span className="micro-label lg:hidden">Fantamedia</span>
        <span className={`stat-number text-base ${rating != null ? 'text-primary-400' : 'text-gray-500'}`}>
          {rating != null ? rating.toFixed(1) : NOT_DISPONIBILE}
        </span>
      </div>

      {/* Action */}
      <div className="flex lg:justify-center items-center justify-end">
        {inContrattiPhase && !isConsolidated ? (
          isMarkedForRelease ? (
            <button
              type="button"
              onClick={onToggleRelease}
              className="font-mono text-[9.5px] font-bold text-gray-300 border border-surface-50 bg-surface-200 rounded-lg px-2.5 py-1.5 hover:bg-surface-100 transition-colors"
            >
              Annulla
            </button>
          ) : k.hasChanges ? (
            // Renewal in progress: cutting/release no longer applies, so the
            // row's other actions are replaced by an undo for the edit.
            <button
              type="button"
              onClick={onResetContract}
              className="font-mono text-[9.5px] font-bold text-gray-300 border border-surface-50 bg-surface-200 rounded-lg px-2.5 py-1.5 hover:bg-surface-100 transition-colors inline-flex items-center gap-1"
              title={`Annulla rinnovo, torna a ${c.salary}M / ${c.duration}s`}
            >
              <RotateCcw size={11} /> Cancella rinnovo
            </button>
          ) : isKeptExited ? (
            <button
              type="button"
              onClick={() => { onSetExitDecision('RELEASE') }}
              className="font-mono text-[9.5px] font-bold text-danger-400 border border-danger-500/40 bg-danger-500/[0.06] rounded-lg px-2.5 py-1.5 hover:bg-danger-500/15 transition-colors"
              title={isEstero ? `Rilascia (+${indemnity}M indennizzo)` : 'Rilascia (gratuito)'}
            >
              Rilascia
            </button>
          ) : isReleasedExited ? (
            <button
              type="button"
              onClick={onUndoExitDecision}
              className="font-mono text-[9.5px] font-bold text-gray-300 border border-surface-50 bg-surface-200 rounded-lg px-2.5 py-1.5 hover:bg-surface-100 transition-colors"
            >
              Annulla
            </button>
          ) : isUndecidedExited ? (
            <div className="flex flex-col gap-1 items-stretch w-full lg:w-auto">
              <button
                type="button"
                onClick={() => { onSetExitDecision('KEEP') }}
                className="font-mono text-[9.5px] font-bold text-secondary-400 border border-secondary-500/40 bg-secondary-500/10 rounded-lg px-2.5 py-1 hover:bg-secondary-500/20 transition-colors"
              >
                Mantieni
              </button>
              <button
                type="button"
                onClick={() => { onSetExitDecision('RELEASE') }}
                className="font-mono text-[9.5px] font-bold text-danger-400 border border-danger-500/40 bg-danger-500/[0.06] rounded-lg px-2.5 py-1 hover:bg-danger-500/15 transition-colors"
              >
                Rilascia
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleRelease}
              className="font-mono text-[9.5px] font-bold text-danger-400 border border-danger-500/40 bg-danger-500/[0.06] rounded-lg px-2.5 py-1.5 hover:bg-danger-500/15 transition-colors"
              title={`Taglia giocatore (${releaseCost}M)`}
            >
              Taglia
            </button>
          )
        ) : isConsolidated && c.wasModified ? (
          <Tag tone="secondary">RINNOVATO</Tag>
        ) : null}
      </div>

      {/* Spalma persistent hint (mobile + desktop, full row) */}
      {editable && k.salaryHint && (
        <div className="lg:col-span-8 -mt-1">
          <span className="font-mono text-[9.5px] text-warning-400 inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-warning-400" /> {k.salaryHint} ({c.initialSalary} ÷ {newDuration})
          </span>
        </div>
      )}
    </div>
  )
}
