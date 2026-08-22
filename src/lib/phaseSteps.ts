// Helper condiviso per lo stepper delle fasi del mercato ricorrente.
// Usato sia da PhaseIndicator (hub) sia da PhaseBar (barra-fase persistente)
// per non duplicare l'ordine canonico delle fasi (Assioma 4).
//
// Ordine e numerazione ufficiale dei mercati ricorrenti: MERCATO-RICORRENTE.md
// (FASE 1 Scambi → FASE 7 Fine Mercato).
//
// Fonte canonica anche per la STRUTTURA fase→sessione (quali fasi esistono e a
// quale MarketType appartengono — enum Prisma in prisma/schemas/_base.prisma).
// MarketPhaseManager e AdminBanner derivano da qui l'elenco/ordine delle fasi
// valide per tipo di sessione invece di reimplementarlo (bug reale: una
// sessione con `type`/`currentPhase` incoerenti tra loro mostrava 3 stati
// diversi su AdminPanel/Hub/PhaseBar).

export interface RecurrentPhaseDef {
  /** Valore enum MarketPhase. */
  key: string
  /** Etichetta breve per lo stepper. */
  label: string
}

/** Tipo sessione di mercato (enum Prisma MarketType). */
export type MarketSessionType = 'PRIMO_MERCATO' | 'MERCATO_RICORRENTE'

/**
 * Unione letterale di tutte le chiavi MarketPhase (Prisma `_base.prisma`).
 * Serve a forzare a compile-time la completezza delle mappe fase→contenuto
 * nei componenti che le consumano (es. `Record<MarketPhaseKey, ...>`).
 */
export type MarketPhaseKey =
  | 'ASTA_LIBERA'
  | 'OFFERTE_PRE_RINNOVO'
  | 'PREMI'
  | 'CONTRATTI'
  | 'RUBATA'
  | 'ASTA_SVINCOLATI'
  | 'OFFERTE_POST_ASTA_SVINCOLATI'

/** Unica fase del PRIMO_MERCATO (`_base.prisma`: "ASTA_LIBERA — Solo per PRIMO_MERCATO"). */
export const FIRST_MARKET_PHASE: RecurrentPhaseDef = { key: 'ASTA_LIBERA', label: 'Asta Primo Mercato' }

// Le 6 fasi ricorrenti che hanno una sezione navigabile (la 7ª, Fine Mercato,
// non ha sezione → la numerazione "di 7" la include implicitamente).
export const RECURRENT_PHASES: RecurrentPhaseDef[] = [
  { key: 'OFFERTE_PRE_RINNOVO', label: 'Scambi' },
  { key: 'PREMI', label: 'Premi' },
  { key: 'CONTRATTI', label: 'Contratti' },
  { key: 'RUBATA', label: 'Rubata' },
  { key: 'ASTA_SVINCOLATI', label: 'Svincolati' },
  { key: 'OFFERTE_POST_ASTA_SVINCOLATI', label: 'Post-asta' },
]

/** Numero totale di fasi ufficiali del mercato ricorrente (incl. Fine Mercato). */
export const TOTAL_RECURRENT_PHASES = 7

/**
 * Elenco ordinato delle fasi valide per il tipo di sessione indicato.
 * PRIMO_MERCATO ha una sola fase (ASTA_LIBERA); MERCATO_RICORRENTE ha le 6
 * fasi di RECURRENT_PHASES, nello stesso ordine canonico dello stepper.
 */
export function getPhasesForSessionType(
  sessionType: string | null | undefined,
): RecurrentPhaseDef[] {
  return sessionType === 'PRIMO_MERCATO' ? [FIRST_MARKET_PHASE] : RECURRENT_PHASES
}

/**
 * Vero se `phase` è compatibile con `sessionType` secondo l'enum MarketPhase
 * (ASTA_LIBERA è valida solo per PRIMO_MERCATO). Una `phase` assente (null/
 * undefined/stringa vuota) è considerata valida: la sessione semplicemente
 * non ha ancora una fase impostata.
 *
 * Usata per rilevare sessioni con dati incoerenti (es. artefatto di seed di
 * test: `type: 'PRIMO_MERCATO'` con `currentPhase: 'CONTRATTI'`) e mostrare
 * uno stato d'errore esplicito invece di un comportamento silenzioso/confuso.
 */
export function isPhaseValidForSessionType(
  sessionType: string | null | undefined,
  phase: string | null | undefined,
): boolean {
  if (!phase) return true
  return getPhasesForSessionType(sessionType).some((p) => p.key === phase)
}

export type StepState = 'done' | 'current' | 'future'

export interface RecurrentStep extends RecurrentPhaseDef {
  state: StepState
}

/**
 * Stato dei 6 step ricorrenti rispetto alla fase corrente.
 * Se `currentPhase` non è una fase ricorrente (es. ASTA_LIBERA del primo mercato
 * o nessuna sessione), tutti gli step risultano 'future'.
 */
export function buildRecurrentSteps(currentPhase: string | null | undefined): RecurrentStep[] {
  const currentIdx = RECURRENT_PHASES.findIndex((p) => p.key === currentPhase)
  return RECURRENT_PHASES.map((p, i) => {
    let state: StepState
    if (currentIdx === -1) state = 'future'
    else if (i < currentIdx) state = 'done'
    else if (i === currentIdx) state = 'current'
    else state = 'future'
    return { ...p, state }
  })
}

/**
 * Posizione "Fase N di 7" della fase corrente (N = numero ufficiale), o null se
 * la fase corrente non è una fase ricorrente.
 */
export function currentRecurrentPosition(
  currentPhase: string | null | undefined,
): { index: number; total: number } | null {
  const idx = RECURRENT_PHASES.findIndex((p) => p.key === currentPhase)
  if (idx === -1) return null
  return { index: idx + 1, total: TOTAL_RECURRENT_PHASES }
}
