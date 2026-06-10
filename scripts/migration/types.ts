/**
 * TypeScript interfaces for parsed historical data
 */

import type { SessionDef } from './config.js'

// ============================================================
// INIZIALE '11 TYPES
// ============================================================

export interface InitialPlayer {
  position: string       // P, D, C, A
  name: string           // player name
  age: number | null
  club: string           // Serie A club
  price: number          // Prezzo FC (purchase price)
  quotation: number | null  // Quot. FG
  salary: number         // Ingaggio
  duration: number       // Durata (semesters)
  clause: number         // Clausola (rescission)
}

export interface InitialTeamBlock {
  nickname: string       // team name in the sheet (DIEGO, EMILIANO, etc.)
  person: string | null  // resolved person name
  players: InitialPlayer[]
  totalSpent: number
  headerRow: number
  dataStartRow: number
}

export interface ParsedIniziale {
  teams: InitialTeamBlock[]
  totalPlayers: number
}

// ============================================================
// AUCTION SHEET TYPES (Zone 1 + Zone 2)
// ============================================================

/**
 * Zone 1: Transactions for a single team in an auction session
 * Each team has a column pair: player name (even col) + price/action (odd col)
 */
export interface Zone1Transaction {
  playerName: string
  amount: number         // positive = purchase, negative = sale, 0 = free/swap
  isSpecial: boolean     // 'x', 'p', 'C' or other non-numeric marker
  specialMarker?: string
}

export interface Zone1Team {
  nickname: string
  person: string | null
  netSpend: number       // header value (total spent this session)
  transactions: Zone1Transaction[]
}

export interface ParsedZone1 {
  teams: Zone1Team[]
  headerRow: number
}

/**
 * Zone 2: Contract registry (cumulative snapshot)
 * The format changes across eras but the core data is:
 * - player name, salary, duration, clause (original + updated)
 * - acquisition type and session
 */

export type ContractType = 'asta' | 'scambio' | 'rubata' | 'rubato' | 'prestito' | 'taglio' | 'indennizzi' | 'unknown'

export interface Zone2Contract {
  playerName: string
  club: string
  birthYear: number | null     // anno nascita / età
  type: ContractType           // asta, scambio, rubata, etc.
  originSession: string        // session code (S11, F13, etc.)
  salaryOriginal: number
  durationOriginal: number
  clauseOriginal: number       // may be "clause+salary" combo in some eras
  salaryUpdated: number | null
  durationUpdated: number | null
  clauseUpdated: number | null
  note?: string                // e.g. "taglio set 13"
}

export interface Zone2Team {
  nickname: string
  person: string | null
  contracts: Zone2Contract[]
}

export interface ParsedZone2 {
  teams: Zone2Team[]
  startCol: number
}

// ============================================================
// FINANCIAL SUMMARY (from summary columns in some sheets)
// ============================================================

export interface FinancialSummary {
  nickname: string
  person: string | null
  residual: number       // RES / residui
  income: number         // ENT / entrate
  prizes: number         // PRE / premi
  outgoing: number       // VIA
  newSpend: number       // NUO / nuovi
  total: number          // TOT
}

// ============================================================
// PARSED SESSION (combines everything for one sheet)
// ============================================================

export interface ParsedAuctionSession {
  sessionDef: SessionDef
  zone1: ParsedZone1 | null
  zone2: ParsedZone2 | null
  financialSummaries: FinancialSummary[]
  warnings: string[]
}

// ============================================================
// FULL PARSED WORKBOOK
// ============================================================

export interface ParsedWorkbook {
  iniziale: ParsedIniziale
  sessions: ParsedAuctionSession[]
  allWarnings: string[]
}

// ============================================================
// DIFF TYPES (for comparing Zone 2 across sessions)
// ============================================================

export interface ContractDiff {
  added: Zone2Contract[]      // new contracts this session
  removed: Zone2Contract[]    // contracts that disappeared
  modified: {                 // contracts with changed salary/duration
    before: Zone2Contract
    after: Zone2Contract
  }[]
  unchanged: Zone2Contract[]
}

export interface TeamSessionDiff {
  nickname: string
  person: string | null
  diff: ContractDiff
}
