/**
 * Regressione 2026-08-29: markReadyForSvincolati e acknowledgeSvincolatiAuction
 * leggevano e riscrivevano array JSON (svincolatiReadyMembers,
 * svincolatiPendingAck.acknowledgedMembers) senza guardia atomica — stessa
 * classe del bug ready-check/conferme già trovato e corretto in Rubata
 * (commit 80202d0). Con più manager che agiscono quasi in contemporanea,
 * due scritture concorrenti si sovrascrivono a vicenda e un "pronto"/una
 * conferma va persa silenziosamente.
 *
 * Questi test bloccano: (1) il comportamento normale non cambia, (2) il
 * conflitto di scrittura Postgres (transazione Serializable, P2034) viene
 * ritentato con rilettura fresca invece di essere propagato come errore,
 * (3) i side-effect pesanti (avvio asta, avanzamento turno) restano fuori
 * dal blocco di retry e scattano esattamente una volta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => {
  const p = {
    leagueMember: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    marketSession: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    playerRoster: { findFirst: vi.fn(), findMany: vi.fn() },
    playerContract: { aggregate: vi.fn() },
    serieAPlayer: { findUnique: vi.fn(), count: vi.fn() },
    auction: { create: vi.fn() },
    auctionBid: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  p.$transaction.mockImplementation((fn: (tx: typeof p) => Promise<unknown>) => fn(p))
  return { prisma: p }
})

vi.mock('../services/movement.service', () => ({ recordMovement: vi.fn() }))
vi.mock('../services/admin.service', () => ({ logAction: vi.fn() }))
vi.mock('../services/contract.service', () => ({
  calculateDefaultSalary: vi.fn().mockReturnValue(1),
  calculateRescissionClause: vi.fn().mockReturnValue(1),
  DEFAULT_CONTRACT_DURATION: 3,
}))
vi.mock('../services/pusher.service', () => ({
  triggerSvincolatiNomination: vi.fn().mockResolvedValue(undefined),
  triggerSvincolatiBidPlaced: vi.fn().mockResolvedValue(undefined),
  triggerSvincolatiReadyChanged: vi.fn().mockResolvedValue(undefined),
  triggerSvincolatiAuctionClosed: vi.fn().mockResolvedValue(undefined),
  triggerSvincolatiTurnAdvanced: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@/lib/prisma'
import type { Mock } from 'vitest'
import { markReadyForSvincolati, acknowledgeSvincolatiAuction } from '../services/svincolati.service'

const mockPrisma = prisma as unknown as {
  leagueMember: { findFirst: Mock; findMany: Mock; findUnique: Mock }
  marketSession: { findFirst: Mock; findUnique: Mock; update: Mock }
  playerRoster: { findFirst: Mock; findMany: Mock }
  playerContract: { aggregate: Mock }
  serieAPlayer: { findUnique: Mock; count: Mock }
  auction: { create: Mock }
  auctionBid: { create: Mock }
  $transaction: Mock
}

const LEAGUE_ID = 'league-1'
const USER_ID = 'user-1'
const MEMBER_ID = 'member-1'
const SESSION_ID = 'session-1'

function makeMember(overrides: Record<string, unknown> = {}) {
  return { id: MEMBER_ID, leagueId: LEAGUE_ID, userId: USER_ID, status: 'ACTIVE', currentBudget: 100, ...overrides }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    leagueId: LEAGUE_ID,
    status: 'ACTIVE',
    currentPhase: 'ASTA_SVINCOLATI',
    svincolatiState: 'NOMINATION',
    svincolatiNominatorConfirmed: true,
    svincolatiReadyMembers: [] as string[],
    svincolatiTurnOrder: [MEMBER_ID, 'member-2'],
    svincolatiPendingAck: null,
    svincolatiPendingPlayerId: 'player-1',
    svincolatiPendingNominatorId: MEMBER_ID,
    svincolatiTimerSeconds: 20,
    auctionMode: 'REMOTE',
    ...overrides,
  }
}

describe('markReadyForSvincolati — race condition fix', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('registra il pronto quando non sono ancora tutti pronti', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(makeSession())
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce({ ...makeMember(), user: { username: 'mario' } })
    mockPrisma.marketSession.findUnique.mockResolvedValueOnce(makeSession())
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await markReadyForSvincolati(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(true)
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { svincolatiReadyMembers: [MEMBER_ID] },
    })
  })

  it('rifiuta se il membro è già pronto, senza scrivere', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(makeSession())
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce({ ...makeMember(), user: { username: 'mario' } })
    mockPrisma.marketSession.findUnique.mockResolvedValueOnce(makeSession({ svincolatiReadyMembers: [MEMBER_ID] }))

    const result = await markReadyForSvincolati(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(mockPrisma.marketSession.update).not.toHaveBeenCalled()
  })

  it('quando tutti diventano pronti avvia l\'asta esattamente una volta (fuori dal retry)', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(makeSession({ svincolatiReadyMembers: ['member-2'] }))
    mockPrisma.leagueMember.findUnique
      .mockResolvedValueOnce({ ...makeMember(), user: { username: 'mario' } }) // memberWithUser
      .mockResolvedValueOnce({ id: MEMBER_ID, userId: USER_ID }) // nominator lookup in startSvincolatiAuction
    mockPrisma.marketSession.findUnique
      .mockResolvedValueOnce(makeSession({ svincolatiReadyMembers: ['member-2'] })) // dentro la tx di ready-check
      .mockResolvedValueOnce(makeSession({ svincolatiReadyMembers: ['member-2'] })) // dentro startSvincolatiAuction
    mockPrisma.serieAPlayer.findUnique.mockResolvedValueOnce({ id: 'player-1', name: 'Test Player' })
    mockPrisma.auction.create.mockResolvedValueOnce({ id: 'auction-1' })
    mockPrisma.auctionBid.create.mockResolvedValueOnce({})
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await markReadyForSvincolati(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(true)
    expect(mockPrisma.auction.create).toHaveBeenCalledTimes(1)
    // L'update di bookkeeping "solo append" NON deve avvenire: quando allReady
    // e' vero, la transazione di retry non scrive nulla (lo stato lo scrive
    // startSvincolatiAuction subito dopo, una sola volta).
    expect(mockPrisma.marketSession.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ svincolatiState: 'AUCTION' }) })
    )
  })

  it('ritenta e converge a successo quando la transazione Serializable va in conflitto (P2034)', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(makeSession())
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce({ ...makeMember(), user: { username: 'mario' } })
    mockPrisma.marketSession.findUnique.mockResolvedValue(makeSession())
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const conflictError = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: '5.22.0',
    })

    let calls = 0
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      calls++
      if (calls === 1) throw conflictError
      return fn(mockPrisma)
    })

    const result = await markReadyForSvincolati(LEAGUE_ID, USER_ID)

    expect(calls).toBe(2)
    expect(result.success).toBe(true)
  })
})

describe('acknowledgeSvincolatiAuction — race condition fix', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const pendingAck = {
    auctionId: 'auction-1',
    playerId: 'player-1',
    playerName: 'Test Player',
    winnerId: 'member-2',
    winnerUsername: 'rivale',
    price: 10,
    noBids: false,
    acknowledgedMembers: [] as string[],
    pendingMembers: [MEMBER_ID, 'member-2'],
  }

  it('registra la conferma quando non hanno ancora confermato tutti', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ svincolatiState: 'PENDING_ACK', svincolatiPendingAck: pendingAck })
    )
    mockPrisma.marketSession.findUnique.mockResolvedValueOnce(
      makeSession({ svincolatiState: 'PENDING_ACK', svincolatiPendingAck: pendingAck })
    )
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await acknowledgeSvincolatiAuction(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(true)
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: {
        svincolatiPendingAck: expect.objectContaining({
          acknowledgedMembers: [MEMBER_ID],
          pendingMembers: ['member-2'],
        }),
      },
    })
  })

  it('rifiuta se ha già confermato, senza scrivere', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ svincolatiState: 'PENDING_ACK', svincolatiPendingAck: { ...pendingAck, acknowledgedMembers: [MEMBER_ID] } })
    )

    const result = await acknowledgeSvincolatiAuction(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(mockPrisma.marketSession.update).not.toHaveBeenCalled()
  })

  it('quando confermano tutti avanza il turno esattamente una volta (fuori dal retry)', async () => {
    const almostDone = { ...pendingAck, acknowledgedMembers: ['member-2'], pendingMembers: [MEMBER_ID] }
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ svincolatiState: 'PENDING_ACK', svincolatiPendingAck: almostDone })
    )
    mockPrisma.marketSession.findUnique
      .mockResolvedValueOnce(makeSession({ svincolatiState: 'PENDING_ACK', svincolatiPendingAck: almostDone })) // dentro la tx di ack
      .mockResolvedValueOnce(makeSession({ svincolatiState: 'PENDING_ACK' })) // dentro advanceSvincolatiToNextTurn
    // Ramo corto di advanceSvincolatiToNextTurn: nessuno svincolato disponibile -> COMPLETED.
    mockPrisma.playerRoster.findMany.mockResolvedValueOnce([])
    mockPrisma.serieAPlayer.count.mockResolvedValueOnce(0)
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const result = await acknowledgeSvincolatiAuction(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(true)
    expect(mockPrisma.marketSession.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ svincolatiState: 'COMPLETED' }) })
    )
    const data = result.data as { winnerContractInfo: unknown }
    expect(data).toHaveProperty('winnerContractInfo')
  })

  it('ritenta e converge a successo quando la transazione Serializable va in conflitto (P2034)', async () => {
    mockPrisma.leagueMember.findFirst.mockResolvedValueOnce(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValueOnce(
      makeSession({ svincolatiState: 'PENDING_ACK', svincolatiPendingAck: pendingAck })
    )
    mockPrisma.marketSession.findUnique.mockResolvedValue(
      makeSession({ svincolatiState: 'PENDING_ACK', svincolatiPendingAck: pendingAck })
    )
    mockPrisma.marketSession.update.mockResolvedValueOnce({})

    const conflictError = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: '5.22.0',
    })

    let calls = 0
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      calls++
      if (calls === 1) throw conflictError
      return fn(mockPrisma)
    })

    const result = await acknowledgeSvincolatiAuction(LEAGUE_ID, USER_ID)

    expect(calls).toBe(2)
    expect(result.success).toBe(true)
  })
})
