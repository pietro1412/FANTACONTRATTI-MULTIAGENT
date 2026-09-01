/**
 * Fantacalcio.it player matching service.
 *
 * Utility di normalizzazione/matching nomi DUPLICATE (non estratte) da
 * api-football.service.ts per isolare completamente il rischio di
 * regressione sul matching API-Football gia' in produzione. Stessa logica
 * a 4 strategie (cognome esatto, cognome parziale, name-part, Levenshtein),
 * vedi docs/bibbie/STATISTICHE-GIOCATORI.md §2.
 */

// ==================== TYPES ====================

export interface FantacalcioCandidate {
  fantacalcioPlayerId: number
  name: string
  team: string
}

export interface DbCandidate {
  id: string
  name: string
  team: string
}

export interface MatchedPair {
  dbId: string
  fantacalcioPlayerId: number
  dbName: string
  fantacalcioName: string
  strategy: 'EXACT' | 'PARTIAL' | 'NAME_PART' | 'LEVENSHTEIN'
}

export interface AmbiguousMatch {
  dbPlayer: DbCandidate
  candidates: FantacalcioCandidate[]
  strategy: string
}

export interface MatchReport {
  matched: MatchedPair[]
  ambiguous: AmbiguousMatch[]
  unmatchedDb: DbCandidate[]
  unmatchedFantacalcio: FantacalcioCandidate[]
}

// ==================== NORMALIZATION (duplicata da api-football.service.ts) ====================

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // Remove diacritics
    .replace(/[^a-z\s]/g, '') // Keep only letters and spaces
    .trim()
}

export function extractLastName(fullName: string): string {
  const normalized = normalizeName(fullName)
  const parts = normalized.split(/\s+/).filter((p) => p.length > 0)
  const nonInitials = parts.filter((p) => p.length > 2)
  if (nonInitials.length > 0) {
    return nonInitials[nonInitials.length - 1]!
  }
  return parts.length > 0 ? parts[parts.length - 1]! : ''
}

export function getNameParts(fullName: string): string[] {
  const normalized = normalizeName(fullName)
  return normalized.split(/\s+/).filter((p) => p.length > 1)
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!
      } else {
        matrix[i]![j] = Math.min(
          (matrix[i - 1]![j - 1] ?? 0) + 1,
          (matrix[i]![j - 1] ?? 0) + 1,
          (matrix[i - 1]![j] ?? 0) + 1
        )
      }
    }
  }
  return matrix[b.length]![a.length]!
}

// ==================== MATCHING ====================

/**
 * Match giocatori fantacalcio.it -> SerieAPlayer del DB, raggruppando per
 * squadra (stesso nome esatto in entrambe le fonti, nessuna mappa di
 * normalizzazione team richiesta: fantacalcio.it e le quotazioni usano gia'
 * la stessa nomenclatura breve, es. "Lazio", "Milan", "Inter").
 */
export function matchFantacalcioPlayers(
  dbPlayers: DbCandidate[],
  fantacalcioPlayers: FantacalcioCandidate[]
): MatchReport {
  const matched: MatchedPair[] = []
  const ambiguous: AmbiguousMatch[] = []
  const matchedDbIds = new Set<string>()
  const matchedFcIds = new Set<number>()

  const teams = new Set(dbPlayers.map((p) => p.team))

  for (const team of teams) {
    const dbTeamPlayers = dbPlayers.filter((p) => p.team === team)
    const fcTeamPlayers = fantacalcioPlayers.filter((p) => p.team === team)
    if (fcTeamPlayers.length === 0) continue

    for (const dbPlayer of dbTeamPlayers) {
      const dbLastName = extractLastName(dbPlayer.name)
      const dbFullNorm = normalizeName(dbPlayer.name)

      const exact = fcTeamPlayers.filter((fc) => {
        const fcNorm = normalizeName(fc.name)
        const fcLastName = extractLastName(fc.name)
        return fcLastName === dbLastName || fcNorm === dbFullNorm
      })

      const tryRecord = (
        candidates: FantacalcioCandidate[],
        strategy: MatchedPair['strategy']
      ): boolean => {
        if (candidates.length === 1) {
          const fc = candidates[0]!
          matched.push({
            dbId: dbPlayer.id,
            fantacalcioPlayerId: fc.fantacalcioPlayerId,
            dbName: dbPlayer.name,
            fantacalcioName: fc.name,
            strategy,
          })
          matchedDbIds.add(dbPlayer.id)
          matchedFcIds.add(fc.fantacalcioPlayerId)
          return true
        }
        if (candidates.length > 1) {
          ambiguous.push({ dbPlayer, candidates, strategy })
          matchedDbIds.add(dbPlayer.id)
          return true
        }
        return false
      }

      if (tryRecord(exact, 'EXACT')) continue

      const partial = fcTeamPlayers.filter((fc) => {
        const fcLastName = extractLastName(fc.name)
        return fcLastName.includes(dbLastName) || dbLastName.includes(fcLastName)
      })
      if (tryRecord(partial, 'PARTIAL')) continue

      const dbParts = getNameParts(dbPlayer.name)
      const namePart = fcTeamPlayers.filter((fc) => {
        const fcParts = getNameParts(fc.name)
        return dbParts.some((dp) => dp.length >= 3 && fcParts.includes(dp))
      })
      if (tryRecord(namePart, 'NAME_PART')) continue

      const lev = fcTeamPlayers.filter((fc) => {
        const fcLastName = extractLastName(fc.name)
        const distance = levenshteinDistance(fcLastName, dbLastName)
        const maxLen = Math.max(fcLastName.length, dbLastName.length)
        return maxLen > 0 && distance / maxLen <= 0.2
      })
      tryRecord(lev, 'LEVENSHTEIN')
    }
  }

  const unmatchedDb = dbPlayers.filter((p) => !matchedDbIds.has(p.id))
  const unmatchedFantacalcio = fantacalcioPlayers.filter((p) => !matchedFcIds.has(p.fantacalcioPlayerId))

  return { matched, ambiguous, unmatchedDb, unmatchedFantacalcio }
}
