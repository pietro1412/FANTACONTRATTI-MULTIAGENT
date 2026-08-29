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

/**
 * Age color coding (younger is better) — canonical reference is the "N anni"
 * chip in PlayerStatsModal's header. Reuse this everywhere age is shown with
 * color instead of re-deriving thresholds: several call sites had drifted to
 * their own variant (different thresholds, theme tokens instead of raw
 * Tailwind colors), giving the same player a different age color depending
 * on which page you were looking at.
 */
export function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400 font-bold'
  if (age < 25) return 'text-green-400'
  if (age < 30) return 'text-yellow-400'
  if (age < 35) return 'text-orange-400'
  return 'text-red-400'
}

/** Minimal shape needed to format the season mini-stats (appearances/goals/assists/rating). */
export interface SeasonStatsInput {
  appearances?: number | null
  totalGoals?: number | null
  totalAssists?: number | null
  avgRating?: number | null
}

export interface FormattedSeasonStats {
  appearances: string
  goals: string
  assists: string
  rating: string
  /** True when all 4 values fell back to ND — callers should collapse the mini-stats into a single muted note. */
  allMissing: boolean
}

/**
 * Formats the 4 season mini-stats (PR/G/A/VT) shared by RosterTableRow and
 * RosterPlayerCard, and flags when every one of them is missing so the caller
 * can collapse them into a single "stats non sync." note instead of 4 ND cells.
 */
export function formatSeasonStats(stats: SeasonStatsInput | null | undefined): FormattedSeasonStats {
  const appearances = formatStat(stats?.appearances)
  const goals = formatStat(stats?.totalGoals)
  const assists = formatStat(stats?.totalAssists)
  const rating = formatStat(stats?.avgRating, { decimals: 1 })
  const allMissing = [appearances, goals, assists, rating].every(value => value === NOT_AVAILABLE)

  return { appearances, goals, assists, rating, allMissing }
}
