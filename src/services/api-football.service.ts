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
    goals: { total: number | null; assists: number | null; conceded: number | null; saves: number | null }
    shots: { total: number | null; on: number | null }
    passes: { total: number | null; key: number | null; accuracy: number | null }
    tackles: { total: number | null; interceptions: number | null }
    dribbles: { attempts: number | null; success: number | null }
    cards: { yellow: number | null; red: number | null }
    penalty: { scored: number | null; missed: number | null; saved: number | null }
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

export interface MatchProposal {
  dbPlayer: { id: string; name: string; team: string; position: string; quotation: number }
  apiPlayer: { id: number; name: string; team: string } | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  method: string
}

export interface ProposalsResult {
  success: boolean
  message?: string
  data?: {
    proposals: MatchProposal[]
    apiCallsUsed: number
    cacheRefreshed: boolean
  }
}

export interface SearchResult {
  success: boolean
  message?: string
  data?: {
    players: Array<{ id: number; name: string; team: string; position: string }>
  }
}

export interface UnmatchedResult {
  success: boolean
  message?: string
  data?: {
    players: Array<{ id: string; name: string; team: string; position: string; quotation: number }>
  }
}

export interface MatchedPlayersResult {
  success: boolean
  message?: string
  data?: {
    players: Array<{
      id: string
      name: string
      team: string
      position: string
      quotation: number
      apiFootballId: number
      apiFootballName: string | null
    }>
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
  const normalized = normalizeName(fullName)
  const parts = normalized.split(/\s+/).filter(p => p.length > 0)

  // Filter out initials (single letters) and very short parts
  const nonInitials = parts.filter(p => p.length > 2)

  if (nonInitials.length > 0) {
    // Prefer the LAST part as surname (Italian/Spanish convention: "Name Surname")
    return nonInitials[nonInitials.length - 1]
  }

  // Fallback: return the last part even if short
  return parts.length > 0 ? parts[parts.length - 1] : ''
}

/**
 * Get all name parts for matching (e.g., "Álvaro Morata" → ["alvaro", "morata"])
 */
function getNameParts(fullName: string): string[] {
  const normalized = normalizeName(fullName)
  return normalized.split(/\s+/).filter(p => p.length > 1)
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

    // Pre-load already used API IDs from database
    const existingApiIds = await prisma.serieAPlayer.findMany({
      where: { apiFootballId: { not: null } },
      select: { apiFootballId: true },
    })
    const usedApiIds = new Set<number>(existingApiIds.map((p) => p.apiFootballId!))

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
          const apiId = exactMatches[0].id
          if (!usedApiIds.has(apiId)) {
            matched.push({ dbId: dbPlayer.id, apiId, name: dbPlayer.name })
            matchedDbIds.add(dbPlayer.id)
            usedApiIds.add(apiId)
          }
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
            const apiId = partialMatches[0].id
            if (!usedApiIds.has(apiId)) {
              matched.push({ dbId: dbPlayer.id, apiId, name: dbPlayer.name })
              matchedDbIds.add(dbPlayer.id)
              usedApiIds.add(apiId)
            }
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
    let savedCount = 0
    for (const m of matched) {
      try {
        await prisma.serieAPlayer.update({
          where: { id: m.dbId },
          data: { apiFootballId: m.apiId },
        })
        savedCount++
      } catch (e) {
        // Skip duplicates (unique constraint violations)
        console.log(`Skipped duplicate apiFootballId ${m.apiId} for player ${m.name}`)
      }
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
      message: `Match completato: ${savedCount} matchati, ${ambiguous.length} ambigui, ${unmatched.length} non trovati`,
      data: {
        matched: savedCount,
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
            conceded: serieAStats.goals.conceded,  // Goalkeeper: goals conceded
            saves: serieAStats.goals.saves,        // Goalkeeper: saves
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
            saved: serieAStats.penalty.saved,      // Goalkeeper: penalties saved
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

// ==================== MATCHING ASSISTITO ====================

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

/**
 * Refresh API-Football player cache from squad endpoints
 */
export async function refreshApiFootballCache(userId: string): Promise<{ success: boolean; message?: string; apiCallsUsed: number }> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin', apiCallsUsed: 0 }
  }

  try {
    // 1. Get all Serie A teams
    const teams = await getSerieATeams()
    let apiCallsUsed = 1

    const allPlayers: Array<{ id: number; name: string; team: string; position: string }> = []

    // 2. For each team, fetch squad
    for (const team of teams) {
      const squadData = await apiFootballFetch<ApiSquad>('/players/squads', { team: String(team.id) })
      apiCallsUsed++

      if (squadData.results > 0 && squadData.response[0]) {
        const dbTeamName = normalizeTeamName(team.name)
        for (const player of squadData.response[0].players) {
          allPlayers.push({
            id: player.id,
            name: player.name,
            team: dbTeamName,
            position: player.position || 'Unknown',
          })
        }
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 3. Upsert all players into cache
    const now = new Date()
    for (const player of allPlayers) {
      await prisma.apiFootballPlayerCache.upsert({
        where: { id: player.id },
        update: {
          name: player.name,
          team: player.team,
          position: player.position,
          cachedAt: now,
        },
        create: {
          id: player.id,
          name: player.name,
          team: player.team,
          position: player.position,
          cachedAt: now,
        },
      })
    }

    return {
      success: true,
      message: `Cache aggiornata: ${allPlayers.length} giocatori da ${teams.length} squadre`,
      apiCallsUsed,
    }
  } catch (error) {
    console.error('refreshApiFootballCache error:', error)
    return { success: false, message: `Errore: ${(error as Error).message}`, apiCallsUsed: 0 }
  }
}

/**
 * Generate match proposals without saving - for assisted matching
 */
export async function getMatchProposals(userId: string): Promise<ProposalsResult> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin' }
  }

  try {
    // Check if cache is empty or stale (older than 7 days)
    const cacheCount = await prisma.apiFootballPlayerCache.count()
    const oldestCache = await prisma.apiFootballPlayerCache.findFirst({
      orderBy: { cachedAt: 'asc' },
      select: { cachedAt: true },
    })

    let apiCallsUsed = 0
    let cacheRefreshed = false

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    if (cacheCount === 0 || (oldestCache && oldestCache.cachedAt < sevenDaysAgo)) {
      // Refresh cache
      const refreshResult = await refreshApiFootballCache(userId)
      apiCallsUsed = refreshResult.apiCallsUsed
      cacheRefreshed = true
    }

    // Get all unmatched DB players
    const dbPlayers = await prisma.serieAPlayer.findMany({
      where: { isActive: true, apiFootballId: null },
      select: { id: true, name: true, team: true, position: true, quotation: true },
    })

    if (dbPlayers.length === 0) {
      return {
        success: true,
        message: 'Tutti i giocatori sono gia matchati',
        data: { proposals: [], apiCallsUsed, cacheRefreshed },
      }
    }

    // Get all cached API players
    const apiPlayers = await prisma.apiFootballPlayerCache.findMany()

    // Pre-load already used API IDs
    const existingApiIds = await prisma.serieAPlayer.findMany({
      where: { apiFootballId: { not: null } },
      select: { apiFootballId: true },
    })
    const usedApiIds = new Set<number>(existingApiIds.map((p) => p.apiFootballId!))

    // Generate proposals
    const proposals: MatchProposal[] = []

    for (const dbPlayer of dbPlayers) {
      const dbLastName = extractLastName(dbPlayer.name)
      const dbFullNorm = normalizeName(dbPlayer.name)

      // Filter API players by team first
      const teamPlayers = apiPlayers.filter((api) => api.team === dbPlayer.team)

      let bestMatch: { player: typeof apiPlayers[0]; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; method: string } | null = null

      for (const apiPlayer of teamPlayers) {
        if (usedApiIds.has(apiPlayer.id)) continue

        const apiNorm = normalizeName(apiPlayer.name)
        const apiLastName = extractLastName(apiPlayer.name)
        const apiParts = getNameParts(apiPlayer.name)
        const dbParts = getNameParts(dbPlayer.name)

        // HIGH confidence: exact full name match
        if (apiNorm === dbFullNorm) {
          bestMatch = { player: apiPlayer, confidence: 'HIGH', method: 'exact_full_name' }
          break
        }

        // HIGH confidence: exact last name match
        if (apiLastName === dbLastName && apiLastName.length >= 3) {
          if (!bestMatch || bestMatch.confidence !== 'HIGH') {
            bestMatch = { player: apiPlayer, confidence: 'HIGH', method: 'exact_last_name' }
          }
        }

        // HIGH confidence: DB name matches ANY part of API name exactly
        // e.g., "Morata" matches "Álvaro Morata" because "morata" is in apiParts
        if (!bestMatch || bestMatch.confidence !== 'HIGH') {
          for (const dbPart of dbParts) {
            if (dbPart.length >= 3 && apiParts.includes(dbPart)) {
              bestMatch = { player: apiPlayer, confidence: 'HIGH', method: 'name_part_match' }
              break
            }
          }
        }

        // MEDIUM confidence: partial name match (one contains the other)
        if (!bestMatch || bestMatch.confidence === 'LOW' || bestMatch.confidence === 'NONE') {
          for (const dbPart of dbParts) {
            for (const apiPart of apiParts) {
              if (dbPart.length >= 3 && apiPart.length >= 3) {
                if (apiPart.includes(dbPart) || dbPart.includes(apiPart)) {
                  if (!bestMatch || bestMatch.confidence === 'LOW' || bestMatch.confidence === 'NONE') {
                    bestMatch = { player: apiPlayer, confidence: 'MEDIUM', method: 'partial_name' }
                  }
                }
              }
            }
          }
        }

        // LOW confidence: Levenshtein distance on last names
        if (!bestMatch) {
          const distance = levenshteinDistance(apiLastName, dbLastName)
          const maxLen = Math.max(apiLastName.length, dbLastName.length)
          if (maxLen > 0 && distance / maxLen <= 0.3) {
            bestMatch = { player: apiPlayer, confidence: 'LOW', method: 'levenshtein' }
          }
        }
      }

      proposals.push({
        dbPlayer: {
          id: dbPlayer.id,
          name: dbPlayer.name,
          team: dbPlayer.team,
          position: dbPlayer.position,
          quotation: dbPlayer.quotation,
        },
        apiPlayer: bestMatch ? { id: bestMatch.player.id, name: bestMatch.player.name, team: bestMatch.player.team } : null,
        confidence: bestMatch ? bestMatch.confidence : 'NONE',
        method: bestMatch ? bestMatch.method : 'no_match',
      })
    }

    // Sort: HIGH first, then MEDIUM, then LOW, then NONE
    const confidenceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 }
    proposals.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence])

    return {
      success: true,
      data: { proposals, apiCallsUsed, cacheRefreshed },
    }
  } catch (error) {
    console.error('getMatchProposals error:', error)
    return { success: false, message: `Errore: ${(error as Error).message}` }
  }
}

/**
 * Search API-Football players in cache by name
 * Supports partial matching and handles diacritics (e.g., "Yildiz" matches "Yıldız")
 */
export async function searchApiFootballPlayers(userId: string, query: string): Promise<SearchResult> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin' }
  }

  if (!query || query.length < 2) {
    return { success: false, message: 'Query deve avere almeno 2 caratteri' }
  }

  try {
    // Normalize query for comparison
    const normalizedQuery = normalizeName(query)

    // Get all cached players (we'll filter in memory for better diacritic handling)
    const allPlayers = await prisma.apiFootballPlayerCache.findMany({
      orderBy: { name: 'asc' },
    })

    // Get already used API IDs
    const existingApiIds = await prisma.serieAPlayer.findMany({
      where: { apiFootballId: { not: null } },
      select: { apiFootballId: true },
    })
    const usedApiIds = new Set<number>(existingApiIds.map((p) => p.apiFootballId!))

    // Filter players: match normalized name contains normalized query
    const matchingPlayers = allPlayers
      .filter((p) => {
        if (usedApiIds.has(p.id)) return false
        const normalizedName = normalizeName(p.name)
        return normalizedName.includes(normalizedQuery)
      })
      .slice(0, 50)
      .map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        position: p.position,
      }))

    return {
      success: true,
      data: { players: matchingPlayers },
    }
  } catch (error) {
    console.error('searchApiFootballPlayers error:', error)
    return { success: false, message: `Errore: ${(error as Error).message}` }
  }
}

/**
 * Get unmatched DB players (those without apiFootballId)
 */
export async function getUnmatchedPlayers(userId: string, search?: string): Promise<UnmatchedResult> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin' }
  }

  try {
    const where: Parameters<typeof prisma.serieAPlayer.findMany>[0]['where'] = {
      isActive: true,
      apiFootballId: null,
    }

    if (search && search.length >= 2) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      }
    }

    const players = await prisma.serieAPlayer.findMany({
      where,
      select: {
        id: true,
        name: true,
        team: true,
        position: true,
        quotation: true,
      },
      orderBy: [{ team: 'asc' }, { name: 'asc' }],
      take: 100,
    })

    return {
      success: true,
      data: {
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          team: p.team,
          position: p.position,
          quotation: p.quotation,
        })),
      },
    }
  } catch (error) {
    console.error('getUnmatchedPlayers error:', error)
    return { success: false, message: `Errore: ${(error as Error).message}` }
  }
}

/**
 * Get matched DB players (those with apiFootballId) with their API-Football info
 */
export async function getMatchedPlayers(userId: string, search?: string): Promise<MatchedPlayersResult> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin' }
  }

  try {
    const where: Parameters<typeof prisma.serieAPlayer.findMany>[0]['where'] = {
      isActive: true,
      apiFootballId: { not: null },
    }

    if (search && search.length >= 2) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      }
    }

    const players = await prisma.serieAPlayer.findMany({
      where,
      select: {
        id: true,
        name: true,
        team: true,
        position: true,
        quotation: true,
        apiFootballId: true,
      },
      orderBy: [{ team: 'asc' }, { name: 'asc' }],
    })

    // Get API-Football names from cache
    const apiIds = players.map((p) => p.apiFootballId!).filter(Boolean)
    const apiPlayers = await prisma.apiFootballPlayerCache.findMany({
      where: { id: { in: apiIds } },
      select: { id: true, name: true },
    })
    const apiNameMap = new Map(apiPlayers.map((p) => [p.id, p.name]))

    return {
      success: true,
      data: {
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          team: p.team,
          position: p.position,
          quotation: p.quotation,
          apiFootballId: p.apiFootballId!,
          apiFootballName: apiNameMap.get(p.apiFootballId!) || null,
        })),
      },
    }
  } catch (error) {
    console.error('getMatchedPlayers error:', error)
    return { success: false, message: `Errore: ${(error as Error).message}` }
  }
}

/**
 * Remove a match (reset apiFootballId to null)
 */
export async function removeMatch(userId: string, playerId: string): Promise<{ success: boolean; message?: string }> {
  const { verifySuperAdmin } = await import('./superadmin.service')
  if (!(await verifySuperAdmin(userId))) {
    return { success: false, message: 'Non autorizzato: solo super admin' }
  }

  try {
    const player = await prisma.serieAPlayer.findUnique({
      where: { id: playerId },
      select: { id: true, name: true, apiFootballId: true },
    })

    if (!player) {
      return { success: false, message: 'Giocatore non trovato' }
    }

    if (!player.apiFootballId) {
      return { success: false, message: 'Giocatore non ha un match da rimuovere' }
    }

    await prisma.serieAPlayer.update({
      where: { id: playerId },
      data: {
        apiFootballId: null,
        apiFootballStats: null,
        statsSyncedAt: null,
      },
    })

    return { success: true, message: `Match rimosso per ${player.name}` }
  } catch (error) {
    console.error('removeMatch error:', error)
    return { success: false, message: `Errore: ${(error as Error).message}` }
  }
}
