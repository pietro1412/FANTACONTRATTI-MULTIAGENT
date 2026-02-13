/**
 * Sprint 1 - Fix Formule Critiche
 * Test suite for issues #243, #244, #245, #246, #247, #248
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { calculateDefaultSalary, calculateRescissionClause } from '../../src/services/contract.service'

// ==================== P2-1: calculateDefaultSalary (#248) ====================

describe('calculateDefaultSalary', () => {
  it.each([
    [10, 1], [15, 2], [14, 1], [25, 3], [1, 1], [0, 1], [105, 11],
  ])('price %i => salary %i (integer, min 1)', (price, expected) => {
    expect(calculateDefaultSalary(price)).toBe(expected)
  })

  it('should never return fractional values', () => {
    for (let p = 1; p <= 200; p++) {
      const s = calculateDefaultSalary(p)
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(1)
    }
  })
})

// ==================== P0-4: RESCISSION_MULTIPLIERS (#245) ====================

describe('RESCISSION_MULTIPLIERS', () => {
  it('should have multipliers {4:11, 3:9, 2:7, 1:3}', () => {
    expect(calculateRescissionClause(10, 4)).toBe(110)
    expect(calculateRescissionClause(10, 3)).toBe(90)
    expect(calculateRescissionClause(10, 2)).toBe(70)
    expect(calculateRescissionClause(10, 1)).toBe(30) // NOT 40
  })
})

// ==================== P0-5: routes rescission clause (#246) ====================

describe('routes rescission clause', () => {
  it('should NOT have local calculateRescissionClause in contracts routes', () => {
    const routeCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/api/routes/contracts.ts'),
      'utf8'
    )
    expect(routeCode).not.toContain('const multipliers')
    expect(routeCode).toContain("from '../../services/contract.service")
  })
})

// ==================== P0-1: contract duration (#243) ====================

describe('P0-1: contract duration', () => {
  it('should use duration 3 (not 2) for first market contracts', () => {
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../src/services/auction.service.ts'),
      'utf8'
    )
    const matches = code.match(/const duration = 2/g)
    expect(matches).toBeNull()
  })
})

// ==================== P0-2: salary rounding (#244) ====================

describe('P0-2: salary rounding', () => {
  it('should not use 0.5 rounding pattern in auction.service.ts', () => {
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../src/services/auction.service.ts'),
      'utf8'
    )
    expect(code).not.toContain('Math.round(rawSalary * 2) / 2')
  })
})

// ==================== P0-6: auto-fill rescission (#247) ====================

describe('P0-6: auto-fill rescission', () => {
  it('should not use inline rescission formula in auction.service.ts', () => {
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../src/services/auction.service.ts'),
      'utf8'
    )
    expect(code).not.toContain('salary * duration * 2')
  })
})

// ==================== P2-1: svincolati unified formula (#248) ====================

describe('P2-1: svincolati unified formula', () => {
  it('should use calculateDefaultSalary in svincolati.service.ts', () => {
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../src/services/svincolati.service.ts'),
      'utf8'
    )
    expect(code).toContain('calculateDefaultSalary')
    expect(code).not.toContain('Math.ceil(auction.currentPrice * 0.1)')
  })

  it('should not have hardcoded salary * 9 in svincolati.service.ts', () => {
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../src/services/svincolati.service.ts'),
      'utf8'
    )
    expect(code).not.toContain('salary * 9')
  })
})
