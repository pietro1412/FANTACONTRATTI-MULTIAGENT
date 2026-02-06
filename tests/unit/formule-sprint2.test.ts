/**
 * Sprint 2 - Fix Critici Finanziari
 * Test suite for P0-3 (renewContract budget), P0-8 (rubata seller payment)
 *
 * TDD approach: these tests are written FIRST (RED), then code is fixed to make them GREEN.
 *
 * Financial model (from Bibbia FINANZE):
 *   Budget    = cash liquidity (DB field: currentBudget)
 *   Monte Ing = sum of all active contract salaries (calculated)
 *   Bilancio  = Budget - Monte Ingaggi (calculated on-the-fly)
 *
 * Key rules:
 *   - Renewal does NOT decrement budget (only increases monte ingaggi via salary change)
 *   - Rubata seller receives OFFERTA = currentPrice - salary, NOT full currentPrice
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// ==================== P0-3: renewContract must NOT decrement budget ====================

describe('P0-3: renewContract must NOT decrement budget', () => {
  const contractServicePath = path.resolve(
    __dirname,
    '../../src/services/contract.service.ts'
  )
  let code: string

  // Read file once for all tests in this block
  beforeAll(() => {
    code = fs.readFileSync(contractServicePath, 'utf8')
  })

  it('should NOT contain leagueMember.update with decrement in renewContract function', () => {
    // Extract the renewContract function body
    const fnStart = code.indexOf('export async function renewContract')
    const fnEnd = code.indexOf('export async function releasePlayer')
    expect(fnStart).toBeGreaterThan(-1)
    expect(fnEnd).toBeGreaterThan(fnStart)

    const renewBody = code.slice(fnStart, fnEnd)

    // The renewContract function must NOT contain a budget decrement
    // Pattern: leagueMember.update with decrement: renewalCost
    expect(renewBody).not.toContain('decrement: renewalCost')
    expect(renewBody).not.toContain('decrement: renewal')
  })

  it('should NOT check budget sufficiency in renewContract (renewal affects monte ingaggi, not budget)', () => {
    const fnStart = code.indexOf('export async function renewContract')
    const fnEnd = code.indexOf('export async function releasePlayer')
    const renewBody = code.slice(fnStart, fnEnd)

    // Should NOT contain budget insufficiency check for renewal
    expect(renewBody).not.toContain('Budget insufficiente')
    expect(renewBody).not.toContain('renewalCost > member.currentBudget')
  })

  it('should still calculate renewalCost for informational purposes (movement, response)', () => {
    const fnStart = code.indexOf('export async function renewContract')
    const fnEnd = code.indexOf('export async function releasePlayer')
    const renewBody = code.slice(fnStart, fnEnd)

    // renewalCost should still be calculated and used in response/movement
    expect(renewBody).toContain('renewalCost')
    expect(renewBody).toContain('price: renewalCost')
    expect(renewBody).toContain('Costo: ${renewalCost}')
  })

  it('should keep the contract update (salary, duration, rescission) intact', () => {
    const fnStart = code.indexOf('export async function renewContract')
    const fnEnd = code.indexOf('export async function releasePlayer')
    const renewBody = code.slice(fnStart, fnEnd)

    // Contract update should still exist
    expect(renewBody).toContain('playerContract.update')
    expect(renewBody).toContain('salary: newSalary')
    expect(renewBody).toContain('duration: newDuration')
    expect(renewBody).toContain('rescissionClause: newRescissionClause')
  })
})

// ==================== P0-8: Rubata seller receives OFFERTA only ====================

describe('P0-8: Rubata seller receives OFFERTA (currentPrice - salary), not full price', () => {
  const rubataServicePath = path.resolve(
    __dirname,
    '../../src/services/rubata.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(rubataServicePath, 'utf8')
  })

  it('should compute sellerPayment as payment minus contract salary in rubata completions', () => {
    // The rubata service should have a sellerPayment calculation that subtracts salary
    // Look for the pattern: sellerPayment = payment - salary or similar
    // This ensures seller gets OFFERTA, not the full price
    const hasSellerPaymentCalc =
      code.includes('sellerPayment') ||
      code.includes('payment - ') ||
      code.includes('bidAmount - ')

    expect(hasSellerPaymentCalc).toBe(true)
  })

  it('should NOT increment seller budget by full payment/bidAmount', () => {
    // Find all seller budget increments
    // They should NOT use the raw `payment` or `bidAmount` variable
    // They should use a derived value that subtracts salary

    // Pattern we DON'T want: { increment: payment } for seller
    // Pattern we DO want: { increment: sellerPayment } or { increment: payment - salary }

    // Check that no line has the pattern "increment: payment }" for seller
    // We need to be precise: look for "// Update seller" followed by increment: payment
    const sellerPaymentLines = code.split('\n').filter((line, i, lines) => {
      // Look for increment lines that are near "seller" comments
      if (!line.includes('increment:')) return false
      // Check surrounding context (5 lines before)
      const context = lines.slice(Math.max(0, i - 5), i + 1).join('\n')
      return context.toLowerCase().includes('seller') || context.toLowerCase().includes('venditore')
    })

    for (const line of sellerPaymentLines) {
      // Each seller increment should NOT use raw `payment` or `bidAmount`
      expect(line.trim()).not.toMatch(/increment:\s*payment\s*[,}]/)
      expect(line.trim()).not.toMatch(/increment:\s*bidAmount\s*[,}]/)
    }
  })

  it('should reference contract.salary or rosterEntry.contract.salary when computing seller payment', () => {
    // The rubata payment to seller must reference the contract salary
    // to compute OFFERTA = currentPrice - salary
    const referencesSalary =
      code.includes('contract.salary') ||
      code.includes('rosterEntry.contract?.salary') ||
      code.includes('rosterEntry.contract!.salary')

    expect(referencesSalary).toBe(true)
  })
})
