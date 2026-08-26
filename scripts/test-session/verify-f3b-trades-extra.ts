/**
 * VERIFICA AUTOMATICA F3b — estensioni a verify-f3-trades.ts, sulla stessa sessione ACTIVE
 * OFFERTE_PRE_RINNOVO della "Lega test E2E". Copre scenari NON coperti da verify-f3-trades.ts:
 *
 *  T1: Monte Ingaggi / Bilancio dopo uno scambio — verifica che LeagueMember.totalSalaries
 *      (il monte ingaggi mostrato) NON cambi subito dopo lo scambio, restando fermo fino al
 *      prossimo consolidamento Fase 3 Contratti (Bibbia MERCATO-RICORRENTE.md §3.6-3.8), pur
 *      confermando che il contratto è REALMENTE trasferito (la somma live sui contratti cambia).
 *  T2: Annulla offerta (cancelTradeOffer) — round-trip completo dal mittente.
 *  T3: Controfferta fino in fondo — create → counterOffer → accept della controfferta →
 *      trasferimento nella direzione corretta (verify-f3-trades.ts S4 si ferma alla creazione).
 *  T4: Offerta scaduta — expiresAt forzato nel passato, accept deve fallire e marcare EXPIRED.
 *  T5: Gate di fase lato backend — createTradeOffer/acceptTrade fuori da
 *      OFFERTE_PRE_RINNOVO/OFFERTE_POST_ASTA_SVINCOLATI devono fallire server-side.
 *
 * NON distruttivo: stesso pattern snapshot/restore di verify-f3-trades.ts.
 *
 * Run: E2E_LEAGUE_ID=<id> bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f3b-trades-extra.ts
 */
import { PrismaClient, MemberStatus, RosterStatus } from '@prisma/client'
import {
  createTradeOffer, acceptTrade, counterOffer, cancelTradeOffer,
} from '../../src/services/trade.service'

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

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    include: { user: { select: { id: true, username: true } }, roster: { where: { status: RosterStatus.ACTIVE }, include: { contract: true }, orderBy: { id: 'asc' } } },
  })
  const byName: Record<string, typeof members[number]> = {}
  for (const m of members) byName[m.user.username] = m
  const cursor: Record<string, number> = {}
  function popEntry(username: string) {
    const m = byName[username]
    const i = cursor[username] ?? 0
    cursor[username] = i + 1
    return m.roster[i]
  }
  function pop(username: string): string { return popEntry(username).id }
  function memberId(u: string) { return byName[u].id }
  function userId(u: string) { return byName[u].user.id }

  const rosterSnap = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID } },
    select: { id: true, leagueMemberId: true, acquisitionType: true },
  })
  const budgetSnap = members.map((m) => ({ id: m.id, currentBudget: m.currentBudget }))
  console.log(`Snapshot: ${rosterSnap.length} rose, ${budgetSnap.length} budget. Sessione ${session.id}.\n`)

  try {
    // ===== T1: MONTE INGAGGI / BILANCIO DOPO SCAMBIO =====
    console.log('[T1] Monte Ingaggi/Bilancio dopo scambio (Emmanuele ⇄ Marcolino, no crediti)')
    const emmEntry = popEntry('Emmanuele')
    const marEntry = popEntry('Marcolino')
    const emmSalary = emmEntry.contract?.salary ?? 0
    const marSalary = marEntry.contract?.salary ?? 0
    console.log(`  Emmanuele cede giocatore sal=${emmSalary}, riceve giocatore sal=${marSalary}`)

    // "Monte ingaggi mostrato" = LeagueMember.totalSalaries (fissato), NON la somma live dei
    // contratti — è esattamente il campo che il fix introduce per rispettare la Bibbia.
    const totalSalariesOf = async (username: string) => (await prisma.leagueMember.findUnique({ where: { id: memberId(username) } }))!.totalSalaries
    const liveContractSalaryOf = async (username: string) => {
      const roster = await prisma.playerRoster.findMany({ where: { leagueMemberId: memberId(username), status: 'ACTIVE' }, include: { contract: true } })
      return roster.reduce((s, r) => s + (r.contract?.salary ?? 0), 0)
    }
    const budgetOf = async (username: string) => (await prisma.leagueMember.findUnique({ where: { id: memberId(username) } }))!.currentBudget

    const emmTsBefore = await totalSalariesOf('Emmanuele')
    const marTsBefore = await totalSalariesOf('Marcolino')
    const emmLiveBefore = await liveContractSalaryOf('Emmanuele')
    const marLiveBefore = await liveContractSalaryOf('Marcolino')
    const emmBudgetBefore = await budgetOf('Emmanuele')
    const marBudgetBefore = await budgetOf('Marcolino')

    const rT1 = await createTradeOffer(LEAGUE_ID!, userId('Emmanuele'), memberId('Marcolino'), [emmEntry.id], [marEntry.id], 0, 0, 'test T1')
    check(rT1.success === true, 'offerta T1 creata')
    const tT1 = rT1.data as { id: string }
    const accT1 = await acceptTrade(tT1.id, userId('Marcolino'))
    check(accT1.success === true, 'accettazione T1 eseguita')

    const emmTsAfter = await totalSalariesOf('Emmanuele')
    const marTsAfter = await totalSalariesOf('Marcolino')
    const emmLiveAfter = await liveContractSalaryOf('Emmanuele')
    const marLiveAfter = await liveContractSalaryOf('Marcolino')
    const emmBudgetAfter = await budgetOf('Emmanuele')
    const marBudgetAfter = await budgetOf('Marcolino')

    console.log(`  Emmanuele: budget ${emmBudgetBefore}→${emmBudgetAfter} | totalSalaries(fissato) ${emmTsBefore}→${emmTsAfter} | live(contratti reali) ${emmLiveBefore}→${emmLiveAfter}`)
    console.log(`  Marcolino: budget ${marBudgetBefore}→${marBudgetAfter} | totalSalaries(fissato) ${marTsBefore}→${marTsAfter} | live(contratti reali) ${marLiveBefore}→${marLiveAfter}`)

    check(emmBudgetAfter === emmBudgetBefore && marBudgetAfter === marBudgetBefore, 'budget invariato (nessun credito scambiato)')
    check(emmTsAfter === emmTsBefore && marTsAfter === marTsBefore, 'totalSalaries (monte ingaggi mostrato) NON cambia subito dopo lo scambio — fix Bibbia §3.6-3.8')
    check(emmLiveAfter !== emmLiveBefore && marLiveAfter !== marLiveBefore, 'il contratto è comunque REALMENTE trasferito (somma live sui contratti cambia) — la staleness di totalSalaries è voluta, non un bug di trasferimento')

    // ===== T2: ANNULLA OFFERTA =====
    console.log('\n[T2] Annulla offerta (Diego→Emiliano, Diego annulla)')
    const diegoEntry = pop('Diego'), emilianoEntry = pop('Emiliano')
    const rT2 = await createTradeOffer(LEAGUE_ID!, userId('Diego'), memberId('Emiliano'), [diegoEntry], [emilianoEntry], 0, 0, 'test T2')
    check(rT2.success === true, 'offerta T2 creata')
    const tT2 = rT2.data as { id: string }
    const cancelWrong = await cancelTradeOffer(tT2.id, userId('Emiliano'))
    check(cancelWrong.success === false, 'solo il mittente può annullare (destinatario → negato)')
    const cancelOk = await cancelTradeOffer(tT2.id, userId('Diego'))
    check(cancelOk.success === true, 'annullamento eseguito dal mittente')
    const tT2after = await prisma.tradeOffer.findUnique({ where: { id: tT2.id } })
    check(tT2after?.status === 'CANCELLED', 'stato → CANCELLED')
    const diegoRosterAfter = await prisma.playerRoster.findUnique({ where: { id: diegoEntry } })
    check(diegoRosterAfter?.leagueMemberId === memberId('Diego'), 'nessun trasferimento avvenuto (giocatore resta a Diego)')

    // ===== T3: CONTROFFERTA FINO IN FONDO =====
    console.log('\n[T3] Controfferta fino in fondo (Michele→Mirko, Mirko controfferta, Michele accetta)')
    const michEntry = pop('Michele'), mirkoEntry = pop('Mirko')
    const rT3 = await createTradeOffer(LEAGUE_ID!, userId('Michele'), memberId('Mirko'), [michEntry], [mirkoEntry], 0, 0, 'test T3')
    const tT3 = rT3.data as { id: string }
    const michEntry2 = pop('Michele'), mirkoEntry2 = pop('Mirko')
    const counterT3 = await counterOffer(tT3.id, userId('Mirko'), [mirkoEntry2], [michEntry2], 0, 0, 'contro T3')
    check(counterT3.success === true, 'controfferta creata')
    const tcT3 = counterT3.data as { id: string; senderId: string; receiverId: string }
    check(tcT3.senderId === userId('Mirko') && tcT3.receiverId === userId('Michele'), 'controfferta con from/to invertiti')
    const accT3 = await acceptTrade(tcT3.id, userId('Michele'))
    check(accT3.success === true, 'controfferta accettata da Michele')
    const mirkoEntry2After = await prisma.playerRoster.findUnique({ where: { id: mirkoEntry2 } })
    const michEntry2After = await prisma.playerRoster.findUnique({ where: { id: michEntry2 } })
    check(mirkoEntry2After?.leagueMemberId === memberId('Michele'), 'giocatore offerto nella controfferta (di Mirko) trasferito a Michele')
    check(michEntry2After?.leagueMemberId === memberId('Mirko'), 'giocatore richiesto nella controfferta (di Michele) trasferito a Mirko')

    // ===== T4: OFFERTA SCADUTA =====
    console.log('\n[T4] Offerta scaduta (Marco→Pietro, expiresAt forzato nel passato)')
    const marcoEntry = pop('Marco'), pietroEntry = pop('Pietro')
    const rT4 = await createTradeOffer(LEAGUE_ID!, userId('Marco'), memberId('Pietro'), [marcoEntry], [pietroEntry], 0, 0, 'test T4')
    const tT4 = rT4.data as { id: string }
    await prisma.tradeOffer.update({ where: { id: tT4.id }, data: { expiresAt: new Date(Date.now() - 60_000) } })
    const accT4 = await acceptTrade(tT4.id, userId('Pietro'))
    check(accT4.success === false, 'accettazione di offerta scaduta → rifiutata')
    const tT4after = await prisma.tradeOffer.findUnique({ where: { id: tT4.id } })
    check(tT4after?.status === 'EXPIRED', 'stato → EXPIRED')
    const marcoRosterAfter = await prisma.playerRoster.findUnique({ where: { id: marcoEntry } })
    check(marcoRosterAfter?.leagueMemberId === memberId('Marco'), 'nessun trasferimento avvenuto (giocatore resta a Marco)')

    // ===== T5: GATE DI FASE LATO BACKEND =====
    console.log('\n[T5] Gate di fase lato backend (fuori da OFFERTE_PRE_RINNOVO/OFFERTE_POST_ASTA_SVINCOLATI)')
    // offerta valida creata PRIMA di cambiare fase, per testare anche l'accept fuori fase
    const emilEntry2 = pop('Emiliano'), diegoEntry2 = pop('Diego')
    const rT5pre = await createTradeOffer(LEAGUE_ID!, userId('Emiliano'), memberId('Diego'), [emilEntry2], [diegoEntry2], 0, 0, 'test T5 pre')
    check(rT5pre.success === true, 'offerta creata mentre in fase corretta (baseline)')
    const tT5 = rT5pre.data as { id: string }

    await prisma.marketSession.update({ where: { id: session.id }, data: { currentPhase: 'PREMI' } })
    const rT5createOutside = await createTradeOffer(LEAGUE_ID!, userId('Emiliano'), memberId('Diego'), [pop('Emiliano')], [pop('Diego')], 0, 0, 'test T5 outside')
    check(rT5createOutside.success === false, 'createTradeOffer fuori fase → rifiutato server-side')
    const rT5acceptOutside = await acceptTrade(tT5.id, userId('Diego'))
    check(rT5acceptOutside.success === false, 'acceptTrade fuori fase → rifiutato server-side')
    await prisma.marketSession.update({ where: { id: session.id }, data: { currentPhase: 'OFFERTE_PRE_RINNOVO' } })
    const sessionRestored = await prisma.marketSession.findUnique({ where: { id: session.id } })
    check(sessionRestored?.currentPhase === 'OFFERTE_PRE_RINNOVO', 'fase ripristinata a OFFERTE_PRE_RINNOVO')

  } finally {
    console.log('\n=== RIPRISTINO STATO ===')
    const delMov = await prisma.playerMovement.deleteMany({ where: { marketSessionId: session.id, movementType: 'TRADE' } })
    const delTrades = await prisma.tradeOffer.deleteMany({ where: { marketSessionId: session.id } })
    console.log(`Cancellati ${delMov.count} movimenti TRADE, ${delTrades.count} TradeOffer.`)
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
      const res = await prisma.leagueMember.updateMany({ where: { id: b.id, NOT: { currentBudget: b.currentBudget } }, data: { currentBudget: b.currentBudget } })
      budgetRestored += res.count
    }
    const sessionCheck = await prisma.marketSession.findUnique({ where: { id: session.id } })
    if (sessionCheck?.currentPhase !== 'OFFERTE_PRE_RINNOVO') {
      await prisma.marketSession.update({ where: { id: session.id }, data: { currentPhase: 'OFFERTE_PRE_RINNOVO' } })
      console.log('Fase ri-ripristinata a OFFERTE_PRE_RINNOVO (era rimasta alterata).')
    }
    console.log(`Ripristinati: ${rosterRestored} rose, ${contractFixed} contratti, ${budgetRestored} budget.`)
  }

  console.log(`\n===== RISULTATO F3b: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach((f) => console.log('  ✗ ' + f)) }
}
main().catch(console.error).finally(() => prisma.$disconnect())
