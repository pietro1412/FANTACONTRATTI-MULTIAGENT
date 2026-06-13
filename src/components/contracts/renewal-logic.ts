import { DURATION_MULTIPLIERS } from './shared'

export interface RenewalConstraintsInput {
  salary: number
  duration: number
  initialSalary: number
  canSpalmare: boolean
  newSalary: number
  newDuration: number
}

export interface RenewalConstraints {
  newRescissionClause: number
  newRubata: number
  hasChanges: boolean
  minSalaryAllowed: number
  canIncreaseDuration: boolean
  canDecreaseSalary: boolean
  minDurationAllowed: number
  canDecreaseDuration: boolean
  /** Persistent hint when a stepper is constrained (visible on touch, not only in title) */
  salaryHint: string | null
  durationHint: string | null
}

/**
 * Pure derivation of the renewal stepper constraints (spalma rules, issues
 * #207/#221/#222). Extracted verbatim from the previous inline logic so the
 * behaviour is identical and not duplicated across mobile/desktop views.
 */
export function getRenewalConstraints({
  salary,
  duration,
  initialSalary,
  canSpalmare,
  newSalary,
  newDuration,
}: RenewalConstraintsInput): RenewalConstraints {
  const newMultiplier = DURATION_MULTIPLIERS[newDuration] || 7
  const newRescissionClause = newSalary * newMultiplier
  const newRubata = newRescissionClause + newSalary
  const hasChanges = newSalary !== salary || newDuration !== duration

  const minSalaryAllowed = canSpalmare && newDuration > 1
    ? Math.ceil(initialSalary / newDuration)
    : salary

  const hasSalaryIncrease = newSalary > salary
  const canIncreaseDuration = canSpalmare || hasSalaryIncrease

  const canDecreaseSalary = canSpalmare
    ? newSalary > minSalaryAllowed
    : newSalary > salary && (newDuration <= duration || newSalary > salary + 1)

  const minDurationAllowed = canSpalmare
    ? Math.max(1, Math.ceil(initialSalary / newSalary))
    : duration

  const canDecreaseDuration = newDuration > 1 && newDuration > minDurationAllowed

  let salaryHint: string | null = null
  if (canSpalmare && newDuration > 1) {
    salaryHint = `Min con ${newDuration}s: ${minSalaryAllowed}M`
  }

  let durationHint: string | null = null
  if (!canIncreaseDuration && newDuration < 4) {
    durationHint = 'Aumenta l\'ingaggio per estendere'
  } else if (canSpalmare && !canDecreaseDuration && newDuration > 1) {
    durationHint = 'Aumenta l\'ingaggio per ridurre'
  }

  return {
    newRescissionClause,
    newRubata,
    hasChanges,
    minSalaryAllowed,
    canIncreaseDuration,
    canDecreaseSalary,
    minDurationAllowed,
    canDecreaseDuration,
    salaryHint,
    durationHint,
  }
}
