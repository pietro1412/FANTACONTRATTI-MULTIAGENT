/**
 * VERIFICA T5-F — un giocatore scambiato in Fase 1 (OFFERTE_PRE_RINNOVO) dello stesso ciclo di
 * mercato ricorrente DEVE essere rinnovabile nella Fase 3 (CONTRATTI) di quel ciclo (regola
 * commentata in contract.service.ts:631-676, non scritta esplicitamente nella Bibbia testuale).
 *
 * Percorso: scambio in OFFERTE_PRE_RINNOVO → avanza PREMI (init+finalize) → avanza CONTRATTI →
 * renewContract sul contratto appena arrivato via scambio → deve avere successo.
 *
 * NON distruttivo: ripristina rose/contratti/budget/fase/prize-config a fine esecuzione.
 *
 * Run: E2E_LEAGUE_ID=<id> bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f3c-trade-renewal.ts
 */
import { PrismaClient, MemberStatus, RosterStatus } from '@prisma/client'
import { createTradeOffer, acceptTrade } from '../../src/services/trade.service'
import { setMarketPhase } from '../../src/services/auction.service'
import { initializePrizePhase, finalizePrizePhase } from '../../src/services/prize-phase.service'
import { renewContract, consolidateContracts } from '../../src/services/contract.service'

const prisma = new PrismaClient()
const LEAGUE_ID = process.env.E2E_LEAGUE_ID
if (!LEAGUE_ID) { console.log('Serve E2E_LEAGUE_ID'); process.exit(1) }

let pass = 0, fail = 0
const fails: string[] = []
function check(cond: boolean, label: string) { if (cond) { pass++; console.log('  ✓ ' + label) } else { fail++; fails.push(label); console.log('  ✗ ' + label) } }

async function main() {
  const session = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
  if (!session || session.currentPhase !== 'OFFERTE_PRE_RINNOVO') {
    console.log('ERRORE: nessuna sessione ACTIVE in OFFERTE_PRE_RINNOVO. Fase:', session?.currentPhase)
    return
  }

  const admin = await prisma.user.findUnique({ where: { email: 'pietro@test.it' } })
  if (!admin) { console.log('❌ pietro@test.it non trovato'); return }

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    include: { user: { select: { id: true, username: true } }, roster: { where: { status: RosterStatus.ACTIVE }, orderBy: { id: 'asc' } } },
  })
  const byName: Record<string, typeof members[number]> = {}
  for (const m of members) byName[m.user.username] = m
  function memberId(u: string) { return byName[u].id }
  function userId(u: string) { return byName[u].user.id }

  const rosterSnap = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID } },
    select: { id: true, leagueMemberId: true, acquisitionType: true },
  })
  const budgetSnap = members.map((m) => ({ id: m.id, currentBudget: m.currentBudget, totalSalaries: m.totalSalaries, preConsolidationBudget: m.preConsolidationBudget }))
  console.log(`Snapshot: ${rosterSnap.length} rose, ${budgetSnap.length} budget. Sessione ${session.id}.\n`)

  let touchedContractId: string | null = null
  let originalContract: { salary: number; duration: number; rescissionClause: number | null; renewalHistory: unknown } | null = null

  try {
    // ===== Scambio in Fase 1 =====
    console.log('[Setup] Scambio in OFFERTE_PRE_RINNOVO (Marco → Marcolino)')
    const marcoEntry = byName['Marco'].roster[0]
    const marcolinoEntry = byName['Marcolino'].roster[0]
    const rTrade = await createTradeOffer(LEAGUE_ID!, userId('Marco'), memberId('Marcolino'), [marcoEntry.id], [marcolinoEntry.id], 0, 0, 'test T5-F')
    check(rTrade.success === true, 'scambio creato')
    const tTrade = rTrade.data as { id: string }
    const accTrade = await acceptTrade(tTrade.id, userId('Marcolino'))
    check(accTrade.success === true, 'scambio accettato')

    const tradedRoster = await prisma.playerRoster.findUnique({ where: { id: marcoEntry.id }, include: { contract: true } })
    check(tradedRoster?.leagueMemberId === memberId('Marcolino'), 'giocatore ora in rosa a Marcolino')
    check(tradedRoster?.acquisitionType === 'TRADE', 'acquisitionType = TRADE')
    const contract = tradedRoster?.contract
    check(!!contract, 'il giocatore scambiato ha un contratto')
    if (!contract) throw new Error('contratto mancante dopo scambio — impossibile proseguire')
    touchedContractId = contract.id
    originalContract = { salary: contract.salary, duration: contract.duration, rescissionClause: contract.rescissionClause, renewalHistory: contract.renewalHistory }

    // ===== Avanza a PREMI =====
    console.log('\n[Fase] OFFERTE_PRE_RINNOVO → PREMI')
    const rPhase1 = await setMarketPhase(session.id, admin.id, 'PREMI')
    check(rPhase1.success === true, 'avanzamento a PREMI riuscito')

    const rInit = await initializePrizePhase(session.id, admin.id)
    check(rInit.success === true, 'fase premi inizializzata')
    const rFinalize = await finalizePrizePhase(session.id, admin.id)
    check(rFinalize.success === true, 'fase premi finalizzata')

    // ===== Avanza a CONTRATTI =====
    console.log('\n[Fase] PREMI → CONTRATTI')
    const rPhase2 = await setMarketPhase(session.id, admin.id, 'CONTRATTI')
    check(rPhase2.success === true, 'avanzamento a CONTRATTI riuscito')

    // ===== Rinnovo del giocatore scambiato in Fase1 di QUESTO ciclo =====
    console.log('\n[T5-F] Rinnovo giocatore scambiato in Fase1 dello stesso ciclo (deve riuscire)')
    const newSalary = contract.salary + 1
    const rRenew = await renewContract(contract.id, userId('Marcolino'), newSalary, contract.duration)
    check(rRenew.success === true, `rinnovo riuscito (${contract.salary}→${newSalary}, blocco T5-F non applicato per scambio Fase1 stesso ciclo)${rRenew.success ? '' : ' — errore: ' + rRenew.message}`)

    // ===== Consolidamento: totalSalaries deve riflettere il rinnovo appena fatto =====
    console.log('\n[Consolidamento] totalSalaries dopo il consolidamento di Marcolino')
    const marcolinoTsBefore = (await prisma.leagueMember.findUnique({ where: { id: memberId('Marcolino') } }))!.totalSalaries
    const rConsolidate = await consolidateContracts(LEAGUE_ID!, userId('Marcolino'))
    check(rConsolidate.success === true, `consolidamento Marcolino riuscito${rConsolidate.success ? '' : ' — errore: ' + rConsolidate.message}`)
    const marcolinoRosterAfter = await prisma.playerRoster.findMany({ where: { leagueMemberId: memberId('Marcolino'), status: 'ACTIVE' }, include: { contract: true } })
    const expectedTotalSalaries = marcolinoRosterAfter.reduce((s, r) => s + (r.contract?.salary ?? 0), 0)
    const marcolinoTsAfter = (await prisma.leagueMember.findUnique({ where: { id: memberId('Marcolino') } }))!.totalSalaries
    check(marcolinoTsAfter === expectedTotalSalaries, `totalSalaries dopo consolidamento (${marcolinoTsBefore}→${marcolinoTsAfter}) = somma contratti attuali (${expectedTotalSalaries}), include il rinnovo`)

    console.log('\n[Nota] Caso negativo (scambiato in Fase 6 di un ciclo PRECEDENTE → non rinnovabile fino al ciclo successivo)')
    console.log('  non ri-testato end-to-end in questo giro (richiederebbe un secondo ciclo di mercato completo).')
    console.log('  Verificato a livello di codice: contract.service.ts:648-676 confronta il marketSessionId')
    console.log('  dell\'ultimo movimento TRADE verso il proprietario attuale con la sessione CONTRATTI corrente:')
    console.log('  se diverso (scambio avvenuto in un ciclo precedente, es. OFFERTE_POST_ASTA_SVINCOLATI), rinnovo bloccato.')

  } finally {
    console.log('\n=== RIPRISTINO STATO ===')

    if (touchedContractId && originalContract) {
      await prisma.playerContract.update({
        where: { id: touchedContractId },
        data: {
          salary: originalContract.salary,
          duration: originalContract.duration,
          rescissionClause: originalContract.rescissionClause,
          renewalHistory: originalContract.renewalHistory as never,
        },
      })
      console.log('Contratto rinnovato ripristinato ai valori originali.')
    }

    const delMov = await prisma.playerMovement.deleteMany({ where: { marketSessionId: session.id, movementType: 'TRADE' } })
    // renewContract registra anche un movimento CONTRACT_RENEW (contract.service.ts:769) — va
    // ripulito qui, non solo TRADE, altrimenti resta un residuo visibile in Storico.
    const delRenewMov = touchedContractId
      ? await prisma.playerMovement.deleteMany({ where: { marketSessionId: session.id, movementType: 'CONTRACT_RENEW' } })
      : { count: 0 }
    const delTrades = await prisma.tradeOffer.deleteMany({ where: { marketSessionId: session.id } })
    console.log(`Cancellati ${delMov.count} movimenti TRADE, ${delRenewMov.count} movimenti CONTRACT_RENEW, ${delTrades.count} TradeOffer.`)

    let rosterRestored = 0
    for (const r of rosterSnap) {
      const res = await prisma.playerRoster.updateMany({
        where: { id: r.id, NOT: { leagueMemberId: r.leagueMemberId, acquisitionType: r.acquisitionType } },
        data: { leagueMemberId: r.leagueMemberId, acquisitionType: r.acquisitionType },
      })
      rosterRestored += res.count
    }
    const allRosters = await prisma.playerRoster.findMany({ where: { leagueMember: { leagueId: LEAGUE_ID } }, select: { id: true, leagueMemberId: true } })
    let contractFixed = 0
    for (const r of allRosters) {
      const res = await prisma.playerContract.updateMany({ where: { rosterId: r.id, NOT: { leagueMemberId: r.leagueMemberId } }, data: { leagueMemberId: r.leagueMemberId } })
      contractFixed += res.count
    }
    let budgetRestored = 0
    for (const b of budgetSnap) {
      const res = await prisma.leagueMember.updateMany({
        where: { id: b.id },
        data: { currentBudget: b.currentBudget, totalSalaries: b.totalSalaries, preConsolidationBudget: b.preConsolidationBudget },
      })
      budgetRestored += res.count
    }
    console.log(`Ripristinati: ${rosterRestored} rose, ${contractFixed} contratti, ${budgetRestored} budget/totalSalaries.`)

    // Rimuove il record di consolidamento creato per Marcolino nel test (altrimenti la sessione
    // CONTRATTI risulterebbe già consolidata per lui in un run futuro).
    const delConsolidation = await prisma.contractConsolidation.deleteMany({ where: { sessionId: session.id } })
    console.log(`Cancellati ${delConsolidation.count} ContractConsolidation.`)

    // Rimuove config premi creata per il test e riporta la sessione a OFFERTE_PRE_RINNOVO
    const prizeCategories = await prisma.prizeCategory.findMany({ where: { marketSessionId: session.id }, select: { id: true } })
    await prisma.sessionPrize.deleteMany({ where: { prizeCategoryId: { in: prizeCategories.map(c => c.id) } } })
    await prisma.prizeCategory.deleteMany({ where: { marketSessionId: session.id } })
    await prisma.prizePhaseConfig.deleteMany({ where: { marketSessionId: session.id } })
    console.log('Config premi di test rimossa.')

    await prisma.marketSession.update({
      where: { id: session.id },
      data: { currentPhase: 'OFFERTE_PRE_RINNOVO' },
    })
    console.log('Sessione ripristinata a OFFERTE_PRE_RINNOVO.')
  }

  console.log(`\n===== RISULTATO F3c: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach((f) => console.log('  ✗ ' + f)) }
}
main().catch(console.error).finally(() => prisma.$disconnect())
