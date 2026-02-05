import { useState, useEffect, useMemo } from 'react'
import { Button } from './ui/Button'

// Duration multipliers for rescission clause calculation
const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,
  3: 9,
  2: 7,
  1: 4,
}

function calculateRescissionClause(salary: number, duration: number): number {
  const multiplier = DURATION_MULTIPLIERS[duration] || 4
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
      return { valid: false, reason: `Per aumentare la durata devi prima aumentare l'ingaggio` }
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
  const [newSalary, setNewSalary] = useState(contract.salary.toString())
  const [newDuration, setNewDuration] = useState(contract.duration)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calculate minimum duration based on mode
  const minDuration = isSvincolatiMode ? 3 : increaseOnly ? contract.duration : 1

  // Reset when contract changes
  useEffect(() => {
    setNewSalary(contract.salary.toString())
    setNewDuration(contract.duration)
    setError(null)
  }, [contract.salary, contract.duration])

  // Calculate preview values
  const preview = useMemo(() => {
    const salary = parseInt(newSalary) || contract.salary
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
  }, [newSalary, newDuration, contract, isSvincolatiMode])

  // Check if spalma is available (not in svincolati mode, not in increase-only mode)
  const canSpalma = !isSvincolatiMode && !increaseOnly && contract.duration === 1

  async function handleConfirm() {
    if (!preview.isValid || !preview.hasChanges) return

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

        {/* Current Contract */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-surface-300/20 rounded-lg">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Ingaggio attuale</div>
            <div className="text-lg font-bold text-white">{contract.salary}M</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Durata attuale</div>
            <div className="text-lg font-bold text-white">{contract.duration}s</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Clausola attuale</div>
            <div className="text-lg font-bold text-primary-400">{contract.rescissionClause}M</div>
          </div>
        </div>

        {/* Spalma Info */}
        {canSpalma && (
          <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-warning-400 font-medium mb-1">
              <span>Spalma disponibile</span>
            </div>
            <p className="text-gray-400">
              Puoi ridurre l'ingaggio allungando la durata. Regola: Nuovo Ingaggio × Nuova Durata ≥ {contract.initialSalary}
            </p>
          </div>
        )}

        {/* Modification Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nuovo Ingaggio (M)
            </label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(newSalary) || contract.salary
                  const minSalary = (isSvincolatiMode || increaseOnly) ? contract.salary : 1
                  setNewSalary(String(Math.max(minSalary, current - 1)))
                }}
                disabled={isLoading || isSubmitting || (parseInt(newSalary) || contract.salary) <= ((isSvincolatiMode || increaseOnly) ? contract.salary : 1)}
                className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-l-lg text-white font-bold disabled:opacity-30 hover:bg-surface-300/80 transition-colors"
              >−</button>
              <div className="flex-1 px-2 py-2 bg-surface-300 border-y border-primary-500/30 text-white text-center font-medium">
                {parseInt(newSalary) || contract.salary}M
              </div>
              <button
                type="button"
                onClick={() => {
                  const current = parseInt(newSalary) || contract.salary
                  setNewSalary(String(current + 1))
                }}
                disabled={isLoading || isSubmitting}
                className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-r-lg text-white font-bold disabled:opacity-30 hover:bg-surface-300/80 transition-colors"
              >+</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nuova Durata (semestri)
            </label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setNewDuration(Math.max(minDuration, newDuration - 1))}
                disabled={isLoading || isSubmitting || newDuration <= minDuration}
                className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-l-lg text-white font-bold disabled:opacity-30 hover:bg-surface-300/80 transition-colors"
              >−</button>
              <div className="flex-1 px-2 py-2 bg-surface-300 border-y border-primary-500/30 text-white text-center font-medium">
                {newDuration}s
              </div>
              <button
                type="button"
                onClick={() => setNewDuration(Math.min(4, newDuration + 1))}
                disabled={isLoading || isSubmitting || newDuration >= 4}
                className="px-3 py-2 bg-surface-300 border border-primary-500/30 rounded-r-lg text-white font-bold disabled:opacity-30 hover:bg-surface-300/80 transition-colors"
              >+</button>
            </div>
          </div>
        </div>

        {/* Preview */}
        {preview.hasChanges && (
          <div className={`rounded-lg p-3 border ${
            preview.isValid
              ? 'bg-secondary-500/10 border-secondary-500/30'
              : 'bg-danger-500/10 border-danger-500/30'
          }`}>
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              {preview.isValid ? (
                <span className="text-secondary-400">Anteprima nuovo contratto</span>
              ) : (
                <span className="text-danger-400">Modifica non valida</span>
              )}
            </div>
            {preview.isValid ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">Ingaggio</div>
                  <div className="font-bold text-white">
                    {contract.salary}M → <span className="text-secondary-400">{preview.salary}M</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Durata</div>
                  <div className="font-bold text-white">
                    {contract.duration}s → <span className="text-secondary-400">{preview.duration}s</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Clausola</div>
                  <div className="font-bold text-white">
                    {contract.rescissionClause}M → <span className="text-primary-400">{preview.rescissionClause}M</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-danger-400">{preview.validationError}</p>
            )}
          </div>
        )}

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

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isLoading || isSubmitting}
            className="flex-1"
          >
            Mantieni contratto
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!preview.isValid || !preview.hasChanges || isLoading || isSubmitting}
            isLoading={isSubmitting}
            className="flex-1"
          >
            Conferma modifica
          </Button>
        </div>
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
