// @ts-nocheck
/**
 * Excel Parser for Fantacontratti historical data
 *
 * Handles two very different sheet formats:
 * 1. "Iniziale '11" - The initial roster with full player details
 * 2. 28 auction sheets - Zone 1 (transactions) + Zone 2 (contract registry)
 *
 * The format evolves across 15 years of data, so we use auto-detection.
 */

import XLSX from 'xlsx'
import { resolveNickname, normalizePosition, SESSIONS, type SessionDef } from './config.js'
import type {
  ParsedIniziale, InitialTeamBlock, InitialPlayer,
  ParsedAuctionSession, ParsedZone1, Zone1Team, Zone1Transaction,
  ParsedZone2, Zone2Team, Zone2Contract, ContractType,
  FinancialSummary, ParsedWorkbook,
} from './types.js'

// ============================================================
// CELL HELPERS
// ============================================================

function getCell(ws: any, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c })
  const cell = ws[addr]
  return cell ? String(cell.v).trim() : ''
}

function getCellNum(ws: any, r: number, c: number): number | null {
  const addr = XLSX.utils.encode_cell({ r, c })
  const cell = ws[addr]
  if (!cell) return null
  const n = Number(cell.v)
  return isNaN(n) ? null : n
}

function getRange(ws: any): { maxRow: number; maxCol: number } {
  if (!ws['!ref']) return { maxRow: 0, maxCol: 0 }
  const range = XLSX.utils.decode_range(ws['!ref'])
  return { maxRow: range.e.r, maxCol: range.e.c }
}

// ============================================================
// PARSE INIZIALE '11
// ============================================================

export function parseIniziale(wb: any): ParsedIniziale {
  const ws = wb.Sheets["Iniziale '11"]
  if (!ws) throw new Error("Sheet 'Iniziale '11' not found")

  const { maxRow } = getRange(ws)
  const teams: InitialTeamBlock[] = []

  // === LEFT SIDE (cols A-I): 5 founding teams with full data ===
  // Columns: Ruolo(A=0), Nome(B=1), Età(C=2), Squadra(D=3), PrezzoFC(E=4), QuotFG(F=5), Ingaggio(G=6), Durata(H=7), Clausola(I=8)
  for (let r = 0; r <= maxRow; r++) {
    const a = getCell(ws, r, 0)
    const b = getCell(ws, r, 1)
    if (a && !b) {
      const nextA = getCell(ws, r + 1, 0)
      if (nextA === 'Ruolo') {
        const nickname = a
        const person = resolveNickname(nickname)
        const headerRow = r + 1
        const dataStart = r + 2

        const players: InitialPlayer[] = []
        let totalSpent = 0

        for (let pr = dataStart; pr <= maxRow; pr++) {
          const ruolo = getCell(ws, pr, 0)
          const nome = getCell(ws, pr, 1)
          if (!ruolo || !nome) break

          const price = getCellNum(ws, pr, 4) || 0
          const salary = getCellNum(ws, pr, 6) || 0
          const duration = getCellNum(ws, pr, 7) || 0
          const clause = getCellNum(ws, pr, 8) || 0

          players.push({
            position: normalizePosition(ruolo),
            name: nome.toLowerCase(),
            age: getCellNum(ws, pr, 2),
            club: getCell(ws, pr, 3),
            price,
            quotation: getCellNum(ws, pr, 5),
            salary,
            duration,
            clause,
          })

          totalSpent += price
        }

        teams.push({ nickname, person, players, totalSpent, headerRow, dataStartRow: dataStart })
      }
    }
  }

  // === RIGHT SIDE (cols O-U): 3 additional teams (joined 2012) with contracts but NO purchase price ===
  // Columns: Ruolo(O=14), Nome(P=15), Età(Q=16), Squadra(R=17), Ingaggio(S=18), Durata(T=19), Clausola(U=20)
  const rightBaseCol = 14 // column O
  for (let r = 0; r <= maxRow; r++) {
    const o = getCell(ws, r, rightBaseCol)
    const p = getCell(ws, r, rightBaseCol + 1)
    if (o && !p) {
      const nextO = getCell(ws, r + 1, rightBaseCol)
      if (nextO === 'Ruolo') {
        const nickname = o
        const person = resolveNickname(nickname)
        const headerRow = r + 1
        const dataStart = r + 2

        const players: InitialPlayer[] = []

        for (let pr = dataStart; pr <= maxRow; pr++) {
          const ruolo = getCell(ws, pr, rightBaseCol)
          const nome = getCell(ws, pr, rightBaseCol + 1)
          if (!ruolo || !nome) break

          const salary = getCellNum(ws, pr, rightBaseCol + 4) || 0  // col S = Ingaggio
          const duration = getCellNum(ws, pr, rightBaseCol + 5) || 0 // col T = Durata
          const clause = getCellNum(ws, pr, rightBaseCol + 6) || 0   // col U = Clausola

          players.push({
            position: normalizePosition(ruolo),
            name: nome.toLowerCase(),
            age: getCellNum(ws, pr, rightBaseCol + 2),   // col Q = Età
            club: getCell(ws, pr, rightBaseCol + 3),      // col R = Squadra
            price: 0,           // No purchase price for right-side teams
            quotation: null,    // No quotation for right-side teams
            salary,
            duration,
            clause,
          })
        }

        teams.push({ nickname, person, players, totalSpent: 0, headerRow, dataStartRow: dataStart })
      }
    }
  }

  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0)
  return { teams, totalPlayers }
}

// ============================================================
// PARSE AUCTION SHEETS (Zone 1 + Zone 2)
// ============================================================

/**
 * Detect the header row and nickname columns in Zone 1.
 * Nicknames can be at even columns (A,C,E...) or odd columns (B,D,F...).
 * Returns the row and the list of columns where nicknames were found.
 */
function detectZone1Layout(ws: any): { headerRow: number; nicknameCols: number[] } | null {
  for (let r = 0; r <= 2; r++) {
    // Try all columns 0-16, find which ones have known nicknames
    const foundCols: number[] = []
    for (let c = 0; c <= 16; c++) {
      const v = getCell(ws, r, c).toUpperCase().trim()
      if (v && resolveNickname(v)) foundCols.push(c)
    }
    if (foundCols.length >= 3) {
      return { headerRow: r, nicknameCols: foundCols }
    }
  }
  return null
}

/**
 * Parse Zone 1: Transactions
 * Layout: columns in pairs - nickname col + adjacent value col
 * Header row has team nicknames and net spend in the next column
 * Data rows below have player names and amounts
 */
function parseZone1(ws: any, sessionDef: SessionDef): { zone1: ParsedZone1 | null; warnings: string[] } {
  const warnings: string[] = []
  const layout = detectZone1Layout(ws)
  if (!layout) {
    warnings.push(`[${sessionDef.code}] Could not detect Zone 1 header row`)
    return { zone1: null, warnings }
  }

  const { headerRow, nicknameCols } = layout
  const { maxRow } = getRange(ws)
  const teams: Zone1Team[] = []

  for (const c of nicknameCols) {
    const nickname = getCell(ws, headerRow, c).toUpperCase().trim()
    const person = resolveNickname(nickname)
    if (!person) continue

    const netSpend = getCellNum(ws, headerRow, c + 1) || 0

    const transactions: Zone1Transaction[] = []
    for (let r = headerRow + 1; r <= maxRow; r++) {
      const playerName = getCell(ws, r, c).toLowerCase().trim()
      if (!playerName) continue

      const amountCell = getCell(ws, r, c + 1)
      const amount = getCellNum(ws, r, c + 1)

      // Detect special markers
      const isSpecial = amount === null && amountCell !== ''
      const specialMarker = isSpecial ? amountCell : undefined

      transactions.push({
        playerName,
        amount: amount ?? 0,
        isSpecial,
        specialMarker,
      })
    }

    teams.push({ nickname, person, netSpend, transactions })
  }

  return {
    zone1: teams.length > 0 ? { teams, headerRow } : null,
    warnings,
  }
}

/**
 * Detect the start column and format of Zone 2.
 * Zone 2 starts somewhere around column R (17) to W (22) and contains
 * contract data. The format changes significantly across eras.
 *
 * Strategy: scan columns 17-25 looking for patterns:
 * 1. "typed" format: a column has type keywords (asta/scambio/rubato) + next col has session codes (S11/F13)
 * 2. "birthYear-club-name" format: a number (70-99), then a club code (2-4 chars), then a player name
 * 3. "name-salary-duration" format: a player name (text), then two consecutive numbers
 */
function detectZone2Format(ws: any, sessionDef: SessionDef): {
  typeCol: number     // column with contract type (or -1 if not present)
  sessionCol: number  // column with session code (or -1)
  birthYearCol: number // column with birth year (or -1)
  clubCol: number     // column with club code (or -1)
  nameCol: number     // column with player name
  salOrigCol: number
  durOrigCol: number
  clauseOrigCol: number
  salUpdCol: number   // -1 if not present
  durUpdCol: number
  clauseUpdCol: number
  format: string
} | null {
  const { maxCol } = getRange(ws)
  const typeKeywords = ['asta', 'scambio', 'rubata', 'rubato', 'prestito', 'taglio', 'scambio ']
  const sessionCodePattern = /^[SF]\d{2}$/
  const clubPattern = /^[A-Z]{2,4}$/

  // PASS 1: Look for "typed" format (has type + session code columns)
  // Scan cols 17-25, rows 1-10 for type keywords followed by session codes
  for (let baseCol = 17; baseCol <= Math.min(25, maxCol); baseCol++) {
    let typeHits = 0
    let sessionHits = 0
    for (let r = 1; r <= Math.min(10, 40); r++) {
      const v = getCell(ws, r, baseCol).toLowerCase().trim()
      if (typeKeywords.includes(v)) typeHits++
      const next = getCell(ws, r, baseCol + 1).trim()
      if (sessionCodePattern.test(next)) sessionHits++
    }
    if (typeHits >= 2 && sessionHits >= 2) {
      // Found typed format. Now determine the column layout.
      // Pattern: type, sessionCode, birthYear, club, name, salOrig, durOrig, clauseOrig, [salUpd, durUpd, clauseUpd]
      const tc = baseCol
      const sc = baseCol + 1
      const byc = baseCol + 2
      const cc = baseCol + 3
      const nc = baseCol + 4
      const so = baseCol + 5
      const do_ = baseCol + 6
      const co = baseCol + 7
      const su = baseCol + 8
      const du = baseCol + 9
      const cu = baseCol + 10

      return {
        typeCol: tc, sessionCol: sc, birthYearCol: byc, clubCol: cc,
        nameCol: nc, salOrigCol: so, durOrigCol: do_, clauseOrigCol: co,
        salUpdCol: su, durUpdCol: du, clauseUpdCol: cu,
        format: `typed@${XLSX.utils.encode_col(baseCol)}`,
      }
    }
  }

  // PASS 2: Look for "birthYear-club-name-numbers" pattern
  // Some eras (S13, F14, S14) have: birthYear(number ~70-99), club(2-4 upper chars), name(text), salary, duration, clause
  for (let baseCol = 17; baseCol <= Math.min(25, maxCol); baseCol++) {
    let patternHits = 0
    for (let r = 1; r <= Math.min(10, 40); r++) {
      const num = getCellNum(ws, r, baseCol)
      const club = getCell(ws, r, baseCol + 1).trim()
      const name = getCell(ws, r, baseCol + 2).toLowerCase().trim()
      const sal = getCellNum(ws, r, baseCol + 3)
      const dur = getCellNum(ws, r, baseCol + 4)

      if (num !== null && num >= 50 && num <= 99 &&
          clubPattern.test(club) && name.length > 2 &&
          sal !== null && dur !== null) {
        patternHits++
      }
    }
    if (patternHits >= 2) {
      // birthYear, club, name, salary, duration, clause, [salUpd, durUpd, clauseUpd]
      return {
        typeCol: -1, sessionCol: -1,
        birthYearCol: baseCol, clubCol: baseCol + 1, nameCol: baseCol + 2,
        salOrigCol: baseCol + 3, durOrigCol: baseCol + 4, clauseOrigCol: baseCol + 5,
        salUpdCol: baseCol + 6, durUpdCol: baseCol + 7, clauseUpdCol: baseCol + 8,
        format: `byc-name@${XLSX.utils.encode_col(baseCol)}`,
      }
    }
  }

  // PASS 3: Look for "name-salary-duration" pattern (ERA1 - S12)
  for (let baseCol = 17; baseCol <= Math.min(22, maxCol); baseCol++) {
    let patternHits = 0
    for (let r = 1; r <= Math.min(10, 40); r++) {
      const name = getCell(ws, r, baseCol).toLowerCase().trim()
      const sal = getCellNum(ws, r, baseCol + 1)
      const dur = getCellNum(ws, r, baseCol + 2)
      const clause = getCellNum(ws, r, baseCol + 3)

      if (name.length > 2 && sal !== null && dur !== null && clause !== null) {
        patternHits++
      }
    }
    if (patternHits >= 2) {
      // name, salary, duration, clause, club, salUpd, durUpd, clauseUpd, age
      return {
        typeCol: -1, sessionCol: -1, birthYearCol: -1,
        clubCol: baseCol + 4, nameCol: baseCol,
        salOrigCol: baseCol + 1, durOrigCol: baseCol + 2, clauseOrigCol: baseCol + 3,
        salUpdCol: baseCol + 5, durUpdCol: baseCol + 6, clauseUpdCol: baseCol + 7,
        format: `name-first@${XLSX.utils.encode_col(baseCol)}`,
      }
    }
  }

  // PASS 4: Look for columns with player names alongside a known club column
  // Some eras (S15, F18, S18, F19) have a different ordering where the name comes before/after club
  for (let baseCol = 20; baseCol <= Math.min(28, maxCol); baseCol++) {
    // Check if this column has club codes and next has names
    let clubNameHits = 0
    for (let r = 1; r <= Math.min(10, 40); r++) {
      const maybeClub = getCell(ws, r, baseCol).trim()
      const maybeName = getCell(ws, r, baseCol + 1).toLowerCase().trim()
      const maybeNum = getCellNum(ws, r, baseCol + 2)
      if (clubPattern.test(maybeClub) && maybeName.length > 2 && maybeNum !== null) {
        clubNameHits++
      }
    }
    if (clubNameHits >= 2) {
      // club, name, salOrig, durOrig, clauseOrig, salUpd, durUpd, clauseUpd
      // Check if there's a name column before the club (like V=name, W=club in S15)
      const prevName = getCell(ws, 1, baseCol - 1).toLowerCase().trim()
      if (prevName.length > 2 && !clubPattern.test(getCell(ws, 1, baseCol - 1).trim())) {
        // name is at baseCol-1
        return {
          typeCol: -1, sessionCol: -1, birthYearCol: -1,
          clubCol: baseCol, nameCol: baseCol + 1,
          salOrigCol: baseCol + 2, durOrigCol: baseCol + 3, clauseOrigCol: baseCol + 4,
          salUpdCol: baseCol + 5, durUpdCol: baseCol + 6, clauseUpdCol: baseCol + 7,
          format: `club-name@${XLSX.utils.encode_col(baseCol)}`,
        }
      }
      // club at baseCol, name at baseCol+1
      return {
        typeCol: -1, sessionCol: -1, birthYearCol: -1,
        clubCol: baseCol, nameCol: baseCol + 1,
        salOrigCol: baseCol + 2, durOrigCol: baseCol + 3, clauseOrigCol: baseCol + 4,
        salUpdCol: baseCol + 5, durUpdCol: baseCol + 6, clauseUpdCol: baseCol + 7,
        format: `club-name@${XLSX.utils.encode_col(baseCol)}`,
      }
    }
  }

  return null
}

/**
 * Parse Zone 2 contracts using the generic format detection
 */
function parseZone2(ws: any, sessionDef: SessionDef): { zone2: ParsedZone2 | null; warnings: string[] } {
  const warnings: string[] = []
  const layout = detectZone2Format(ws, sessionDef)

  if (!layout) {
    warnings.push(`[${sessionDef.code}] Zone 2 not detected`)
    return { zone2: null, warnings }
  }

  const { maxRow } = getRange(ws)
  const contracts: Zone2Contract[] = []

  for (let r = 1; r <= maxRow; r++) {
    const name = getCell(ws, r, layout.nameCol).toLowerCase().trim()
    if (!name) continue

    // Skip obvious non-data rows (totals, section headers)
    const salOrig = getCellNum(ws, r, layout.salOrigCol)
    const durOrig = getCellNum(ws, r, layout.durOrigCol)
    const salUpd = layout.salUpdCol >= 0 ? getCellNum(ws, r, layout.salUpdCol) : null
    const durUpd = layout.durUpdCol >= 0 ? getCellNum(ws, r, layout.durUpdCol) : null

    // Need at least salary or updated salary to consider this a valid contract
    if (salOrig === null && salUpd === null) continue

    const typeStr = layout.typeCol >= 0 ? getCell(ws, r, layout.typeCol).toLowerCase().trim() : ''
    const sessionCode = layout.sessionCol >= 0 ? getCell(ws, r, layout.sessionCol).trim() : ''
    const birthYear = layout.birthYearCol >= 0 ? getCellNum(ws, r, layout.birthYearCol) : null
    const club = layout.clubCol >= 0 ? getCell(ws, r, layout.clubCol).trim() : ''
    const clauseOrig = getCellNum(ws, r, layout.clauseOrigCol)
    const clauseUpd = layout.clauseUpdCol >= 0 ? getCellNum(ws, r, layout.clauseUpdCol) : null

    contracts.push({
      playerName: name,
      club: club || '',
      birthYear,
      type: typeStr ? parseContractType(typeStr) : 'unknown',
      originSession: sessionCode || '',
      salaryOriginal: salOrig || 0,
      durationOriginal: durOrig || 0,
      clauseOriginal: clauseOrig || 0,
      salaryUpdated: salUpd,
      durationUpdated: durUpd,
      clauseUpdated: clauseUpd,
    })
  }

  if (contracts.length === 0) {
    warnings.push(`[${sessionDef.code}] Zone 2 detected (${layout.format}) but no contracts parsed`)
    return { zone2: null, warnings }
  }

  const startCol = Math.min(
    ...[layout.typeCol, layout.sessionCol, layout.birthYearCol, layout.clubCol, layout.nameCol]
      .filter(c => c >= 0)
  )

  return {
    zone2: {
      teams: [{ nickname: 'ALL', person: null, contracts }],
      startCol,
    },
    warnings,
  }
}

/**
 * Parse the right-side summary columns (team-level financial data)
 * These appear in various positions depending on the era
 */
function parseFinancialSummaries(ws: any, sessionDef: SessionDef): FinancialSummary[] {
  const { maxRow, maxCol } = getRange(ws)
  const summaries: FinancialSummary[] = []

  // Look for summary blocks: typically at col AD+ with team names and numbers
  // ERA1 (S12): col AD has team names, AE=RES, AF=ENT, AG=PRE, AH=VIA, AI=NUO, AJ=TOT
  // ERA3 (S13): col AG has team names, AH=residui, AI=entrate, AJ=premi, AK=tagli, AL=indennizzi, AM=contratti, AN=TOT

  // Scan for a column that has multiple known nicknames
  for (let startC = 29; startC <= Math.min(40, maxCol); startC++) {
    let nicknameCount = 0
    for (let r = 0; r <= Math.min(10, maxRow); r++) {
      const v = getCell(ws, r, startC).toUpperCase().trim()
      if (v && resolveNickname(v)) nicknameCount++
    }

    if (nicknameCount >= 3) {
      // Found the summary block
      for (let r = 0; r <= maxRow; r++) {
        const nickname = getCell(ws, r, startC).toUpperCase().trim()
        const person = resolveNickname(nickname)
        if (!person) continue

        summaries.push({
          nickname,
          person,
          residual: getCellNum(ws, r, startC + 1) || 0,
          income: getCellNum(ws, r, startC + 2) || 0,
          prizes: getCellNum(ws, r, startC + 3) || 0,
          outgoing: getCellNum(ws, r, startC + 4) || 0,
          newSpend: getCellNum(ws, r, startC + 5) || 0,
          total: getCellNum(ws, r, startC + 6) || 0,
        })
      }
      break
    }
  }

  return summaries
}

function parseContractType(typeStr: string): ContractType {
  const t = typeStr.toLowerCase().trim()
  if (t === 'asta') return 'asta'
  if (t === 'scambio' || t === 'scambio ') return 'scambio'
  if (t === 'rubata' || t === 'rubato') return 'rubata'
  if (t === 'prestito') return 'prestito'
  if (t === 'taglio') return 'taglio'
  if (t === 'indennizzi') return 'indennizzi'
  if (t.includes('rubat')) return 'rubata'
  if (t.includes('scambi')) return 'scambio'
  return 'unknown'
}

/**
 * Parse a single auction sheet
 */
export function parseAuctionSheet(wb: any, sessionDef: SessionDef): ParsedAuctionSession {
  const ws = wb.Sheets[sessionDef.sheetName]
  if (!ws) {
    return {
      sessionDef,
      zone1: null,
      zone2: null,
      financialSummaries: [],
      warnings: [`Sheet '${sessionDef.sheetName}' not found`],
    }
  }

  const { zone1, warnings: z1Warnings } = parseZone1(ws, sessionDef)
  const { zone2, warnings: z2Warnings } = parseZone2(ws, sessionDef)
  const financialSummaries = parseFinancialSummaries(ws, sessionDef)

  return {
    sessionDef,
    zone1,
    zone2,
    financialSummaries,
    warnings: [...z1Warnings, ...z2Warnings],
  }
}

// ============================================================
// PARSE FULL WORKBOOK
// ============================================================

export function parseWorkbook(wb: any): ParsedWorkbook {
  const allWarnings: string[] = []

  // Parse Iniziale
  const iniziale = parseIniziale(wb)

  // Parse all auction sessions
  const auctionSessions = SESSIONS.slice(1) // skip Iniziale
  const sessions: ParsedAuctionSession[] = []

  for (const sessionDef of auctionSessions) {
    const parsed = parseAuctionSheet(wb, sessionDef)
    sessions.push(parsed)
    allWarnings.push(...parsed.warnings)
  }

  return { iniziale, sessions, allWarnings }
}
