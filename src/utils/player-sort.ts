/**
 * Shared player ordering utility.
 *
 * "Natural" ordering across the platform: first by ROLE in the canonical
 * order Goalkeepers -> Defenders -> Midfielders -> Forwards (Position enum:
 * P, D, C, A), then alphabetically by name within each role.
 *
 * Use this everywhere a player list should follow the natural order
 * (rosters, slots, auction nomination lists). The Players page uses a
 * user-selectable sort and should not force this order; it can still use
 * the comparator as a secondary tiebreaker / initial default.
 */

/** Canonical role weight. Lower sorts first. */
export const ROLE_ORDER: Record<string, number> = { P: 0, D: 1, C: 2, A: 3 }

/** Unknown roles sort after all known ones. */
const UNKNOWN_ROLE_WEIGHT = 99

/**
 * Compare two players by role (P/D/C/A) then alphabetically by name.
 * Returns a negative/zero/positive number suitable for Array.prototype.sort.
 */
export function comparePlayersByRoleAndName(
  a: { position: string; name: string },
  b: { position: string; name: string }
): number {
  const roleA = ROLE_ORDER[a.position] ?? UNKNOWN_ROLE_WEIGHT
  const roleB = ROLE_ORDER[b.position] ?? UNKNOWN_ROLE_WEIGHT
  if (roleA !== roleB) return roleA - roleB
  return a.name.localeCompare(b.name)
}

/**
 * Return a NEW array sorted by role then name. Does not mutate the input.
 */
export function sortPlayersByRoleAndName<T extends { position: string; name: string }>(
  players: T[]
): T[] {
  return [...players].sort(comparePlayersByRoleAndName)
}
