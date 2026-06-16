// Helper condiviso per lo stepper delle fasi del mercato ricorrente.
// Usato sia da PhaseIndicator (hub) sia da PhaseBar (barra-fase persistente)
// per non duplicare l'ordine canonico delle fasi (Assioma 4).
//
// Ordine e numerazione ufficiale dei mercati ricorrenti: MERCATO-RICORRENTE.md
// (FASE 1 Scambi → FASE 7 Fine Mercato).

export interface RecurrentPhaseDef {
  /** Valore enum MarketPhase. */
  key: string
  /** Etichetta breve per lo stepper. */
  label: string
}

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
