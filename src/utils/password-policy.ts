// Unified password policy for the platform.
// Single source of truth for "min 8 · 1 maiuscola · 1 numero" plus strength scoring.
// Used by Register, ResetPassword (and Profile, tappa D).

/** Minimum length required by the policy. */
export const PASSWORD_MIN_LENGTH = 8

/** Human-readable requirements label shown next to the strength meter. */
export const PASSWORD_REQUIREMENTS_HINT = 'Min 8 caratteri · 1 maiuscola · 1 numero'

export interface PasswordValidationResult {
  valid: boolean
  /** Italian error message for the first failed rule, or undefined when valid. */
  message?: string
}

/**
 * Validate a password against the platform policy.
 * Returns the first failing rule's Italian message (mirrors the server-side rules).
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password) return { valid: false, message: 'Inserisci una password' }
  if (password.length < PASSWORD_MIN_LENGTH) return { valid: false, message: 'Minimo 8 caratteri' }
  if (!/[A-Z]/.test(password)) return { valid: false, message: 'Serve almeno una lettera maiuscola' }
  if (!/[0-9]/.test(password)) return { valid: false, message: 'Serve almeno un numero' }
  return { valid: true }
}

export type PasswordStrengthLabel = 'Debole' | 'Media' | 'Buona' | 'Forte'

export interface PasswordStrength {
  /** 0 (empty) to 4 (length + uppercase + number + symbol). */
  score: number
  label: PasswordStrengthLabel
  /** Semantic token color for the meter/label (NO raw bg-*-500). */
  token: 'danger' | 'warning' | 'accent' | 'secondary'
}

/**
 * Compute password strength (0-4) with a semantic token color.
 * 1 point each for: length >= 8, an uppercase letter, a digit, a non-alphanumeric symbol.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0
  if (password.length >= PASSWORD_MIN_LENGTH) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Debole', token: 'danger' }
  if (score === 2) return { score, label: 'Media', token: 'warning' }
  if (score === 3) return { score, label: 'Buona', token: 'accent' }
  return { score, label: 'Forte', token: 'secondary' }
}
