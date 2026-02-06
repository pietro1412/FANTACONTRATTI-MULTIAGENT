/**
 * Sprint 5 - Feature mancanti M-1 a M-15
 * Test suite for missing features from GAP Analysis.
 *
 * M-1: Pause/resume timer admin (auction + svincolati)
 * M-2: Admin rectifications (cancel auction, rectify transaction)
 * M-3: Skip member with bilancio < 2 in advanceToNextTurn
 * M-4: Svincolati turn order auto-reverse rubata order
 * M-5: End svincolati phase if no member has bilancio >= 2
 * M-6: End svincolati phase if no free agents available
 * M-7: Audit logging for admin actions
 * M-8: Ex-player rule in rubata (cannot steal player you released)
 * M-9: COMPLETED rubata after last ACK on last board player
 * M-10: Box budget/residuo board rubata (GIA FATTO)
 * M-11: Ricalcolo monte ingaggi al consolidamento
 * M-12: Runtime budget >= 0 validation
 * M-13: Movement per svincolo automatico scadenza
 * M-14: Release cost 0 for ESTERO/RETROCESSO
 * M-15: No spalma post-acquisizione (GIA FATTO)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

// ==================== M-3: Skip member bilancio < 2 ====================

describe('M-3: advanceToNextTurn skips members with bilancio < 2', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/auction.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('advanceToNextTurn checks bilancio for each candidate', () => {
    const fnStart = code.indexOf('export async function advanceToNextTurn')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 3000)
    // Must calculate bilancio = currentBudget - monteIngaggi
    expect(fnBody).toContain('playerContract.aggregate')
    expect(fnBody).toContain('bilancio')
    expect(fnBody).toMatch(/bilancio\s*>=\s*2/)
  })

  it('advanceToNextTurn reports allInsufficientBudget when no one can play', () => {
    const fnStart = code.indexOf('export async function advanceToNextTurn')
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('allInsufficientBudget')
  })

  it('advanceToNextTurn tracks skippedMembers', () => {
    const fnStart = code.indexOf('export async function advanceToNextTurn')
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('skippedMembers')
  })
})

// ==================== M-5: End svincolati if no budget >= 2 ====================

describe('M-5: advanceSvincolatiToNextTurn ends phase if no budget >= 2', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('checks all members bilancio at start of advanceSvincolatiToNextTurn', () => {
    const fnStart = code.indexOf('async function advanceSvincolatiToNextTurn')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain('anyoneCanBuy')
    expect(fnBody).toContain('playerContract.aggregate')
    expect(fnBody).toMatch(/bilancio\s*>=\s*2/)
  })

  it('sets svincolatiState to COMPLETED when no budget', () => {
    const fnStart = code.indexOf('async function advanceSvincolatiToNextTurn')
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain("reason: 'no_budget'")
    expect(fnBody).toContain("svincolatiState: 'COMPLETED'")
  })

  it('also skips individual members with bilancio < 2 in turn rotation', () => {
    const fnStart = code.indexOf('async function advanceSvincolatiToNextTurn')
    const fnBody = code.slice(fnStart, fnStart + 8000)
    expect(fnBody).toContain('insufficientBudgetMembers')
  })
})

// ==================== M-6: End svincolati if no free agents ====================

describe('M-6: advanceSvincolatiToNextTurn ends phase if no free agents', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('counts free agents at start of turn advance', () => {
    const fnStart = code.indexOf('async function advanceSvincolatiToNextTurn')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('freeAgentCount')
    expect(fnBody).toContain("listStatus: 'IN_LIST'")
  })

  it('completes phase when no free agents available', () => {
    const fnStart = code.indexOf('async function advanceSvincolatiToNextTurn')
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain("reason: 'no_free_agents'")
  })
})

// ==================== M-9: COMPLETED rubata after last ACK ====================

describe('M-9: acknowledgeRubataTransaction completes rubata on last player ACK', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/rubata.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('checks if current player is last on board', () => {
    const fnStart = code.indexOf('export async function acknowledgeRubataTransaction')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain('isLastPlayer')
    expect(fnBody).toContain('rubataBoardIndex')
    expect(fnBody).toContain('board.length')
  })

  it('sets rubataState to COMPLETED when last player acknowledged', () => {
    const fnStart = code.indexOf('export async function acknowledgeRubataTransaction')
    const fnBody = code.slice(fnStart, fnStart + 5000)
    // After isLastPlayer check, state should go to COMPLETED
    const isLastPlayerIdx = fnBody.indexOf('isLastPlayer')
    const afterCheck = fnBody.slice(isLastPlayerIdx, isLastPlayerIdx + 1000)
    expect(afterCheck).toContain("rubataState: 'COMPLETED'")
  })

  it('returns completed: true in response data', () => {
    const fnStart = code.indexOf('export async function acknowledgeRubataTransaction')
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain('completed: true')
  })
})

// ==================== M-14: Release cost 0 for ESTERO/RETROCESSO ====================

describe('M-14: releasePlayer has zero cost for ESTERO/RETROCESSO', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/contract.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('checks player exitReason before calculating release cost', () => {
    const fnStart = code.indexOf('export async function releasePlayer')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('isExitedPlayer')
    expect(fnBody).toContain('exitReason')
    expect(fnBody).toContain('ESTERO')
    expect(fnBody).toContain('RETROCESSO')
  })

  it('sets releaseCost to 0 for exited players', () => {
    const fnStart = code.indexOf('export async function releasePlayer')
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toMatch(/isExitedPlayer\s*\?\s*0/)
  })

  it('uses specific movement type for exited players', () => {
    const fnStart = code.indexOf('export async function releasePlayer')
    const fnBody = code.slice(fnStart, fnStart + 4000)
    expect(fnBody).toContain('ABROAD_COMPENSATION')
    expect(fnBody).toContain('RELEGATION_RELEASE')
  })
})

// ==================== M-4: Svincolati reverse rubata order ====================

describe('M-4: setSvincolatiTurnOrder auto-reverses rubata order', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('auto-reverses rubata order when no memberIds provided', () => {
    const fnStart = code.indexOf('export async function setSvincolatiTurnOrder')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('rubataOrder')
    expect(fnBody).toContain('.reverse()')
  })

  it('uses explicit memberIds when provided', () => {
    const fnStart = code.indexOf('export async function setSvincolatiTurnOrder')
    const fnBody = code.slice(fnStart, fnStart + 3000)
    // finalMemberIds should be set to memberIds when provided
    expect(fnBody).toContain('finalMemberIds')
  })

  it('reports autoReversed flag in response', () => {
    const fnStart = code.indexOf('export async function setSvincolatiTurnOrder')
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('autoReversed')
  })
})

// ==================== M-11: Ricalcolo monte ingaggi consolidamento ====================

describe('M-11: consolidateContracts verifies monte ingaggi post-consolidation', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/contract.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('recalculates total salaries after all operations', () => {
    // Search by M-11 comment marker since function is very long
    expect(code).toContain('M-11')
    expect(code).toContain('postMonteIngaggi')
    expect(code).toContain('postConsolidationContracts')
  })

  it('throws error if monte ingaggi exceeds budget', () => {
    // Find the M-11 block directly
    const m11Start = code.indexOf('M-11')
    expect(m11Start).toBeGreaterThan(-1)
    const m11Block = code.slice(m11Start, m11Start + 1000)
    expect(m11Block).toMatch(/postMonteIngaggi.*>.*currentBudget/)
  })
})

// ==================== M-13: Movement for auto-release on contract expiry ====================

describe('M-13: decrementContractDurations creates PlayerMovement for auto-release', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/auction.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('calls recordMovement when contract expires (duration = 0)', () => {
    const fnStart = code.indexOf('async function decrementContractDurations')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 5000)
    // Should have recordMovement call in the newDuration <= 0 branch
    const expiredBranch = fnBody.indexOf('newDuration <= 0')
    expect(expiredBranch).toBeGreaterThan(-1)
    const branchBody = fnBody.slice(expiredBranch, expiredBranch + 2000)
    expect(branchBody).toContain('recordMovement')
  })

  it('uses RELEASE movement type with price 0 for auto-release', () => {
    const fnStart = code.indexOf('async function decrementContractDurations')
    const fnBody = code.slice(fnStart, fnStart + 5000)
    const expiredBranch = fnBody.indexOf('newDuration <= 0')
    const branchBody = fnBody.slice(expiredBranch, expiredBranch + 2000)
    expect(branchBody).toContain("movementType: 'RELEASE'")
    expect(branchBody).toContain('price: 0')
  })
})

// ==================== M-12: Budget >= 0 runtime validation ====================

describe('M-12: Budget >= 0 runtime validation', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/contract.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('exports validateBudgetNotNegative function', () => {
    expect(code).toContain('export async function validateBudgetNotNegative')
  })

  it('validates currentBudget >= 0', () => {
    const fnStart = code.indexOf('export async function validateBudgetNotNegative')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 500)
    expect(fnBody).toContain('currentBudget')
    expect(fnBody).toMatch(/currentBudget\s*>=\s*0/)
  })

  it('schema documents M-12 constraint', () => {
    const schemaPath = path.resolve(__dirname, '../../prisma/schemas/league.prisma')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    expect(schema).toContain('M-12')
    expect(schema).toContain('validateBudgetNotNegative')
  })
})

// ==================== M-8: Ex-player rule rubata ====================

describe('M-8: makeRubataOffer blocks stealing your own released player', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/rubata.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('checks playerMovement for previous release by the same member', () => {
    const fnStart = code.indexOf('export async function makeRubataOffer')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain('playerMovement.findFirst')
    expect(fnBody).toContain('fromMemberId')
    expect(fnBody).toContain('marketSessionId')
  })

  it('checks for RELEASE, RELEGATION_RELEASE, ABROAD_COMPENSATION movement types', () => {
    const fnStart = code.indexOf('export async function makeRubataOffer')
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain('RELEASE')
    expect(fnBody).toContain('RELEGATION_RELEASE')
    expect(fnBody).toContain('ABROAD_COMPENSATION')
  })

  it('returns error message about released player', () => {
    const fnStart = code.indexOf('export async function makeRubataOffer')
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toMatch(/non puoi rubare.*svincolato/i)
  })
})

// ==================== M-1: Pause/resume timer ====================

describe('M-1: Pause/resume timer admin functions', () => {
  it('auction.service.ts exports pauseAuction', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/auction.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    expect(code).toContain('export async function pauseAuction')
  })

  it('auction.service.ts exports resumeAuction', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/auction.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    expect(code).toContain('export async function resumeAuction')
  })

  it('svincolati.service.ts exports pauseSvincolati', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    expect(code).toContain('export async function pauseSvincolati')
  })

  it('svincolati.service.ts exports resumeSvincolati', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    expect(code).toContain('export async function resumeSvincolati')
  })

  it('rubata already has pauseRubata and resumeRubata', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/rubata.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    expect(code).toContain('export async function pauseRubata')
    expect(code).toContain('export async function resumeRubata')
  })

  it('svincolati pause stores remaining seconds and paused state', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    const fnStart = code.indexOf('export async function pauseSvincolati')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 2000)
    expect(fnBody).toContain('svincolatiPausedRemainingSeconds')
    expect(fnBody).toContain('svincolatiPausedFromState')
    expect(fnBody).toContain("svincolatiState: 'PAUSED'")
  })

  it('schema has svincolati pause fields', () => {
    const schemaPath = path.resolve(__dirname, '../../prisma/schemas/market-session.prisma')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    expect(schema).toContain('svincolatiPausedRemainingSeconds')
    expect(schema).toContain('svincolatiPausedFromState')
  })
})

// ==================== M-7: Audit tracking ====================

describe('M-7: Admin action audit logging', () => {
  it('svincolati.service.ts imports logAction', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    expect(code).toContain("import { logAction } from './admin.service'")
  })

  it('declareSvincolatiFinished logs audit action', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    const fnStart = code.indexOf('export async function declareSvincolatiFinished')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('SVINCOLATI_DECLARE_FINISHED')
    expect(fnBody).toContain('logAction')
  })

  it('undoSvincolatiFinished logs audit action', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    const fnStart = code.indexOf('export async function undoSvincolatiFinished')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('SVINCOLATI_UNDO_FINISHED')
    expect(fnBody).toContain('logAction')
  })

  it('pauseSvincolati logs audit action', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/svincolati.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    const fnStart = code.indexOf('export async function pauseSvincolati')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('SVINCOLATI_PAUSE')
    expect(fnBody).toContain('logAction')
  })
})

// ==================== M-2: Admin rectifications ====================

describe('M-2: Admin cancel/rectify auction functions', () => {
  const servicePath = path.resolve(__dirname, '../../src/services/auction.service.ts')
  let code: string

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf8')
  })

  it('exports cancelActiveAuction function', () => {
    expect(code).toContain('export async function cancelActiveAuction')
  })

  it('cancelActiveAuction requires admin role', () => {
    const fnStart = code.indexOf('export async function cancelActiveAuction')
    const fnBody = code.slice(fnStart, fnStart + 2000)
    expect(fnBody).toContain('MemberRole.ADMIN')
  })

  it('cancelActiveAuction cancels all bids', () => {
    const fnStart = code.indexOf('export async function cancelActiveAuction')
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('auctionBid.updateMany')
    expect(fnBody).toContain('isCancelled: true')
  })

  it('cancelActiveAuction creates audit log', () => {
    const fnStart = code.indexOf('export async function cancelActiveAuction')
    const fnBody = code.slice(fnStart, fnStart + 3000)
    expect(fnBody).toContain('AUCTION_CANCELLED_BY_ADMIN')
    expect(fnBody).toContain('auditLog.create')
  })

  it('exports rectifyTransaction function', () => {
    expect(code).toContain('export async function rectifyTransaction')
  })

  it('rectifyTransaction restores budget to winner', () => {
    const fnStart = code.indexOf('export async function rectifyTransaction')
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain('increment: winningBid.amount')
  })

  it('rectifyTransaction removes roster and contract', () => {
    const fnStart = code.indexOf('export async function rectifyTransaction')
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain('playerContract.delete')
    expect(fnBody).toContain('playerRoster.delete')
  })

  it('rectifyTransaction creates audit log', () => {
    const fnStart = code.indexOf('export async function rectifyTransaction')
    const fnBody = code.slice(fnStart, fnStart + 5000)
    expect(fnBody).toContain('TRANSACTION_RECTIFIED_BY_ADMIN')
    expect(fnBody).toContain('auditLog.create')
  })
})

// ==================== M-10: Already implemented ====================

describe('M-10: Budget/residuo box in rubata board (pre-existing)', () => {
  it('rubata.service.ts includes bilancio in board data', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/rubata.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    // getRubataState or similar should include budget info
    expect(code).toContain('bilancio')
    expect(code).toContain('currentBudget')
  })
})

// ==================== M-15: Already implemented ====================

describe('M-15: No spalma post-acquisition (pre-existing)', () => {
  it('modifyContractPostAcquisition blocks duration increase without salary increase', () => {
    const servicePath = path.resolve(__dirname, '../../src/services/contract.service.ts')
    const code = fs.readFileSync(servicePath, 'utf8')
    const fnStart = code.indexOf('export async function modifyContractPostAcquisition')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = code.slice(fnStart, fnStart + 3000)
    // Must check: newDuration > contract.duration && newSalary <= contract.salary
    expect(fnBody).toContain('newDuration > contract.duration')
  })
})
