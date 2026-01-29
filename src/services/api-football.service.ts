import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ==================== TYPES ====================

interface ApiFootballResponse<T> {
  get: string
  parameters: Record<string, string>
  errors: Record<string, string>
  results: number
  paging: { current: number; total: number }
  response: T[]
}

interface ApiTeam {
  team: { id: number; name: string; code: string; country: string; logo: string }
  venue: unknown
}

interface ApiSquadPlayer {
  id: number
  name: string
  age: number
  number: number | null
  position: string
  photo: string
}

interface ApiSquad {
  team: { id: number; name: string; logo: string }
  players: ApiSquadPlayer[]
}

interface ApiPlayerStats {
  player: {
    id: number
    name: string
    firstname: string
    lastname: string
    age: number
    nationality: string
    photo: string
  }
  statistics: Array<{
    team: { id: number; name: string }
    league: { id: number; name: string; season: number }
    games: { appearences: number | null; minutes: number | null; rating: string | null }
    goals: { total: number | null; assists: number | null }
    shots: { total: number | null; on: number | null }
    passes: { total: number | null; key: number | null; accuracy: number | null }
    tackles: { total: number | null; interceptions: number | null }
    dribbles: { attempts: number | null; success: number | null }
    cards: { yellow: number | null; red: number | null }
    penalty: { scored: number | null; missed: number | null }
  }>
}

export interface MatchResult {
  success: boolean
  message?: string
  data?: {
    matched: number
    unmatched: Array<{ id: string; name: string; team: string }>
    ambiguous: Array<{ player: { id: string; name: string; team: string }; candidates: Array<{ apiId: number; name: string }> }>
    alreadyMatched: number
    apiCallsUsed: number
  }
}

export interface SyncResult {
  success: boolean
  message?: string
  data?: {
    synced: number
    notFound: number
    noApiId: number
    apiCallsUsed: number
  }
}

export interface SyncStatus {
  success: boolean
  message?: string
  data?: {
    totalPlayers: number
    matched: number
    unmatched: number
    withStats: number
    withoutStats: number
    lastSync: string | null
  }
}

// ==================== CONSTANTS ====================

const API_BASE = 'https://v3.football.api-sports.io'
const SERIE_A_LEAGUE_ID = 135
const CURRENT_SEASON = 2025

// Map API-Football team names → DB team names (from quotazioni file)
const TEAM_NAME_MAP: Record<string, string> = {
  'ac milan': 'Milan',
  'inter': 'Inter',
  'juventus': 'Juventus',
  'napoli': 'Napoli',
  'as roma': 'Roma',
  'ss lazio': 'Lazio',
  'lazio': 'Lazio',
  'atalanta': 'Atalanta',
  'fiorentina': 'Fiorentina',
  'torino': 'Torino',
  'bologna': 'Bologna',
  'monza': 'Monza',
  'udinese': 'Udinese',
  'empoli': 'Empoli',
  'cagliari': 'Cagliari',
  'hellas verona': 'Verona',
  'verona': 'Verona',
  'lecce': 'Lecce',
  'genoa': 'Genoa',
  'como': 'Como',
  'como 1907': 'Como',
  'parma': 'Parma',
  'venezia': 'Venezia',
  'salernitana': 'Salernitana',
  'frosinone': 'Frosinone',
  'sassuolo': 'Sassuolo',
  'spezia': 'Spezia',
  'cremonese': 'Cremonese',
  'sampdoria': 'Sampdoria',
}

// ==================== HELPERS ====================

async function apiFootballFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<ApiFootballResponse<T>> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY non configurata')
  }

  const url = new URL(API_BASE + endpoint)
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })

  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}: ${res.statusText}`)
  }

  const data = await res.json() as ApiFootballResponse<T>

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football errors: ${JSON.stringify(data.errors)}`)
  }

  return data
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/[^a-z\s]/g, '')         // Keep only letters and spaces
    .trim()
}

function normalizeTeamName(apiTeamName: string): string {
  const normalized = normalizeName(apiTeamName)
  return TEAM_NAME_MAP[normalized] || apiTeamName
}

function extractLastName(fullName: string): string {
  const parts = normalizeName(fullName).split(/\s+/)
  return parts[parts.length - 1]
}

// ==================== SERVICE FUNCTIONS ====================

/**
 * Get all Serie A teams from API-Football
 */
async function getSerieATeams(): Promise<Array<{ id: number; name: string }>> {
  const data = await apiFootballFetch<ApiTeam>('/teams', {
    league: String(SERIE_A_LEAGUE_ID),
    season: String(CURRENT_SEASON),
  })

  return data.response.map((t) => ({
    id: t.team.id,
    name: t.team.name,
  }))
}

/**
 * Match DB players to API-Football player IDs using squad endpoints.
 * Only processes players that don't already have an apiFootballId.
 */
export async function matchPlayers(userId: string): Promise<MatchResult> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin' }
  }

  try {
    // 1. Get all Serie A teams
    const teams = await getSerieATeams()
    let apiCallsUsed = 1

    // 2. Get all DB players without apiFootballId
    const dbPlayers = await prisma.serieAPlayer.findMany({
      where: { isActive: true, apiFootballId: null },
      select: { id: true, name: true, team: true },
    })

    if (dbPlayers.length === 0) {
      const alreadyMatched = await prisma.serieAPlayer.count({
        where: { isActive: true, apiFootballId: { not: null } },
      })
      return {
        success: true,
        message: 'Tutti i giocatori sono gia matchati',
        data: { matched: 0, unmatched: [], ambiguous: [], alreadyMatched, apiCallsUsed: 0 },
      }
    }

    // 3. For each team, fetch squad and try to match
    const matched: Array<{ dbId: string; apiId: number; name: string }> = []
    const ambiguous: Array<{ player: { id: string; name: string; team: string }; candidates: Array<{ apiId: number; name: string }> }> = []
    const matchedDbIds = new Set<string>()

    for (const team of teams) {
      const dbTeamName = normalizeTeamName(team.name)
      const teamPlayers = dbPlayers.filter((p) => p.team === dbTeamName)

      if (teamPlayers.length === 0) continue

      // Fetch squad
      const squadData = await apiFootballFetch<ApiSquad>('/players/squads', { team: String(team.id) })
      apiCallsUsed++

      if (squadData.results === 0 || !squadData.response[0]) continue

      const apiSquad = squadData.response[0].players

      for (const dbPlayer of teamPlayers) {
        const dbLastName = extractLastName(dbPlayer.name)
        const dbFullNorm = normalizeName(dbPlayer.name)

        // Try exact last name match
        const exactMatches = apiSquad.filter((api) => {
          const apiNorm = normalizeName(api.name)
          const apiLastName = extractLastName(api.name)
          return apiLastName === dbLastName || apiNorm === dbFullNorm
        })

        if (exactMatches.length === 1) {
          matched.push({ dbId: dbPlayer.id, apiId: exactMatches[0].id, name: dbPlayer.name })
          matchedDbIds.add(dbPlayer.id)
        } else if (exactMatches.length > 1) {
          ambiguous.push({
            player: { id: dbPlayer.id, name: dbPlayer.name, team: dbPlayer.team },
            candidates: exactMatches.map((m) => ({ apiId: m.id, name: m.name })),
          })
          matchedDbIds.add(dbPlayer.id) // Don't count as unmatched
        } else {
          // Try partial match
          const partialMatches = apiSquad.filter((api) => {
            const apiLastName = extractLastName(api.name)
            return apiLastName.includes(dbLastName) || dbLastName.includes(apiLastName)
          })

          if (partialMatches.length === 1) {
            matched.push({ dbId: dbPlayer.id, apiId: partialMatches[0].id, name: dbPlayer.name })
            matchedDbIds.add(dbPlayer.id)
          } else if (partialMatches.length > 1) {
            ambiguous.push({
              player: { id: dbPlayer.id, name: dbPlayer.name, team: dbPlayer.team },
              candidates: partialMatches.map((m) => ({ apiId: m.id, name: m.name })),
            })
            matchedDbIds.add(dbPlayer.id)
          }
        }
      }

      // Rate limiting: small delay between calls
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 4. Save matched players to DB
    for (const m of matched) {
      await prisma.serieAPlayer.update({
        where: { id: m.dbId },
        data: { apiFootballId: m.apiId },
      })
    }

    // 5. Collect unmatched
    const unmatched = dbPlayers
      .filter((p) => !matchedDbIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, team: p.team }))

    const alreadyMatched = await prisma.serieAPlayer.count({
      where: { isActive: true, apiFootballId: { not: null } },
    })

    return {
      success: true,
      message: `Match completato: ${matched.length} matchati, ${ambiguous.length} ambigui, ${unmatched.length} non trovati`,
      data: {
        matched: matched.length,
        unmatched,
        ambiguous,
        alreadyMatched,
        apiCallsUsed,
      },
    }
  } catch (error) {
    console.error('matchPlayers error:', error)
    return { success: false, message: `Errore matching: ${(error as Error).message}` }
  }
}

/**
 * Manually match a DB player to an API-Football ID
 */
export async function manualMatch(userId: string, playerId: string, apiFootballId: number): Promise<{ success: boolean; message?: string }> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin' }
  }

  try {
    const player = await prisma.serieAPlayer.findUnique({ where: { id: playerId } })
    if (!player) {
      return { success: false, message: 'Giocatore non trovato' }
    }

    // Check if apiFootballId is already assigned to another player
    const existing = await prisma.serieAPlayer.findUnique({ where: { apiFootballId } })
    if (existing && existing.id !== playerId) {
      return { success: false, message: `API-Football ID ${apiFootballId} gia assegnato a ${existing.name}` }
    }

    await prisma.serieAPlayer.update({
      where: { id: playerId },
      data: { apiFootballId },
    })

    return { success: true, message: `${player.name} matchato con API-Football ID ${apiFootballId}` }
  } catch (error) {
    console.error('manualMatch error:', error)
    return { success: false, message: `Errore: ${(error as Error).message}` }
  }
}

/**
 * Sync stats from API-Football for all players that have an apiFootballId.
 * Uses the paginated /players endpoint to get all Serie A stats at once.
 */
export async function syncStats(userId: string): Promise<SyncResult> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin' }
  }

  try {
    // 1. Get all players with apiFootballId
    const dbPlayers = await prisma.serieAPlayer.findMany({
      where: { apiFootballId: { not: null } },
      select: { id: true, apiFootballId: true, name: true },
    })

    if (dbPlayers.length === 0) {
      return {
        success: true,
        message: 'Nessun giocatore con API-Football ID. Esegui prima il matching.',
        data: { synced: 0, notFound: 0, noApiId: 0, apiCallsUsed: 0 },
      }
    }

    // Build lookup map: apiFootballId → dbPlayer
    const apiIdMap = new Map<number, { id: string; name: string }>()
    for (const p of dbPlayers) {
      if (p.apiFootballId) {
        apiIdMap.set(p.apiFootballId, { id: p.id, name: p.name })
      }
    }

    // 2. Fetch all Serie A player stats page by page
    let page = 1
    let totalPages = 1
    let apiCallsUsed = 0
    let synced = 0
    let notFound = 0
    const now = new Date()

    while (page <= totalPages) {
      const data = await apiFootballFetch<ApiPlayerStats>('/players', {
        league: String(SERIE_A_LEAGUE_ID),
        season: String(CURRENT_SEASON),
        page: String(page),
      })
      apiCallsUsed++

      totalPages = data.paging.total

      // Process each player in the response
      for (const apiPlayer of data.response) {
        const dbPlayer = apiIdMap.get(apiPlayer.player.id)
        if (!dbPlayer) continue

        // Find the Serie A stats entry
        const serieAStats = apiPlayer.statistics.find(
          (s) => s.league.id === SERIE_A_LEAGUE_ID
        )

        if (!serieAStats) {
          notFound++
          continue
        }

        // Build stats JSON
        const stats = {
          games: {
            appearences: serieAStats.games.appearences,
            minutes: serieAStats.games.minutes,
            rating: serieAStats.games.rating ? parseFloat(serieAStats.games.rating) : null,
          },
          goals: {
            total: serieAStats.goals.total,
            assists: serieAStats.goals.assists,
          },
          shots: {
            total: serieAStats.shots.total,
            on: serieAStats.shots.on,
          },
          passes: {
            total: serieAStats.passes.total,
            key: serieAStats.passes.key,
            accuracy: serieAStats.passes.accuracy,
          },
          tackles: {
            total: serieAStats.tackles.total,
            interceptions: serieAStats.tackles.interceptions,
          },
          dribbles: {
            attempts: serieAStats.dribbles.attempts,
            success: serieAStats.dribbles.success,
          },
          cards: {
            yellow: serieAStats.cards.yellow,
            red: serieAStats.cards.red,
          },
          penalty: {
            scored: serieAStats.penalty.scored,
            missed: serieAStats.penalty.missed,
          },
        }

        await prisma.serieAPlayer.update({
          where: { id: dbPlayer.id },
          data: {
            apiFootballStats: stats,
            statsSyncedAt: now,
          },
        })

        synced++
      }

      page++

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Count players with apiFootballId but not found in API response
    const noApiId = dbPlayers.length - synced - notFound

    return {
      success: true,
      message: `Sync completato: ${synced} aggiornati, ${notFound} senza stats Serie A, ${apiCallsUsed} chiamate API`,
      data: { synced, notFound, noApiId, apiCallsUsed },
    }
  } catch (error) {
    console.error('syncStats error:', error)
    return { success: false, message: `Errore sync: ${(error as Error).message}` }
  }
}

/**
 * Get current sync status
 */
export async function getSyncStatus(userId: string): Promise<SyncStatus> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin' }
  }

  try {
    const totalPlayers = await prisma.serieAPlayer.count({ where: { isActive: true } })
    const matched = await prisma.serieAPlayer.count({ where: { isActive: true, apiFootballId: { not: null } } })
    const withStats = await prisma.serieAPlayer.count({ where: { isActive: true, apiFootballStats: { not: null } } })

    // Get last sync time
    const lastSynced = await prisma.serieAPlayer.findFirst({
      where: { statsSyncedAt: { not: null } },
      orderBy: { statsSyncedAt: 'desc' },
      select: { statsSyncedAt: true },
    })

    return {
      success: true,
      data: {
        totalPlayers,
        matched,
        unmatched: totalPlayers - matched,
        withStats,
        withoutStats: totalPlayers - withStats,
        lastSync: lastSynced?.statsSyncedAt?.toISOString() || null,
      },
    }
  } catch (error) {
    console.error('getSyncStatus error:', error)
    return { success: false, message: `Errore: ${(error as Error).message}` }
  }
}
