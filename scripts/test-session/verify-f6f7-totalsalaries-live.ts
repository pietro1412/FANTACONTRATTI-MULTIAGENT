/**
 * VERIFICA AUTOMATICA F6/F7 — totalSalaries (monte ingaggi fissato) deve restare LIVE per
 * Rubata e Svincolati, a differenza degli Scambi (vedi verify-f3b-trades-extra.ts T1).
 * verify-f6-rubata.ts/verify-f7-svincolati.ts dichiarano esplicitamente di NON coprire il
 * flusso reale di vittoria/trasferimento asta — questo script lo fa, chiamando direttamente
 * closeRubataAuction/closeSvincolatiAuction su un'asta creata ad-hoc (bypass nomination/bid
 * flow, come gli altri script test-session).
 *
 * NON distruttivo: ripristina rose/contratti/budget/totalSalaries e cancella asta+bid+movimenti
 * creati per il test.
 *
 * Run: E2E_LEAGUE_ID=<id> bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f6f7-totalsalaries-live.ts
 */
import { PrismaClient, MemberStatus, RosterStatus } from '@prisma/client'
import { closeRubataAuction } from '../../src/services/rubata.service'
import { closeSvincolatiAuction } from '../../src/services/svincolati.service'

const prisma = new PrismaClient()
const LEAGUE_ID = process.env.E2E_LEAGUE_ID || 'cmq3eqxpf06p7xt0cjcjil3qe'

let pass = 0, fail = 0
function check(cond: boolean, label: string) { if (cond) { pass++; console.log('  ✓ ' + label) } else { fail++; console.log('  ✗ ' + label) } }

async function main() {
  const session = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
  if (!session) { console.log('nessuna sessione ACTIVE'); return }
  const admin = await prisma.user.findUnique({ where: { email: 'pietro@test.it' } })
  if (!admin) { console.log('admin non trovato'); return }

  const members = await prisma.leagueMember.findMany({ where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE }, include: { user: true } })
  const byName: Record<string, typeof members[number]> = {}
  for (const m of members) byName[m.user.username] = m

  // ===== RUBATA =====
  console.log('[RUBATA] closeRubataAuction — totalSalaries deve muoversi subito (venditore -, vincitore +)')
  const seller = byName['Emiliano']
  const buyer = byName['Diego']
  const sellerEntry = await prisma.playerRoster.findFirst({ where: { leagueMemberId: seller.id, status: RosterStatus.ACTIVE }, include: { contract: true } })
  if (!sellerEntry?.contract) { console.log('nessun contratto trovato per il venditore'); return }
  const contractSalary = sellerEntry.contract.salary
  const offerta = 5
  const price = offerta + contractSalary

  const sellerTsBefore = seller.totalSalaries
  const buyerTsBefore = buyer.totalSalaries
  const sellerBudgetBefore = seller.currentBudget
  const buyerBudgetBefore = buyer.currentBudget

  const auction = await prisma.auction.create({
    data: {
      leagueId: LEAGUE_ID, marketSessionId: session.id, playerId: sellerEntry.playerId,
      type: 'RUBATA', currentPrice: price, sellerId: seller.id, status: 'ACTIVE',
    },
  })
  await prisma.auctionBid.create({
    data: { auctionId: auction.id, bidderId: buyer.id, userId: buyer.userId, amount: price, isWinning: true },
  })

  const rClose = await closeRubataAuction(auction.id, admin.id)
  check(rClose.success === true, `closeRubataAuction riuscito${rClose.success ? '' : ' — ' + rClose.message}`)

  const sellerAfter = await prisma.leagueMember.findUnique({ where: { id: seller.id } })
  const buyerAfter = await prisma.leagueMember.findUnique({ where: { id: buyer.id } })
  console.log(`  Venditore (${seller.user.username}): totalSalaries ${sellerTsBefore}→${sellerAfter!.totalSalaries} (atteso ${sellerTsBefore - contractSalary})`)
  console.log(`  Vincitore (${buyer.user.username}): totalSalaries ${buyerTsBefore}→${buyerAfter!.totalSalaries} (atteso ${buyerTsBefore + contractSalary})`)
  check(sellerAfter!.totalSalaries === sellerTsBefore - contractSalary, 'totalSalaries venditore decrementato subito del salary ceduto')
  check(buyerAfter!.totalSalaries === buyerTsBefore + contractSalary, 'totalSalaries vincitore incrementato subito del salary acquisito')
  check(sellerAfter!.currentBudget === sellerBudgetBefore + offerta, 'budget venditore + offerta')
  check(buyerAfter!.currentBudget === buyerBudgetBefore - offerta, 'budget vincitore - offerta')

  // Restore rubata
  await prisma.playerRoster.update({ where: { id: sellerEntry.id }, data: { leagueMemberId: seller.id, acquisitionType: sellerEntry.acquisitionType } })
  await prisma.playerContract.update({ where: { id: sellerEntry.contract.id }, data: { leagueMemberId: seller.id } })
  await prisma.leagueMember.update({ where: { id: seller.id }, data: { totalSalaries: sellerTsBefore, currentBudget: sellerBudgetBefore } })
  await prisma.leagueMember.update({ where: { id: buyer.id }, data: { totalSalaries: buyerTsBefore, currentBudget: buyerBudgetBefore } })
  await prisma.auctionBid.deleteMany({ where: { auctionId: auction.id } })
  await prisma.playerMovement.deleteMany({ where: { auctionId: auction.id } })
  await prisma.auction.delete({ where: { id: auction.id } })
  console.log('  (rubata ripristinata)')

  // ===== SVINCOLATI =====
  console.log('\n[SVINCOLATI] closeSvincolatiAuction — totalSalaries del vincitore deve incrementare subito')
  const freeAgent = await prisma.serieAPlayer.findFirst({
    where: { listStatus: 'IN_LIST', rosters: { none: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' } } },
  })
  if (!freeAgent) { console.log('nessun free agent disponibile'); return }
  const svWinner = byName['Marco']
  const svPrice = 20
  const svWinnerTsBefore = (await prisma.leagueMember.findUnique({ where: { id: svWinner.id } }))!.totalSalaries
  const svWinnerBudgetBefore = (await prisma.leagueMember.findUnique({ where: { id: svWinner.id } }))!.currentBudget

  const svAuction = await prisma.auction.create({
    data: { leagueId: LEAGUE_ID, marketSessionId: session.id, playerId: freeAgent.id, type: 'FREE_BID', currentPrice: svPrice, status: 'ACTIVE' },
  })
  await prisma.auctionBid.create({
    data: { auctionId: svAuction.id, bidderId: svWinner.id, userId: svWinner.userId, amount: svPrice, isWinning: true },
  })

  const rCloseSv = await closeSvincolatiAuction(svAuction.id, admin.id)
  check(rCloseSv.success === true, `closeSvincolatiAuction riuscito${rCloseSv.success ? '' : ' — ' + rCloseSv.message}`)

  const newRoster = await prisma.playerRoster.findFirst({ where: { leagueMemberId: svWinner.id, playerId: freeAgent.id, status: 'ACTIVE' }, include: { contract: true } })
  const svWinnerAfter = await prisma.leagueMember.findUnique({ where: { id: svWinner.id } })
  const newSalary = newRoster?.contract?.salary ?? 0
  console.log(`  Vincitore (${svWinner.user.username}): totalSalaries ${svWinnerTsBefore}→${svWinnerAfter!.totalSalaries} (atteso ${svWinnerTsBefore + newSalary}, nuovo contratto salary=${newSalary})`)
  check(svWinnerAfter!.totalSalaries === svWinnerTsBefore + newSalary, 'totalSalaries vincitore incrementato subito del nuovo contratto')
  check(svWinnerAfter!.currentBudget === svWinnerBudgetBefore - svPrice, 'budget vincitore decrementato del prezzo asta')

  // Restore svincolati
  if (newRoster) {
    await prisma.playerContract.deleteMany({ where: { rosterId: newRoster.id } })
    await prisma.playerRoster.delete({ where: { id: newRoster.id } })
  }
  await prisma.leagueMember.update({ where: { id: svWinner.id }, data: { totalSalaries: svWinnerTsBefore, currentBudget: svWinnerBudgetBefore } })
  await prisma.auctionBid.deleteMany({ where: { auctionId: svAuction.id } })
  await prisma.playerMovement.deleteMany({ where: { auctionId: svAuction.id } })
  await prisma.auction.delete({ where: { id: svAuction.id } })
  console.log('  (svincolati ripristinato)')

  console.log(`\n===== RISULTATO: ${pass} PASS, ${fail} FAIL =====`)
}
main().catch(console.error).finally(() => prisma.$disconnect())
