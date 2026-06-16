import { describe, it, expect } from 'vitest'
import { buildRecurrentSteps, currentRecurrentPosition, RECURRENT_PHASES, TOTAL_RECURRENT_PHASES } from '../lib/phaseSteps'

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
