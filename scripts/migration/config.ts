/**
 * Configuration for historical data migration
 * Mappings, constants, and session definitions
 */

// ============================================================
// NICKNAME -> PERSON MAPPING
// ============================================================
// The 8 real participants (from init-production.ts):
// Pietro, Michele, Mirko, Emmanuele, Diego, Marco, Marcolino, Emiliano
//
// The 5 founders (from Iniziale '11):
// DIEGO, EMILIANO, MICHELE, PIETRO, EMANUELE (=Emmanuele)
//
// The 3 who joined in 2012: Marco, Marcolino, Mirko
//
// EDIT THIS MAP if the associations are wrong!
// ============================================================

export const NICKNAME_TO_PERSON: Record<string, string> = {
  // === Founders (Iniziale '11) ===
  'DIEGO': 'Diego',
  'EMILIANO': 'Emiliano',
  'MICHELE': 'Michele',
  'PIETRO': 'Pietro',
  'EMANUELE': 'Emmanuele',

  // === Auction nicknames ===
  'DIIIGHE': 'Diego',
  'RUGGERI': 'Emmanuele',
  'ARCIONIA': 'Emiliano',
  'BIRRETTA': 'Michele',

  // Pietro's nicknames
  'PRUZZO': 'Pietro',
  'AC TUA': 'Pietro',
  'TUA': 'Pietro',
  'CAVATOVIC': 'Pietro',
  'PATO': 'Pietro',

  // Marcolino's nicknames
  'COSTA': 'Marcolino',
  'TOMA': 'Marcolino',
  'DIABLO': 'Marcolino',
  'DIABLOS': 'Marcolino',

  // Marco's nicknames
  'MARCO': 'Marco',
  'PROFETI': 'Marco',

  // Mirko's nicknames
  'MIRKO': 'Mirko',
  'PIPITAS': 'Mirko',
  'PD': 'Mirko',
  'MONTSEGUR': 'Mirko',
  'MADA': 'Mirko',
}

// Person -> canonical username for DB
export const PERSON_TO_USERNAME: Record<string, string> = {
  'Pietro': 'Pietro',
  'Michele': 'Michele',
  'Mirko': 'Mirko',
  'Emmanuele': 'Emmanuele',
  'Diego': 'Diego',
  'Marco': 'Marco',
  'Marcolino': 'Marcolino',
  'Emiliano': 'Emiliano',
}

/**
 * Resolve a nickname (from Excel) to the canonical person name
 */
export function resolveNickname(nickname: string): string | null {
  // Try exact match first
  const exact = NICKNAME_TO_PERSON[nickname.toUpperCase().trim()]
  if (exact) return exact

  // Try case-insensitive match
  const upper = nickname.toUpperCase().trim()
  for (const [key, value] of Object.entries(NICKNAME_TO_PERSON)) {
    if (key.toUpperCase() === upper) return value
  }

  return null
}

// ============================================================
// CONTRACT CONSTANTS (from contract-calculator.service.ts)
// ============================================================

export const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,
  3: 9,
  2: 7,
  1: 3,
}

export function calculateRescissionClause(salary: number, duration: number): number {
  const multiplier = DURATION_MULTIPLIERS[duration] ?? 3
  return salary * multiplier
}

export function calculateReleaseCost(salary: number, duration: number): number {
  return Math.ceil((salary * duration) / 2)
}

export function defaultSalary(price: number): number {
  return Math.max(1, Math.round(price / 10))
}

// ============================================================
// SESSION DEFINITIONS
// ============================================================

export type SessionType = 'PRIMO_MERCATO' | 'MERCATO_RICORRENTE'
export type Semester = 1 | 2  // 1 = estivo (settembre), 2 = invernale (febbraio)

export interface SessionDef {
  sheetName: string
  code: string
  season: number
  semester: Semester
  type: SessionType
  year: number  // actual year
}

/**
 * All 29 sessions in chronological order.
 * The sheet names must match exactly what's in the Excel.
 */
export const SESSIONS: SessionDef[] = [
  { sheetName: "Iniziale '11", code: 'S11', season: 1, semester: 1, type: 'PRIMO_MERCATO', year: 2011 },
  { sheetName: "asta sett '12", code: 'S12', season: 2, semester: 1, type: 'MERCATO_RICORRENTE', year: 2012 },
  { sheetName: "asta febb '13", code: 'F13', season: 2, semester: 2, type: 'MERCATO_RICORRENTE', year: 2013 },
  { sheetName: "asta sett '13", code: 'S13', season: 3, semester: 1, type: 'MERCATO_RICORRENTE', year: 2013 },
  { sheetName: "asta febb 14", code: 'F14', season: 3, semester: 2, type: 'MERCATO_RICORRENTE', year: 2014 },
  { sheetName: "asta sett 14", code: 'S14', season: 4, semester: 1, type: 'MERCATO_RICORRENTE', year: 2014 },
  { sheetName: "asta febb 15", code: 'F15', season: 4, semester: 2, type: 'MERCATO_RICORRENTE', year: 2015 },
  { sheetName: "asta sett 15", code: 'S15', season: 5, semester: 1, type: 'MERCATO_RICORRENTE', year: 2015 },
  { sheetName: "asta febb 16", code: 'F16', season: 5, semester: 2, type: 'MERCATO_RICORRENTE', year: 2016 },
  { sheetName: "asta sett 16", code: 'S16', season: 6, semester: 1, type: 'MERCATO_RICORRENTE', year: 2016 },
  { sheetName: "asta febb 17", code: 'F17', season: 6, semester: 2, type: 'MERCATO_RICORRENTE', year: 2017 },
  { sheetName: "asta sett 17", code: 'S17', season: 7, semester: 1, type: 'MERCATO_RICORRENTE', year: 2017 },
  { sheetName: "asta febb 18", code: 'F18', season: 7, semester: 2, type: 'MERCATO_RICORRENTE', year: 2018 },
  { sheetName: "asta sett 18", code: 'S18', season: 8, semester: 1, type: 'MERCATO_RICORRENTE', year: 2018 },
  { sheetName: "asta febb 19", code: 'F19', season: 8, semester: 2, type: 'MERCATO_RICORRENTE', year: 2019 },
  { sheetName: "asta sett 19", code: 'S19', season: 9, semester: 1, type: 'MERCATO_RICORRENTE', year: 2019 },
  { sheetName: "asta febb 20", code: 'F20', season: 9, semester: 2, type: 'MERCATO_RICORRENTE', year: 2020 },
  { sheetName: "asta sett 20", code: 'S20', season: 10, semester: 1, type: 'MERCATO_RICORRENTE', year: 2020 },
  { sheetName: "asta feb 21", code: 'F21', season: 10, semester: 2, type: 'MERCATO_RICORRENTE', year: 2021 },
  { sheetName: "asta sett 21", code: 'S21', season: 11, semester: 1, type: 'MERCATO_RICORRENTE', year: 2021 },
  { sheetName: "asta febb 22", code: 'F22', season: 11, semester: 2, type: 'MERCATO_RICORRENTE', year: 2022 },
  { sheetName: "asta sett 22", code: 'S22', season: 12, semester: 1, type: 'MERCATO_RICORRENTE', year: 2022 },
  { sheetName: "asta febb 23", code: 'F23', season: 12, semester: 2, type: 'MERCATO_RICORRENTE', year: 2023 },
  { sheetName: "asta sett 23", code: 'S23', season: 13, semester: 1, type: 'MERCATO_RICORRENTE', year: 2023 },
  { sheetName: "asta febb 24", code: 'F24', season: 13, semester: 2, type: 'MERCATO_RICORRENTE', year: 2024 },
  { sheetName: "asta sett 24", code: 'S24', season: 14, semester: 1, type: 'MERCATO_RICORRENTE', year: 2024 },
  { sheetName: "asta febb 25", code: 'F25', season: 14, semester: 2, type: 'MERCATO_RICORRENTE', year: 2025 },
  { sheetName: "asta sett 25", code: 'S25', season: 15, semester: 1, type: 'MERCATO_RICORRENTE', year: 2025 },
  { sheetName: "asta febb 26", code: 'F26', season: 15, semester: 2, type: 'MERCATO_RICORRENTE', year: 2026 },
]

// ============================================================
// LEAGUE DEFAULTS
// ============================================================

export const INITIAL_BUDGET = 600
export const REINCREMENT_PER_SESSION = 100  // standard reincrement (may vary)

// ============================================================
// POSITION MAPPING
// ============================================================

export const POSITION_MAP: Record<string, string> = {
  'Por': 'P',
  'POR': 'P',
  'por': 'P',
  'P': 'P',
  'p': 'P',
  'Dif': 'D',
  'DIF': 'D',
  'dif': 'D',
  'D': 'D',
  'd': 'D',
  'Cen': 'C',
  'CEN': 'C',
  'cen': 'C',
  'C': 'C',
  'c': 'C',
  'Att': 'A',
  'ATT': 'A',
  'att': 'A',
  'A': 'A',
  'a': 'A',
}

export function normalizePosition(pos: string): string {
  return POSITION_MAP[pos.trim()] || pos.charAt(0).toUpperCase()
}
