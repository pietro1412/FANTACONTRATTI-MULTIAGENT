// Shared fallback formatting for missing player statistics / values.
// Axiom 6: missing stats render as 'ND', missing anagraphic fields as 'N.D.'.
// Never fall back to '-' or '0' (which read as real values).

/** Fallback for missing statistics (e.g. goals, assists, rating). */
export const NOT_AVAILABLE = 'ND'

/** Fallback for missing anagraphic fields (e.g. age, height). */
export const NOT_DISPONIBILE = 'N.D.'

export interface FormatStatOptions {
  /** Appended to the formatted number (e.g. 'M', '%'). Not appended to the fallback. */
  suffix?: string
  /** Fixed decimal places. When omitted the number is rendered as-is. */
  decimals?: number
  /** Fallback string when the value is null/undefined. Defaults to NOT_AVAILABLE. */
  fallback?: string
}

/**
 * Formats a numeric statistic, returning a fallback ('ND' by default) when the
 * value is null or undefined. Use for any stat/value that can be missing so the
 * UI never shows a misleading '-' or '0'.
 */
export function formatStat(
  value: number | null | undefined,
  options: FormatStatOptions = {}
): string {
  const { suffix = '', decimals, fallback = NOT_AVAILABLE } = options

  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback
  }

  const formatted = decimals !== undefined ? value.toFixed(decimals) : String(value)
  return `${formatted}${suffix}`
}
