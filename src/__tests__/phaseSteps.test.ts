import { describe, it, expect } from 'vitest'
import {
  buildRecurrentSteps,
  currentRecurrentPosition,
  getPhasesForSessionType,
  isPhaseValidForSessionType,
  RECURRENT_PHASES,
  TOTAL_RECURRENT_PHASES,
} from '../lib/phaseSteps'

describe('phaseSteps — stepper fasi ricorrenti (P2)', () => {
  it('marca done/current/future rispetto alla fase corrente', () => {
    const steps = buildRecurrentSteps('CONTRATTI')
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s.state]))
    expect(byKey['OFFERTE_PRE_RINNOVO']).toBe('done')
    expect(byKey['PREMI']).toBe('done')
    expect(byKey['CONTRATTI']).toBe('current')
    expect(byKey['RUBATA']).toBe('future')
    expect(byKey['ASTA_SVINCOLATI']).toBe('future')
  })

  it('tutte future quando la fase non è ricorrente (es. ASTA_LIBERA / null)', () => {
    for (const phase of ['ASTA_LIBERA', null]) {
      const steps = buildRecurrentSteps(phase)
      expect(steps.every((s) => s.state === 'future')).toBe(true)
    }
  })

  it('currentRecurrentPosition usa la numerazione ufficiale (Rubata = Fase 4 di 7)', () => {
    expect(currentRecurrentPosition('RUBATA')).toEqual({ index: 4, total: 7 })
    expect(currentRecurrentPosition('OFFERTE_PRE_RINNOVO')).toEqual({ index: 1, total: TOTAL_RECURRENT_PHASES })
    expect(currentRecurrentPosition('ASTA_LIBERA')).toBeNull()
    expect(currentRecurrentPosition(null)).toBeNull()
  })

  it('espone 6 fasi ricorrenti navigabili', () => {
    expect(RECURRENT_PHASES).toHaveLength(6)
  })
})

describe('phaseSteps — struttura fase/tipo sessione (unificazione fase→etichetta)', () => {
  it('getPhasesForSessionType: PRIMO_MERCATO ha solo ASTA_LIBERA', () => {
    const phases = getPhasesForSessionType('PRIMO_MERCATO')
    expect(phases.map((p) => p.key)).toEqual(['ASTA_LIBERA'])
  })

  it('getPhasesForSessionType: MERCATO_RICORRENTE combacia con RECURRENT_PHASES', () => {
    const phases = getPhasesForSessionType('MERCATO_RICORRENTE')
    expect(phases).toBe(RECURRENT_PHASES)
  })

  it('isPhaseValidForSessionType: combinazioni coerenti sono valide', () => {
    expect(isPhaseValidForSessionType('PRIMO_MERCATO', 'ASTA_LIBERA')).toBe(true)
    expect(isPhaseValidForSessionType('MERCATO_RICORRENTE', 'CONTRATTI')).toBe(true)
    expect(isPhaseValidForSessionType('MERCATO_RICORRENTE', 'RUBATA')).toBe(true)
  })

  it('isPhaseValidForSessionType: nessuna fase impostata è sempre valida', () => {
    expect(isPhaseValidForSessionType('PRIMO_MERCATO', null)).toBe(true)
    expect(isPhaseValidForSessionType('MERCATO_RICORRENTE', undefined)).toBe(true)
    expect(isPhaseValidForSessionType('MERCATO_RICORRENTE', '')).toBe(true)
  })

  it('isPhaseValidForSessionType: rileva il caso reale del bug — type PRIMO_MERCATO con currentPhase CONTRATTI', () => {
    expect(isPhaseValidForSessionType('PRIMO_MERCATO', 'CONTRATTI')).toBe(false)
  })

  it('isPhaseValidForSessionType: ASTA_LIBERA non è valida per MERCATO_RICORRENTE', () => {
    expect(isPhaseValidForSessionType('MERCATO_RICORRENTE', 'ASTA_LIBERA')).toBe(false)
  })
})
