import { useState, useEffect, useMemo } from 'react'
import { Button } from './ui/Button'
import { NumberStepper } from './ui/NumberStepper'
import { DURATION_MULTIPLIERS } from '@/components/contracts/shared'

// Rescission clause: same duration->multiplier table used across the client
// (src/components/contracts/shared.tsx, reused by RenewalItem/PendingItem/
// renewal-logic.ts) so this never silently drifts from the shared source.
function calculateRescissionClause(salary: number, duration: number): number {
  const multiplier = DURATION_MULTIPLIERS[duration] || 3
  return salary * multiplier
}

// Validation rules for contract modification (same as renewal)
function isValidModification(
  currentSalary: number,
  currentDuration: number,
  newSalary: number,
  newDuration: number,
  initialSalary: number,
  isSvincolatiMode: boolean = false,
  increaseOnly: boolean = false
): { valid: boolean; reason?: string } {
  // Max duration check
  if (newDuration > 4) {
    return { valid: false, reason: 'Durata massima: 4 semestri' }
  }

  // Minimum values
  if (newSalary < 1) {
    return { valid: false, reason: 'Ingaggio minimo: 1' }
  }

  // Increase-only mode (post-rubata): no spalma, no taglio — only increase allowed
  if (increaseOnly) {
    if (newSalary < currentSalary) {
      return { valid: false, reason: `Ingaggio non può diminuire: ${newSalary} < ${currentSalary}` }
    }
    if (newDuration < currentDuration) {
      return { valid: false, reason: `Durata non può diminuire: ${newDuration} < ${currentDuration}` }
    }
    if (newDuration > currentDuration && newSalary <= currentSalary) {
      return { valid: false, reason: `Per aumentare la durata devi anche aumentare l'ingaggio` }
    }
    return { valid: true }
  }

  // Svincolati mode: minimum duration is 3, salary can only increase
  if (isSvincolatiMode) {
    if (newDuration < 3) {
      return { valid: false, reason: 'Durata minima per svincolati: 3 semestri' }
    }
    if (newSalary < currentSalary) {
      return { valid: false, reason: `Ingaggio non può diminuire: ${newSalary} < ${currentSalary}` }
    }
    if (newDuration < currentDuration) {
      return { valid: false, reason: `Durata non può diminuire: ${newDuration} < ${currentDuration}` }
    }
    return { valid: true }
  }

  if (newDuration < 1) {
    return { valid: false, reason: 'Durata minima: 1 semestre' }
  }

  // SPALMA case: current duration = 1
  if (currentDuration === 1) {
    const isValid = newSalary * newDuration >= initialSalary
    return {
      valid: isValid,
      reason: isValid
        ? undefined
        : `Spalma non valido: ${newSalary} x ${newDuration} = ${newSalary * newDuration} < ${initialSalary}`
    }
  }

  // Normal case: no decrease allowed
  if (newSalary < currentSalary) {
    return { valid: false, reason: `Ingaggio non può diminuire: ${newSalary} < ${currentSalary}` }
  }
  if (newDuration < currentDuration) {
    return { valid: false, reason: `Durata non può diminuire: ${newDuration} < ${currentDuration}` }
  }

  return { valid: true }
}

export interface ContractData {
  salary: number
  duration: number
  initialSalary: number
  rescissionClause: number
}

export interface PlayerInfo {
  id: string
  name: string
  team: string
  position: string
}

interface ContractModifierProps {
  /** Player information */
  player: PlayerInfo
  /** Current contract data */
  contract: ContractData
  /** Called when modification is confirmed */
  onConfirm: (newSalary: number, newDuration: number) => Promise<void>
  /** Called when user skips modification */
  onSkip: () => void
  /** Whether the component is in loading state */
  isLoading?: boolean
  /** Title for the modal/section */
  title?: string
  /** Description text */
  description?: string
  /** Svincolati mode: minimum duration is 3, salary can only increase */
  isSvincolatiMode?: boolean
  /** Increase-only mode: no spalma, no taglio — only salary/duration increase allowed (post-rubata) */
  increaseOnly?: boolean
}

export function ContractModifier({
  player,
  contract,
  onConfirm,
  onSkip,
  isLoading = false,
  title = 'Modifica Contratto',
  description = 'Puoi modificare il contratto del giocatore appena acquisito seguendo le regole del rinnovo.',
  isSvincolatiMode = false,
  increaseOnly = false,
}: ContractModifierProps) {
  const [newSalary, setNewSalary] = useState(contract.salary)
  const [newDuration, setNewDuration] = useState(contract.duration)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset when contract changes
  useEffect(() => {
    setNewSalary(contract.salary)
    setNewDuration(contract.duration)
    setError(null)
  }, [contract.salary, contract.duration])

  // Check if spalma is available (only in the "normal" renewal mode, when the current
  // contract has 1 semester left)
  const canSpalma = !isSvincolatiMode && !increaseOnly && contract.duration === 1

  // Bounds computed so that invalid combinations are unreachable via the steppers
  // themselves, instead of being allowed and flagged after the fact:
  // - svincolati / increaseOnly: salary/duration can never decrease below current.
  // - increaseOnly additionally: duration can't be pushed above current until salary
  //   has already been raised (and can't be brought back down while duration is still
  //   raised) — the classic "aumenta la durata senza aumentare l'ingaggio" case.
  // The one rule left to the after-the-fact check in `preview` below is spalma's
  // multiplicative constraint (ingaggio × durata ≥ ingaggio iniziale), which can't be
  // expressed as two independent per-field bounds.
  const minSalary = isSvincolatiMode || increaseOnly
    ? (increaseOnly && newDuration > contract.duration ? contract.salary + 1 : contract.salary)
    : canSpalma ? 1 : contract.salary
  const minDuration = isSvincolatiMode
    ? 3
    : increaseOnly
      ? contract.duration
      : canSpalma ? 1 : contract.duration
  const maxDuration = increaseOnly && newSalary <= contract.salary ? contract.duration : 4

  // Calculate preview values
  const preview = useMemo(() => {
    const salary = newSalary
    const duration = newDuration

    const validation = isValidModification(
      contract.salary,
      contract.duration,
      salary,
      duration,
      contract.initialSalary,
      isSvincolatiMode,
      increaseOnly
    )

    const newClause = calculateRescissionClause(salary, duration)
    const hasChanges = salary !== contract.salary || duration !== contract.duration

    return {
      salary,
      duration,
      rescissionClause: newClause,
      isValid: validation.valid,
      validationError: validation.reason,
      hasChanges,
    }
  }, [newSalary, newDuration, contract, isSvincolatiMode, increaseOnly])

  async function handleConfirm() {
    if (!preview.isValid) return

    setIsSubmitting(true)
    setError(null)

    try {
      await onConfirm(preview.salary, preview.duration)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la modifica')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Azione unica: senza modifiche mantiene il contratto attuale, altrimenti conferma
  // i nuovi valori — niente più due bottoni ridondanti quando non si è toccato nulla.
  function handlePrimaryAction() {
    if (preview.hasChanges) {
      void handleConfirm()
    } else {
      onSkip()
    }
  }

  const positionColors: Record<string, string> = {
    P: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
    D: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
    C: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30',
    A: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
  }

  return (
    <div className="bg-surface-200 border border-surface-50/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-surface-300/50 px-4 py-3 border-b border-surface-50/20">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Player Info */}
        <div className="flex items-center gap-3 p-3 bg-surface-300/30 rounded-lg">
          <span className={`px-2 py-1 text-xs font-bold rounded border ${positionColors[player.position] || 'bg-gray-500/20 text-gray-400'}`}>
            {player.position}
          </span>
          <div className="flex-1">
            <div className="font-medium text-white">{player.name}</div>
            <div className="text-xs text-gray-400">{player.team}</div>
          </div>
        </div>

        {/* Spalma Info */}
        {canSpalma && (
          <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-warning-400 font-medium mb-1">
              <span>Spalma disponibile</span>
            </div>
            <p className="text-gray-400">
              Puoi ridurre l'ingaggio allungando la durata. Regola: Ingaggio × Durata ≥ {contract.initialSalary}
            </p>
          </div>
        )}

        {/* Riepilogo contratto — sempre visibile (mostra il valore attuale finché non
            si modifica, la transizione attuale → nuovo appena si tocca uno stepper).
            Stesse 3 colonne degli input sotto, per restare sempre allineati. */}
        <div className={`rounded-lg border p-3 ${
          !preview.hasChanges
            ? 'bg-surface-300/20 border-surface-50/10'
            : preview.isValid
              ? 'bg-secondary-500/10 border-secondary-500/30'
              : 'bg-danger-500/10 border-danger-500/30'
        }`}>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-gray-500 mb-1">Ingaggio</div>
              <div className="text-lg font-bold text-white">
                {preview.hasChanges ? (
                  <>{contract.salary}M → <span className={preview.isValid ? 'text-secondary-400' : 'text-danger-400'}>{preview.salary}M</span></>
                ) : `${contract.salary}M`}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Durata</div>
              <div className="text-lg font-bold text-white">
                {preview.hasChanges ? (
                  <>{contract.duration}s → <span className={preview.isValid ? 'text-secondary-400' : 'text-danger-400'}>{preview.duration}s</span></>
                ) : `${contract.duration}s`}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Clausola</div>
              <div className="text-lg font-bold text-primary-400">
                {preview.hasChanges ? (
                  <>{contract.rescissionClause}M → <span className="text-primary-400">{preview.rescissionClause}M</span></>
                ) : `${contract.rescissionClause}M`}
              </div>
            </div>
          </div>
          {preview.hasChanges && !preview.isValid && (
            <p className="mt-2 text-sm text-danger-400 text-center">{preview.validationError}</p>
          )}
        </div>

        {/* Riga flessibile (non grid-cols-3): ogni NumberStepper "sm" occupa ~152px
            (due bottoni da 44px min-width per touch target + valore), più dei ~130px
            che una colonna equa a 3 avrebbe offerto in questo modale max-w-md — causava
            la sovrapposizione tra il "+" di Ingaggio e il "−" di Durata (2026-08-29).
            flex-wrap fa andare a capo singolarmente invece di forzare l'overlap. */}
        <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-3">
          <NumberStepper
            label="Ingaggio (M)"
            value={newSalary}
            onChange={setNewSalary}
            min={minSalary}
            max={Infinity}
            unit="M"
            size="sm"
            disabled={isLoading || isSubmitting}
          />
          <NumberStepper
            label="Durata (sem.)"
            value={newDuration}
            onChange={setNewDuration}
            min={minDuration}
            max={maxDuration}
            unit="s"
            size="sm"
            disabled={isLoading || isSubmitting}
          />
          <div className="text-center">
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
              Clausola
            </label>
            <div className="flex items-center justify-center min-h-[44px] text-xl font-bold text-primary-400 tabular-nums">
              {preview.rescissionClause}M
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/30 rounded-lg p-3 text-sm text-danger-400">
            {error}
          </div>
        )}

        {/* Info note */}
        <div className="text-xs text-gray-500 bg-surface-300/20 rounded-lg p-3">
          La modifica non impatta il budget attuale. Il nuovo ingaggio sarà conteggiato nel monte ingaggi durante la fase Contratti.
        </div>

        {/* Azione unica: "Mantieni contratto" senza modifiche, "Conferma modifica"
            appena si tocca ingaggio/durata — mai due bottoni insieme. */}
        <Button
          onClick={handlePrimaryAction}
          disabled={isLoading || isSubmitting || (preview.hasChanges && !preview.isValid)}
          isLoading={isSubmitting}
          className="w-full"
        >
          {preview.hasChanges ? 'Conferma modifica' : 'Mantieni contratto'}
        </Button>
      </div>
    </div>
  )
}

// Modal wrapper for ContractModifier
interface ContractModifierModalProps extends Omit<ContractModifierProps, 'onSkip'> {
  isOpen: boolean
  onClose: () => void
}

export function ContractModifierModal({
  isOpen,
  onClose,
  ...props
}: ContractModifierModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <ContractModifier {...props} onSkip={onClose} />
      </div>
    </div>
  )
}

export default ContractModifier
