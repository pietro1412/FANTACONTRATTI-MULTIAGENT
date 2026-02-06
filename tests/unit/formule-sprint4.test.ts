/**
 * Sprint 4 - Validazioni P1 (P1-1 to P1-7)
 * Test suite for budget validation (bilancio), svincolati turn rotation,
 * rubata state machine, post-acquisition modification, and Contracts.tsx residuo.
 *
 * TDD approach: these tests are written FIRST (RED), then code is fixed to make them GREEN.
 *
 * P1-1/P1-2: Budget checks must use bilancio (budget - monteIngaggi), not raw currentBudget
 * P1-3: advanceSvincolatiToNextTurn and passSvincolatiTurn must skip finishedMembers
 * P1-4: Rubata auto-advance from OFFERING (no offers) must go to READY_CHECK, not OFFERING
 * P1-5: modifyContractPostAcquisition must NOT allow spalma (duration increase without salary increase)
 * P1-6: nominateFreeAgent budget threshold must check bilancio >= 2
 * P1-7: Contracts.tsx residuo formula must include totalIndemnities
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// ==================== P1-1/P1-2: Budget checks use bilancio ====================

describe('P1-1/P1-2: Auction bid budget checks use bilancio (budget - monteIngaggi)', () => {
  const auctionServicePath = path.resolve(
    __dirname,
    '../../src/services/auction.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(auctionServicePath, 'utf8')
  })

  it('should NOT have raw "amount > member.currentBudget" check in auction bid', () => {
    // The raw currentBudget check should be replaced with bilancio-based check
    expect(code).not.toContain('amount > member.currentBudget')
  })

  it('should use bilancio-based budget validation in auction', () => {
    expect(code).toContain('bilancio')
    // Should aggregate contract salaries (monteIngaggi)
    expect(code).toContain('playerContract.aggregate')
  })
})

describe('P1-1/P1-2: Svincolati bid budget checks use bilancio', () => {
  const svincolatiServicePath = path.resolve(
    __dirname,
    '../../src/services/svincolati.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(svincolatiServicePath, 'utf8')
  })

  it('bidOnFreeAgent should calculate bilancio before the budget check', () => {
    // Find the bidOnFreeAgent function
    const fnStart = code.indexOf('export async function bidOnFreeAgent')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 2000)

    // Should NOT have the raw currentBudget check
    expect(fnBody).not.toMatch(/amount\s*>\s*bidder\.currentBudget/)

    // Should have bilancio-based check
    expect(fnBody).toContain('bilancio')
  })
})

describe('P1-1/P1-2: Rubata budget checks use bilancio', () => {
  const rubataServicePath = path.resolve(
    __dirname,
    '../../src/services/rubata.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(rubataServicePath, 'utf8')
  })

  it('makeRubataOffer should check bilancio, not raw currentBudget', () => {
    const fnStart = code.indexOf('export async function makeRubataOffer')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 3000)

    // Should NOT have raw currentBudget check for rubata price
    expect(fnBody).not.toMatch(/rubataPrice\s*>\s*member\.currentBudget/)

    // Should have bilancio
    expect(fnBody).toContain('bilancio')
  })

  it('bidOnRubataAuction should check bilancio, not raw currentBudget', () => {
    const fnStart = code.indexOf('export async function bidOnRubataAuction')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 2000)

    // Should NOT have raw currentBudget check
    expect(fnBody).not.toMatch(/amount\s*>\s*member\.currentBudget/)

    // Should have bilancio
    expect(fnBody).toContain('bilancio')
  })
})

// ==================== P1-3: advanceSvincolatiToNextTurn skips finishedMembers ====================

describe('P1-3: advanceSvincolatiToNextTurn and passSvincolatiTurn skip finishedMembers', () => {
  const svincolatiServicePath = path.resolve(
    __dirname,
    '../../src/services/svincolati.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(svincolatiServicePath, 'utf8')
  })

  it('advanceSvincolatiToNextTurn should load finishedMembers', () => {
    const fnStart = code.indexOf('async function advanceSvincolatiToNextTurn')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 6000)
    expect(fnBody).toContain('svincolatiFinishedMembers')
  })

  it('advanceSvincolatiToNextTurn while loop should skip finishedMembers', () => {
    const fnStart = code.indexOf('async function advanceSvincolatiToNextTurn')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 6000)

    // The while loop that skips passed members should ALSO skip finished members
    // Look for finishedMembers being used in the skip condition
    expect(fnBody).toMatch(/finishedMembers\.includes/)
  })

  it('advanceSvincolatiToNextTurn activeMembers should exclude finishedMembers', () => {
    const fnStart = code.indexOf('async function advanceSvincolatiToNextTurn')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 6000)

    // The activeMembers calculation should exclude finishedMembers too
    // Pattern: filter out both passed AND finished
    expect(fnBody).toMatch(/!.*finishedMembers/)
  })

  it('passSvincolatiTurn should load finishedMembers', () => {
    const fnStart = code.indexOf('export async function passSvincolatiTurn')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 2000)
    expect(fnBody).toContain('svincolatiFinishedMembers')
  })

  it('passSvincolatiTurn while loop should skip finishedMembers', () => {
    const fnStart = code.indexOf('export async function passSvincolatiTurn')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 2000)

    // The while loop should skip finished members
    expect(fnBody).toMatch(/finishedMembers\.includes/)
  })

  it('passSvincolatiTurn all-passed check should account for finishedMembers', () => {
    const fnStart = code.indexOf('export async function passSvincolatiTurn')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 2000)

    // The completion check should consider finished members
    // Either: newPassedMembers.length + finishedMembers.length >= turnOrder.length
    // Or: activeMembers = turnOrder.filter(id => !newPassedMembers.includes(id) && !finishedMembers.includes(id))
    expect(fnBody).toMatch(/finishedMembers/)
  })
})

// ==================== P1-4: Rubata OFFERING timer -> READY_CHECK ====================

describe('P1-4: Rubata auto-advance from OFFERING goes to READY_CHECK, not OFFERING', () => {
  const rubataServicePath = path.resolve(
    __dirname,
    '../../src/services/rubata.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(rubataServicePath, 'utf8')
  })

  it('auto-advance on OFFERING timer expiry should set READY_CHECK, not OFFERING', () => {
    // The key comment identifying this section in the auto-advance lazy polling block
    const guardComment = code.indexOf('go to READY_CHECK (not directly to OFFERING)')
    expect(guardComment).toBeGreaterThan(-1)

    // From this guard comment, the rubataState assignment is within the next few lines
    const afterGuard = code.slice(guardComment, guardComment + 500)

    // Must set READY_CHECK, not OFFERING
    expect(afterGuard).toContain("rubataState: 'READY_CHECK'")
    // Should also reset ready members and timer
    expect(afterGuard).toContain('rubataReadyMembers')
    expect(afterGuard).toContain('rubataTimerStartedAt: null')
  })
})

// ==================== P1-5: modifyContractPostAcquisition blocks spalma ====================

describe('P1-5: modifyContractPostAcquisition does NOT allow spalma', () => {
  const contractServicePath = path.resolve(
    __dirname,
    '../../src/services/contract.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(contractServicePath, 'utf8')
  })

  it('should reject duration increase without salary increase (spalma)', () => {
    const fnStart = code.indexOf('export async function modifyContractPostAcquisition')
    expect(fnStart).toBeGreaterThan(-1)

    // Get the function body (first 1500 chars should cover validation)
    const fnBody = code.slice(fnStart, fnStart + 1500)

    // Must check: if newDuration > contract.duration and newSalary <= contract.salary, reject
    // This is the anti-spalma check
    expect(fnBody).toMatch(/newDuration\s*>\s*contract\.duration\s*&&\s*newSalary\s*<=\s*contract\.salary/)
  })

  it('should NOT use isValidRenewal (which allows spalma)', () => {
    const fnStart = code.indexOf('export async function modifyContractPostAcquisition')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 2500)

    // Must NOT delegate to isValidRenewal which has spalma logic
    expect(fnBody).not.toContain('isValidRenewal')
  })

  it('should reject salary decrease', () => {
    const fnStart = code.indexOf('export async function modifyContractPostAcquisition')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 1500)

    // Must check: newSalary < contract.salary -> reject
    expect(fnBody).toMatch(/newSalary\s*<\s*contract\.salary/)
  })
})

// ==================== P1-6: nominateFreeAgent checks bilancio >= 2 ====================

describe('P1-6: nominateFreeAgent budget check uses bilancio >= 2', () => {
  const svincolatiServicePath = path.resolve(
    __dirname,
    '../../src/services/svincolati.service.ts'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(svincolatiServicePath, 'utf8')
  })

  it('should NOT use the old "currentBudget < 1" check in nominateFreeAgent', () => {
    const fnStart = code.indexOf('export async function nominateFreeAgent')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 3000)

    // Old check: member.currentBudget < 1
    expect(fnBody).not.toMatch(/member\.currentBudget\s*<\s*1/)
  })

  it('should calculate bilancio and check >= 2 in nominateFreeAgent', () => {
    const fnStart = code.indexOf('export async function nominateFreeAgent')
    expect(fnStart).toBeGreaterThan(-1)

    const fnBody = code.slice(fnStart, fnStart + 3000)

    // Should have bilancio calculation
    expect(fnBody).toContain('bilancio')

    // Should check bilancio < 2
    expect(fnBody).toMatch(/bilancio\s*<\s*2/)
  })
})

// ==================== P1-7: Contracts.tsx residuo includes totalIndemnities ====================

describe('P1-7: Contracts.tsx residuo formula includes totalIndemnities', () => {
  const contractsPagePath = path.resolve(
    __dirname,
    '../../src/pages/Contracts.tsx'
  )
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(contractsPagePath, 'utf8')
  })

  it('should have totalIndemnities in the residuoContratti formula', () => {
    // Find the residuoContratti calculation
    const residuoStart = code.indexOf('const residuoContratti')
    expect(residuoStart).toBeGreaterThan(-1)

    const residuoBlock = code.slice(residuoStart, residuoStart + 500)

    // The formula must include totalIndemnities:
    // residuo = memberBudget - projectedSalaries - totalReleaseCost + totalIndemnities
    expect(residuoBlock).toContain('totalIndemnities')
  })

  it('should have the correct formula: budget - salaries - releases + indemnities', () => {
    const residuoStart = code.indexOf('const residuoContratti')
    expect(residuoStart).toBeGreaterThan(-1)

    const residuoBlock = code.slice(residuoStart, residuoStart + 500)

    // Must have all components
    expect(residuoBlock).toContain('memberBudget')
    expect(residuoBlock).toContain('projectedSalaries')
    expect(residuoBlock).toContain('totalReleaseCost')
    expect(residuoBlock).toContain('totalIndemnities')
  })

  it('should have a totalIndemnities calculation that includes ESTERO compensation', () => {
    const indemnityStart = code.indexOf('const totalIndemnities')
    expect(indemnityStart).toBeGreaterThan(-1)

    // Use a larger window (800 chars) to capture the full useMemo block
    const indemnityBlock = code.slice(indemnityStart, indemnityStart + 800)

    // Must look at ESTERO exit reason
    expect(indemnityBlock).toContain('ESTERO')
    // Must look at RELEASE decision
    expect(indemnityBlock).toContain('RELEASE')
    // Must use indemnityCompensation
    expect(indemnityBlock).toContain('indemnityCompensation')
  })
})
