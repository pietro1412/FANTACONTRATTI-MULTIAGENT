/**
 * Unit test per closeRubataAuction — verifica il rework 01/09/2026
 * (docs/reviews/rework-finanze-2026-09-01.md): un contratto rubato torna
 * "non pagato" (paidAt: null) per il nuovo proprietario, un vero riacquisto
 * a differenza dello Scambio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  auction: { findUnique: vi.fn(), update: vi.fn() },
  leagueMember: { findFirst: vi.fn() },
  playerRoster: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/services/movement.service', () => ({ recordMovement: vi.fn() }))

const AUCTION_ID = 'auction-1'
const ADMIN_USER_ID = 'admin-1'
const SELLER_ID = 'seller-1'
const WINNER_ID = 'winner-1'
const CONTRACT_ID = 'contract-1'
const ROSTER_ID = 'roster-1'

async function getService() {
  return import('@/services/rubata.service')
}

describe('rubata.service — closeRubataAuction (rework 01/09/2026, paidAt)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma.auction.findUnique.mockResolvedValue({
      id: AUCTION_ID,
      type: 'RUBATA',
      status: 'ACTIVE',
      leagueId: 'league-1',
      sellerId: SELLER_ID,
      playerId: 'player-1',
      currentPrice: 46,
      player: { id: 'player-1', name: 'Test Player' },
      bids: [{ bidderId: WINNER_ID, isWinning: true, bidder: { teamName: 'FC Winner' } }],
    })
    mockPrisma.leagueMember.findFirst.mockResolvedValue({
      id: ADMIN_USER_ID,
      role: 'ADMIN',
      status: 'ACTIVE',
    })
    mockPrisma.playerRoster.findFirst.mockResolvedValue({
      contract: { salary: 6, duration: 3, rescissionClause: 40 },
    })
  })

  function mockTx() {
    const contractUpdate = vi.fn().mockResolvedValue({})
    const tx = {
      leagueMember: {
        findUnique: vi.fn().mockResolvedValue({ id: SELLER_ID }),
        update: vi.fn().mockResolvedValue({}),
      },
      playerRoster: {
        findFirst: vi.fn().mockResolvedValue({
          id: ROSTER_ID,
          contract: { id: CONTRACT_ID, salary: 6 },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      playerContract: { update: contractUpdate },
      auction: { update: vi.fn().mockResolvedValue({}) },
    }
    return { tx, contractUpdate }
  }

  it('resetta paidAt a null sul contratto trasferito al vincitore (clausola 40 + ingaggio 6, offerta 40)', async () => {
    const { closeRubataAuction } = await getService()
    const { tx, contractUpdate } = mockTx()
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(tx))

    const result = await closeRubataAuction(AUCTION_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)
    expect(contractUpdate).toHaveBeenCalledWith({
      where: { id: CONTRACT_ID },
      data: { leagueMemberId: WINNER_ID, paidAt: null },
    })
    // Offerta = prezzo(46) - ingaggio(6) = 40, non il prezzo pieno
    expect(tx.leagueMember.update).toHaveBeenCalledWith({
      where: { id: WINNER_ID },
      data: { currentBudget: { decrement: 40 }, totalSalaries: { increment: 6 } },
    })
  })
})
