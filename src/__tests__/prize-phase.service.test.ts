/**
 * Unit tests for prize-phase.service.ts — finalizePrizePhase e adminCorrectMemberPrize.
 *
 * Nessun test automatico esisteva per questo file prima del controllo definitivo
 * bilanci 2026-08-28 (buco di test trovato durante l'audit, sullo stesso file appena
 * modificato pesantemente in quella sessione). Questi test bloccano l'invariante
 * centrale trovato/corretto in quella sessione: gli indennizzi non vengono MAI
 * accreditati al finalize/alla correzione — solo base + premi normali (isCreditedCategory).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  marketSession: { findUnique: vi.fn(), findFirst: vi.fn() },
  leagueMember: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  prizePhaseConfig: { findUnique: vi.fn(), update: vi.fn() },
  prizeCategory: { findFirst: vi.fn(), findMany: vi.fn() },
  sessionPrize: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/services/app-log.service', () => ({ logInfo: vi.fn() }))

const LEAGUE_ID = 'league-1'
const SESSION_ID = 'session-1'
const ADMIN_USER_ID = 'admin-user-1'
const ADMIN_MEMBER_ID = 'admin-member-1'
const MEMBER_A = 'member-a'
const MEMBER_B = 'member-b'

describe('prize-phase.service — finalizePrizePhase', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma.marketSession.findUnique.mockResolvedValue({ id: SESSION_ID, leagueId: LEAGUE_ID })
    mockPrisma.leagueMember.findFirst.mockResolvedValue({
      id: ADMIN_MEMBER_ID, leagueId: LEAGUE_ID, userId: ADMIN_USER_ID, role: 'ADMIN', status: 'ACTIVE',
    })
    mockPrisma.prizePhaseConfig.findUnique.mockResolvedValue({
      id: 'config-1', marketSessionId: SESSION_ID, baseReincrement: 100, isFinalized: false, createdAt: new Date('2026-01-01'),
    })
    // ensureBaseReincrementCategory: categoria già esistente, si ferma subito.
    mockPrisma.prizeCategory.findFirst.mockResolvedValue({ id: 'base-cat' })

    mockPrisma.leagueMember.findMany.mockResolvedValue([
      { id: MEMBER_A, teamName: 'FC A', currentBudget: 200, user: { username: 'manager-a' } },
      { id: MEMBER_B, teamName: 'FC B', currentBudget: 200, user: { username: 'manager-b' } },
    ])

    mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg)
      return arg
    })
  })

  it('accredita base + premi normali ma esclude sempre l\'indennizzo dal budget', async () => {
    mockPrisma.sessionPrize.findMany.mockResolvedValue([
      // Member A: Re-incremento Base (100, credited) + Capocannoniere (20, credited)
      { leagueMemberId: MEMBER_A, amount: 100, prizeCategory: { isSystemPrize: true, name: 'Re-incremento Base' } },
      { leagueMemberId: MEMBER_A, amount: 20, prizeCategory: { isSystemPrize: false, name: 'Capocannoniere' } },
      // Member B: Re-incremento Base (100, credited) + Indennizzo Partenza Estero (50, NON credited)
      { leagueMemberId: MEMBER_B, amount: 100, prizeCategory: { isSystemPrize: true, name: 'Re-incremento Base' } },
      { leagueMemberId: MEMBER_B, amount: 50, prizeCategory: { isSystemPrize: true, name: 'Indennizzo Partenza Estero' } },
      { leagueMemberId: MEMBER_B, amount: 30, prizeCategory: { isSystemPrize: true, name: 'Indennizzo - Qualche Giocatore' } },
    ])

    const { finalizePrizePhase } = await import('../services/prize-phase.service')
    const result = await finalizePrizePhase(SESSION_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)

    // Member A: 100 + 20 = 120 (tutto credited)
    expect(mockPrisma.leagueMember.update).toHaveBeenCalledWith({
      where: { id: MEMBER_A },
      data: { currentBudget: { increment: 120 } },
    })

    // Member B: SOLO 100 (base) — i 50+30 di indennizzo NON vanno mai al budget qui.
    expect(mockPrisma.leagueMember.update).toHaveBeenCalledWith({
      where: { id: MEMBER_B },
      data: { currentBudget: { increment: 100 } },
    })
  })

  it('rifiuta se la fase è già stata finalizzata', async () => {
    mockPrisma.prizePhaseConfig.findUnique.mockResolvedValue({
      id: 'config-1', marketSessionId: SESSION_ID, baseReincrement: 100, isFinalized: true, createdAt: new Date(),
    })

    const { finalizePrizePhase } = await import('../services/prize-phase.service')
    const result = await finalizePrizePhase(SESSION_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(mockPrisma.leagueMember.update).not.toHaveBeenCalled()
  })
})

describe('prize-phase.service — adminCorrectMemberPrize', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma.marketSession.findFirst.mockResolvedValue({ id: SESSION_ID, leagueId: LEAGUE_ID })
    mockPrisma.leagueMember.findFirst.mockImplementation(({ where }: { where: { id?: string; role?: string } }) => {
      if (where.role === 'ADMIN') return { id: ADMIN_MEMBER_ID, leagueId: LEAGUE_ID, userId: ADMIN_USER_ID, role: 'ADMIN', status: 'ACTIVE' }
      return { id: where.id, leagueId: LEAGUE_ID, status: 'ACTIVE', user: { username: 'target' }, teamName: 'FC Target' }
    })
    mockPrisma.prizePhaseConfig.findUnique.mockResolvedValue({ id: 'config-1', isFinalized: true })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        sessionPrize: { upsert: vi.fn().mockResolvedValue({}) },
        leagueMember: { update: mockPrisma.leagueMember.update },
      })
    )
  })

  it('applica il delta al budget per una categoria normale (credited) a fase finalizzata', async () => {
    mockPrisma.prizeCategory.findFirst.mockResolvedValue({
      id: 'cat-1', marketSessionId: SESSION_ID, name: 'Capocannoniere', isSystemPrize: false,
    })
    mockPrisma.sessionPrize.findUnique.mockResolvedValue({ amount: 20 })

    const { adminCorrectMemberPrize } = await import('../services/prize-phase.service')
    const result = await adminCorrectMemberPrize(LEAGUE_ID, ADMIN_USER_ID, {
      marketSessionId: SESSION_ID, categoryId: 'cat-1', leagueMemberId: MEMBER_A, newAmount: 35,
    })

    expect(result.success).toBe(true)
    // delta = 35 - 20 = 15, categoria credited → tocca il budget.
    expect(mockPrisma.leagueMember.update).toHaveBeenCalledWith({
      where: { id: MEMBER_A },
      data: { currentBudget: { increment: 15 } },
    })
  })

  it('NON tocca il budget per una correzione su una categoria indennizzo (non credited)', async () => {
    mockPrisma.prizeCategory.findFirst.mockResolvedValue({
      id: 'cat-indemnity', marketSessionId: SESSION_ID, name: 'Indennizzo - Mario Rossi', isSystemPrize: true,
    })
    mockPrisma.sessionPrize.findUnique.mockResolvedValue({ amount: 50 })

    const { adminCorrectMemberPrize } = await import('../services/prize-phase.service')
    const result = await adminCorrectMemberPrize(LEAGUE_ID, ADMIN_USER_ID, {
      marketSessionId: SESSION_ID, categoryId: 'cat-indemnity', leagueMemberId: MEMBER_A, newAmount: 80,
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.leagueMember.update).not.toHaveBeenCalled()
  })

  it('applica il delta al budget per "Re-incremento Base" (system ma credited) a fase finalizzata', async () => {
    mockPrisma.prizeCategory.findFirst.mockResolvedValue({
      id: 'cat-base', marketSessionId: SESSION_ID, name: 'Re-incremento Base', isSystemPrize: true,
    })
    mockPrisma.sessionPrize.findUnique.mockResolvedValue({ amount: 100 })

    const { adminCorrectMemberPrize } = await import('../services/prize-phase.service')
    const result = await adminCorrectMemberPrize(LEAGUE_ID, ADMIN_USER_ID, {
      marketSessionId: SESSION_ID, categoryId: 'cat-base', leagueMemberId: MEMBER_A, newAmount: 130,
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.leagueMember.update).toHaveBeenCalledWith({
      where: { id: MEMBER_A },
      data: { currentBudget: { increment: 30 } },
    })
  })
})
