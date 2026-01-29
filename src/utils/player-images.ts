// Player and Team image utilities for API-Football integration

// API-Football team IDs for Serie A 2024-25
export const SERIE_A_TEAM_IDS: Record<string, number> = {
  'Atalanta': 499,
  'Bologna': 500,
  'Cagliari': 490,
  'Como': 895,
  'Empoli': 511,
  'Fiorentina': 502,
  'Genoa': 495,
  'Inter': 505,
  'Juventus': 496,
  'Lazio': 487,
  'Lecce': 867,
  'Milan': 489,
  'Monza': 1579,
  'Napoli': 492,
  'Parma': 523,
  'Roma': 497,
  'Torino': 503,
  'Udinese': 494,
  'Venezia': 517,
  'Verona': 504,
}

/**
 * Get player photo URL from API-Football
 * @param apiFootballId - The player's API-Football ID
 * @returns Photo URL or empty string if no ID
 */
export function getPlayerPhotoUrl(apiFootballId: number | null | undefined): string {
  if (apiFootballId) {
    return `https://media.api-sports.io/football/players/${apiFootballId}.png`
  }
  return ''
}

/**
 * Get team logo URL from API-Football
 * @param teamName - The team name (must match Serie A team names)
 * @returns Logo URL or empty string if not found
 */
export function getTeamLogoUrl(teamName: string): string {
  const teamId = SERIE_A_TEAM_IDS[teamName]
  if (teamId) {
    return `https://media.api-sports.io/football/teams/${teamId}.png`
  }
  return ''
}

/**
 * Get team ID from team name
 * @param teamName - The team name
 * @returns Team ID or null if not found
 */
export function getTeamId(teamName: string): number | null {
  return SERIE_A_TEAM_IDS[teamName] || null
}
