/**
 * Sprint 3 - Fix Critici Rubata + Path Standalone
 * Test suite for P0-7 (PENDING_ACK), P0-9 (consolidation guard), P0-10 (preConsolidation schema)
 *
 * TDD approach: these tests are written FIRST (RED), then code is fixed to make them GREEN.
 *
 * P0-7: PENDING_ACK auto-advance must check acknowledgedMembers, NOT auction.status
 * P0-9: renewContract and releasePlayer must block if already consolidated
 * P0-10: preConsolidation fields must exist in Prisma schema
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// ==================== P0-7: PENDING_ACK must check acknowledgedMembers ====================

describe('P0-7: PENDING_ACK auto-advance checks acknowledgedMembers, not auction.status', () => {
  const rubataServicePath = path.resolve(
    __dirname,
    '../../src/services/rubata.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(rubataServicePath, 'utf8')
  })

  it('should NOT have referencedAuction.status === COMPLETED as PENDING_ACK advancement condition', () => {
    // The GAP analysis identified that the original code used:
    //   if (referencedAuction.status === 'COMPLETED') { ... }
    // This is ALWAYS true after auction close, causing PENDING_ACK to be skipped.
    // The fix is to check acknowledgedMembers instead.
    expect(code).not.toContain("referencedAuction.status === 'COMPLETED'")
    expect(code).not.toContain('referencedAuction.status === "COMPLETED"')
  })

  it('should check allAcknowledged (not auction status) before advancing from PENDING_ACK in polling', () => {
    // In the getRubataBoard polling function, the PENDING_ACK auto-advance section
    // must use acknowledgedMembers to determine if all members have confirmed.
    // Look for the pattern: PENDING_ACK + allAcknowledged check
    const pendingAckSection = code.indexOf('Auto-advance if in PENDING_ACK')
    expect(pendingAckSection).toBeGreaterThan(-1)

    // The section after "Auto-advance" should reference acknowledgedMembers and allAcknowledged
    // Use a larger window (1500 chars) to capture the full logic block
    const sectionAfter = code.slice(pendingAckSection, pendingAckSection + 1500)
    expect(sectionAfter).toContain('acknowledgedMembers')
    expect(sectionAfter).toContain('allAcknowledged')
  })

  it('should have a guard comment explaining that auction.status COMPLETED is not sufficient', () => {
    // A defensive comment should explain WHY we don't use auction.status
    expect(code).toContain('must NOT skip PENDING_ACK just because auction.status')
  })

  it('should transition to READY_CHECK (not OFFERING) when all acknowledge in polling', () => {
    // When all members acknowledge during polling, it should go to READY_CHECK
    // (not directly to OFFERING) to give everyone a chance to be ready
    const pendingAckSection = code.indexOf('Auto-advance if in PENDING_ACK')
    // Use a larger window to capture the full auto-advance block including the state transition
    const sectionAfter = code.slice(pendingAckSection, pendingAckSection + 1500)

    // After allAcknowledged check, the state should transition to READY_CHECK
    expect(sectionAfter).toContain("rubataState: 'READY_CHECK'")
  })

  it('acknowledgeRubataTransaction should check all members before advancing', () => {
    // The acknowledgeRubataTransaction function should verify ALL members acknowledged
    // before advancing the state, not just the current member
    const fnStart = code.indexOf('export async function acknowledgeRubataTransaction')
    expect(fnStart).toBeGreaterThan(-1)

    // This is a large function (~150 lines). Use a 5000 char window to capture the full body
    // up to and including the allAcknowledged check and state transition.
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain('allAcknowledged')
    expect(fnBody).toContain('every')
  })
})

// ==================== P0-9: Consolidation guard on renewContract and releasePlayer ====================

describe('P0-9: renewContract blocks if member already consolidated', () => {
  const contractServicePath = path.resolve(
    __dirname,
    '../../src/services/contract.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(contractServicePath, 'utf8')
  })

  it('should check isInContrattiPhase before allowing renewal', () => {
    const fnStart = code.indexOf('export async function renewContract')
    const fnEnd = code.indexOf('// ==================== RELEASE PLAYER')
    expect(fnStart).toBeGreaterThan(-1)
    expect(fnEnd).toBeGreaterThan(fnStart)

    const renewBody = code.slice(fnStart, fnEnd)
    expect(renewBody).toContain('isInContrattiPhase')
  })

  it('should check consolidation status and reject if already consolidated', () => {
    const fnStart = code.indexOf('export async function renewContract')
    const fnEnd = code.indexOf('// ==================== RELEASE PLAYER')
    const renewBody = code.slice(fnStart, fnEnd)

    // Must check for existing consolidation record
    expect(renewBody).toContain('contractConsolidation')
    // Must have a rejection message about consolidation
    expect(renewBody).toMatch(/consolidat/i)
    // Must return early with error if consolidated
    expect(renewBody).toMatch(/già consolidato|already consolidated|dopo il consolidamento/i)
  })
})

describe('P0-9: releasePlayer blocks if member already consolidated', () => {
  const contractServicePath = path.resolve(
    __dirname,
    '../../src/services/contract.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(contractServicePath, 'utf8')
  })

  it('should check isInContrattiPhase before allowing release', () => {
    const fnStart = code.indexOf('export async function releasePlayer')
    const fnEnd = code.indexOf('// ==================== CALCULATE PREVIEW')
    expect(fnStart).toBeGreaterThan(-1)
    expect(fnEnd).toBeGreaterThan(fnStart)

    const releaseBody = code.slice(fnStart, fnEnd)
    expect(releaseBody).toContain('isInContrattiPhase')
  })

  it('should check consolidation status and reject if already consolidated', () => {
    const fnStart = code.indexOf('export async function releasePlayer')
    const fnEnd = code.indexOf('// ==================== CALCULATE PREVIEW')
    const releaseBody = code.slice(fnStart, fnEnd)

    // Must check for existing consolidation record
    expect(releaseBody).toContain('contractConsolidation')
    // Must have a rejection message about consolidation
    expect(releaseBody).toMatch(/consolidat/i)
    // Must return early with error if consolidated
    expect(releaseBody).toMatch(/già consolidato|already consolidated|dopo il consolidamento/i)
  })
})

// ==================== P0-10: preConsolidation schema fields ====================

describe('P0-10: preConsolidation fields exist in Prisma schema', () => {
  const generatedSchemaPath = path.resolve(
    __dirname,
    '../../prisma/schema.generated.prisma'
  )
  let schema: string

  beforeAll(() => {
    schema = fs.readFileSync(generatedSchemaPath, 'utf8')
  })

  it('should have preConsolidationBudget on LeagueMember model', () => {
    expect(schema).toContain('preConsolidationBudget')
    // Should be nullable Int
    const line = schema.split('\n').find(l => l.includes('preConsolidationBudget'))
    expect(line).toContain('Int?')
  })

  it('should have preConsolidationSalary on PlayerRoster model', () => {
    expect(schema).toContain('preConsolidationSalary')
    const line = schema.split('\n').find(l => l.includes('preConsolidationSalary'))
    expect(line).toContain('Int?')
  })

  it('should have preConsolidationDuration on PlayerRoster model', () => {
    expect(schema).toContain('preConsolidationDuration')
    const line = schema.split('\n').find(l => l.includes('preConsolidationDuration'))
    expect(line).toContain('Int?')
  })
})

// ==================== P0-10: preConsolidation fields in split schemas ====================

describe('P0-10: preConsolidation fields exist in split Prisma schemas', () => {
  const leagueSchemaPath = path.resolve(
    __dirname,
    '../../prisma/schemas/league.prisma'
  )
  const rosterSchemaPath = path.resolve(
    __dirname,
    '../../prisma/schemas/roster.prisma'
  )

  it('should have preConsolidationBudget in league.prisma', () => {
    const schema = fs.readFileSync(leagueSchemaPath, 'utf8')
    expect(schema).toContain('preConsolidationBudget')
  })

  it('should have preConsolidationSalary in roster.prisma', () => {
    const schema = fs.readFileSync(rosterSchemaPath, 'utf8')
    expect(schema).toContain('preConsolidationSalary')
  })

  it('should have preConsolidationDuration in roster.prisma', () => {
    const schema = fs.readFileSync(rosterSchemaPath, 'utf8')
    expect(schema).toContain('preConsolidationDuration')
  })
})
