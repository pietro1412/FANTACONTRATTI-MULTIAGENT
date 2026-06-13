import { PlayerCell, Tag, getDurationColor, DURATION_MULTIPLIERS, type ContractPlayer } from './shared'
import { getRenewalConstraints } from './renewal-logic'
import { Stepper } from './Stepper'

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
  player: ContractPlayer
  acquisitionType: string
}

export interface RenewalItemProps {
  contract: RenewalItemContract
  newSalary: number
  newDuration: number
  validationError?: string
  isMarkedForRelease: boolean
  isKeptExited: boolean
  inContrattiPhase: boolean
  isConsolidated: boolean
  onSalaryChange: (value: number) => void
  onDurationChange: (value: number) => void
  onToggleRelease: () => void
  onRemoveKept: () => void
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
  isKeptExited,
  inContrattiPhase,
  isConsolidated,
  onSalaryChange,
  onDurationChange,
  onToggleRelease,
  onRemoveKept,
  onViewStats,
}: RenewalItemProps) {
  const k = getRenewalConstraints({
    salary: c.salary,
    duration: c.duration,
    initialSalary: c.initialSalary,
    canSpalmare: c.canSpalmare,
    newSalary,
    newDuration,
  })

  const currentRubata = c.rescissionClause + c.salary
  const releaseCost = Math.ceil((c.salary * c.duration) / 2)
  const editable = c.canRenew && inContrattiPhase && !isConsolidated && !isMarkedForRelease

  const rating = c.player.computedStats?.avgRating
  const sub = (
    <>
      <span>{c.player.team}</span>
      {c.player.age != null && <span>· {c.player.age}</span>}
      {rating != null && <span className="text-primary-400 font-semibold">{rating.toFixed(1)}</span>}
      {renderTags({
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
      className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_112px_132px_118px_96px_92px] gap-2 lg:gap-2.5 items-center px-3 lg:px-4 py-2.5 border-b border-surface-50/60 hover:bg-surface-100/60 transition-colors ${
        isMarkedForRelease ? 'opacity-60' : ''
      } ${isKeptExited ? 'bg-secondary-500/[0.04]' : ''}`}
    >
      {/* Player */}
      <PlayerCell
        player={c.player}
        onClick={onViewStats}
        nameClassName={isMarkedForRelease ? 'text-gray-400 line-through' : 'text-primary-400 hover:text-primary-300'}
        sub={sub}
      />

      {/* Current contract */}
      <div className="flex lg:block items-center justify-between text-left lg:text-right">
        <span className="micro-label lg:hidden">Attuale</span>
        <div>
          <div className="stat-number text-base text-gray-400">{c.salary}×{c.duration}</div>
          <div className="font-mono text-[9.5px] text-gray-500">claus. {c.rescissionClause} · rub. {currentRubata}</div>
        </div>
      </div>

      {/* New salary */}
      <div className="flex lg:justify-center items-center justify-between">
        <span className="micro-label lg:hidden">Nuovo ingaggio</span>
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
        ) : (
          <span className="text-gray-500 text-sm">—</span>
        )}
      </div>

      {/* New duration */}
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
        ) : (
          <span className="text-gray-500 text-sm">—</span>
        )}
      </div>

      {/* New clause */}
      <div className="flex lg:block items-center justify-between text-left lg:text-right">
        <span className="micro-label lg:hidden">Clausola</span>
        {isMarkedForRelease ? (
          <div>
            <div className="font-mono text-[10px] font-bold text-danger-400">costo taglio</div>
            <div className="stat-number text-base text-danger-400">−{releaseCost}M</div>
          </div>
        ) : isConsolidated && consolidatedClause != null ? (
          <div className="stat-number text-base text-white">{consolidatedClause}M</div>
        ) : (
          <div>
            <div className={`stat-number text-base ${k.hasChanges ? 'text-white' : 'text-gray-500'}`}>{k.newRescissionClause}M</div>
            {validationError ? (
              <div className="font-mono text-[9px] text-danger-400" title={validationError}>! errore</div>
            ) : k.hasChanges ? (
              <div className="font-mono text-[9px] text-accent-400">↑ rub. {k.newRubata}</div>
            ) : (
              <div className="font-mono text-[9px] text-gray-500">= invariata</div>
            )}
          </div>
        )}
      </div>

      {/* Action */}
      <div className="flex lg:justify-center items-center justify-end">
        {inContrattiPhase && !isConsolidated ? (
          isKeptExited ? (
            <button
              type="button"
              onClick={onRemoveKept}
              className="font-mono text-[9.5px] font-bold text-secondary-400 border border-secondary-500/40 bg-secondary-500/10 rounded-lg px-2.5 py-1.5 hover:bg-secondary-500/20 transition-colors"
              title="Rimetti tra gli usciti"
            >
              Rimetti
            </button>
          ) : isMarkedForRelease ? (
            <button
              type="button"
              onClick={onToggleRelease}
              className="font-mono text-[9.5px] font-bold text-gray-300 border border-surface-50 bg-surface-200 rounded-lg px-2.5 py-1.5 hover:bg-surface-100 transition-colors"
            >
              Annulla
            </button>
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
        <div className="lg:col-span-6 -mt-1">
          <span className="font-mono text-[9.5px] text-warning-400 inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-warning-400" /> {k.salaryHint} ({c.initialSalary} ÷ {newDuration})
          </span>
        </div>
      )}
    </div>
  )
}
