/**
 * Sessione test 2026-06-09 — F2: elimina ogni sessione MERCATO_RICORRENTE della "Lega test E2E"
 * e tutte le righe che la referenziano, in ordine FK-safe. Serve a riportare la lega a
 * "solo PRIMO_MERCATO presente", così che dopo fill+close si possa ri-aprire il Mercato
 * Ricorrente dalla UI in modo pulito.
 *
 * Difensivo/idempotente: se non esistono sessioni ricorrenti, no-op. Opera SOLO sulla lega E2E.
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/cleanup-recurrent-e2e.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'

async function main() {
  const recurrent = await prisma.marketSession.findMany({
    where: { leagueId: LEAGUE_ID, type: 'MERCATO_RICORRENTE' },
    select: { id: true, status: true, currentPhase: true },
  })
  if (recurrent.length === 0) {
    console.log('Nessuna sessione MERCATO_RICORRENTE da eliminare — no-op.')
    return
  }
  const ids = recurrent.map((s) => s.id)
  console.log('Sessioni MERCATO_RICORRENTE da eliminare:', JSON.stringify(recurrent))

  // Ordine FK-safe: prima tutto ciò che referenzia marketSessionId, poi le sessioni.
  const trades = await prisma.tradeOffer.deleteMany({ where: { marketSessionId: { in: ids } } })
  console.log('Deleted TradeOffers:', trades.count)

  // Movimenti: alcuni hanno auctionId → cancellare aste della sessione prima, ma le aste
  // ricorrenti sono rare in OFFERTE_PRE_RINNOVO; cancello movimenti per sessione direttamente.
  const movements = await prisma.playerMovement.deleteMany({ where: { marketSessionId: { in: ids } } })
  console.log('Deleted PlayerMovements (recurrent):', movements.count)

  const history = await prisma.contractHistory.deleteMany({ where: { marketSessionId: { in: ids } } })
  console.log('Deleted ContractHistory (recurrent):', history.count)

  const snapshots = await prisma.managerSessionSnapshot.deleteMany({ where: { marketSessionId: { in: ids } } })
  console.log('Deleted ManagerSessionSnapshots (recurrent):', snapshots.count)

  const consolidations = await prisma.contractConsolidation.deleteMany({ where: { sessionId: { in: ids } } }).catch(() => ({ count: 0 }))
  console.log('Deleted ContractConsolidations (recurrent):', consolidations.count)

  const indemnities = await prisma.indemnityDecision.deleteMany({ where: { sessionId: { in: ids } } }).catch(() => ({ count: 0 }))
  console.log('Deleted IndemnityDecisions (recurrent):', indemnities.count)

  const objectives = await prisma.auctionObjective.deleteMany({ where: { sessionId: { in: ids } } }).catch(() => ({ count: 0 }))
  console.log('Deleted AuctionObjectives (recurrent):', objectives.count)

  const drafts = await prisma.draftContract.deleteMany({ where: { sessionId: { in: ids } } }).catch(() => ({ count: 0 }))
  console.log('Deleted DraftContracts (recurrent):', drafts.count)

  // Aste eventualmente create nella fase ricorrente (svincolati/rubata): cancellare dipendenti.
  const recurrentAuctions = await prisma.auction.findMany({ where: { sessionId: { in: ids } }, select: { id: true } }).catch(() => [] as { id: string }[])
  if (recurrentAuctions.length > 0) {
    const aIds = recurrentAuctions.map((a) => a.id)
    await prisma.auctionAppeal.deleteMany({ where: { auctionId: { in: aIds } } })
    await prisma.auctionAcknowledgment.deleteMany({ where: { auctionId: { in: aIds } } })
    await prisma.auctionBid.deleteMany({ where: { auctionId: { in: aIds } } })
    await prisma.auction.deleteMany({ where: { id: { in: aIds } } })
    console.log('Deleted recurrent auctions:', aIds.length)
  }

  const sessions = await prisma.marketSession.deleteMany({ where: { id: { in: ids } } })
  console.log('Deleted MarketSessions (recurrent):', sessions.count)

  const remaining = await prisma.marketSession.findMany({ where: { leagueId: LEAGUE_ID }, select: { type: true, status: true } })
  console.log('Sessioni rimaste nella lega:', JSON.stringify(remaining))
}
main().catch(console.error).finally(() => prisma.$disconnect())
