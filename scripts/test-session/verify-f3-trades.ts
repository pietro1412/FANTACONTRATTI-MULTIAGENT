/**
 * VERIFICA AUTOMATICA F3 — backend scambi (fase OFFERTE_PRE_RINNOVO).
 * Esercita le funzioni di produzione di trade.service direttamente sulla sessione ricorrente
 * ATTIVA della "Lega test E2E" e asserisce la correttezza di: creazione+validazioni, rifiuto,
 * controfferta, accettazione (trasferimento giocatori/contratti/budget + movimenti), auto-
 * invalidazione offerte conflittuali, vincolo anti-reverse, indicatore trattative in corso.
 *
 * NON distruttivo per la sessione: prima fa SNAPSHOT di tutte le rose (owner+acquisitionType)
 * e di tutti i budget della lega; alla fine RIPRISTINA lo snapshot e cancella ogni TradeOffer +
 * movimento TRADE creato, lasciando la lega pulita in OFFERTE_PRE_RINNOVO per il test UI.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f3-trades.ts
 */
import { PrismaClient, MemberStatus, RosterStatus } from '@prisma/client'
import {
  createTradeOffer, acceptTrade, rejectTrade, counterOffer, getOngoingTradesIndicator,
} from '../../src/services/trade.service'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'

let pass = 0, fail = 0
const fails: string[] = []
function check(cond: boolean, label: string) { if (cond) { pass++; console.log('  ✓ ' + label) } else { fail++; fails.push(label); console.log('  ✗ ' + label) } }

async function main() {
  const session = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
  if (!session || session.currentPhase !== 'OFFERTE_PRE_RINNOVO') {
    console.log('ERRORE: nessuna sessione ACTIVE in OFFERTE_PRE_RINNOVO. Avvia prima il Mercato Ricorrente. Fase:', session?.currentPhase)
    return
  }

  // Membri per username → ids + budget
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    include: { user: { select: { id: true, username: true } }, roster: { where: { status: RosterStatus.ACTIVE }, select: { id: true, playerId: true } } },
  })
  const byName: Record<string, typeof members[number]> = {}
  for (const m of members) byName[m.user.username] = m

  // Cursori per estrarre roster distinti per ogni manager
  const cursor: Record<string, number> = {}
  function pop(username: string): string {
    const m = byName[username]
    const i = cursor[username] ?? 0
    cursor[username] = i + 1
    return m.roster[i].id
  }
  function memberId(u: string) { return byName[u].id }
  function userId(u: string) { return byName[u].user.id }

  // ---------- SNAPSHOT ----------
  const rosterSnap = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID } },
    select: { id: true, leagueMemberId: true, acquisitionType: true },
  })
  const budgetSnap = members.map((m) => ({ id: m.id, currentBudget: m.currentBudget }))
  console.log(`Snapshot: ${rosterSnap.length} rose, ${budgetSnap.length} budget. Sessione ${session.id}.\n`)

  try {
    // ===== S1: CREAZIONE VALIDA =====
    console.log('[S1] Creazione offerta valida (Pietro→Michele)')
    const pBudget0 = byName['Pietro'].currentBudget
    const offP1 = pop('Pietro'), reqM1 = pop('Michele')
    const r1 = await createTradeOffer(LEAGUE_ID, userId('Pietro'), memberId('Michele'), [offP1], [reqM1], 5, 0, 'test S1')
    check(r1.success === true, 'offerta valida creata')
    const t1 = r1.data as { id: string; status: string; expiresAt: Date; involvedPlayers: unknown }
    check(t1?.status === 'PENDING', 'stato PENDING')
    const hoursToExpiry = t1 ? (new Date(t1.expiresAt).getTime() - Date.now()) / 3.6e6 : 0
    check(hoursToExpiry > 23 && hoursToExpiry <= 24.1, `scadenza ~24h (${hoursToExpiry.toFixed(1)}h)`)
    check(Array.isArray(t1?.involvedPlayers) && (t1.involvedPlayers as string[]).length === 2, 'involvedPlayers = 2')

    // ===== S2: VALIDAZIONI NEGATIVE =====
    console.log('\n[S2] Validazioni negative')
    const notOwnedByPietro = byName['Michele'].roster[5].id // appartiene a Michele
    const rNeg1 = await createTradeOffer(LEAGUE_ID, userId('Pietro'), memberId('Michele'), [notOwnedByPietro], [], 0, 0)
    check(rNeg1.success === false, 'offerto non posseduto → rifiutato')
    const pietroOwned = byName['Pietro'].roster[10].id
    const rNeg2 = await createTradeOffer(LEAGUE_ID, userId('Pietro'), memberId('Michele'), [], [pietroOwned], 0, 0)
    check(rNeg2.success === false, 'richiesto non posseduto dal destinatario → rifiutato')
    const rNeg3 = await createTradeOffer(LEAGUE_ID, userId('Pietro'), memberId('Michele'), [], [], pBudget0 + 1000, 0)
    check(rNeg3.success === false, 'budget offerto > disponibile → rifiutato')
    const rNeg4 = await createTradeOffer(LEAGUE_ID, userId('Pietro'), memberId('Pietro'), [], [], 1, 0)
    check(rNeg4.success === false, 'offerta a se stessi → rifiutata')

    // ===== S3: RIFIUTO =====
    console.log('\n[S3] Rifiuto (Pietro→Mirko, Mirko rifiuta)')
    const r3 = await createTradeOffer(LEAGUE_ID, userId('Pietro'), memberId('Mirko'), [pop('Pietro')], [pop('Mirko')], 0, 0)
    const t3 = r3.data as { id: string }
    const rejWrong = await rejectTrade(t3.id, userId('Pietro')) // il mittente non può rifiutare
    check(rejWrong.success === false, 'solo il destinatario può rifiutare (mittente → negato)')
    const rej = await rejectTrade(t3.id, userId('Mirko'))
    check(rej.success === true, 'rifiuto eseguito dal destinatario')
    const t3after = await prisma.tradeOffer.findUnique({ where: { id: t3.id } })
    check(t3after?.status === 'REJECTED', 'stato → REJECTED')

    // ===== S4: CONTROFFERTA =====
    console.log('\n[S4] Controfferta (Pietro→Diego, Diego controfferta)')
    const r4 = await createTradeOffer(LEAGUE_ID, userId('Pietro'), memberId('Diego'), [pop('Pietro')], [pop('Diego')], 0, 0)
    const t4 = r4.data as { id: string }
    const counter = await counterOffer(t4.id, userId('Diego'), [pop('Diego')], [pop('Pietro')], 2, 0, 'contro S4')
    check(counter.success === true, 'controfferta creata')
    const t4after = await prisma.tradeOffer.findUnique({ where: { id: t4.id } })
    check(t4after?.status === 'COUNTERED', 'originale → COUNTERED')
    const tc = counter.data as { id: string; senderId: string; receiverId: string; status: string }
    check(tc?.status === 'PENDING' && tc.senderId === userId('Diego') && tc.receiverId === userId('Pietro'), 'controfferta PENDING con from/to invertiti')

    // ===== S5: ACCETTAZIONE CON TRASFERIMENTO =====
    console.log('\n[S5] Accettazione con trasferimento (Pietro→Marco)')
    const offP5 = pop('Pietro'), reqMarco5 = pop('Marco')
    const pBudgetPre = (await prisma.leagueMember.findUnique({ where: { id: memberId('Pietro') } }))!.currentBudget
    const marcoBudgetPre = (await prisma.leagueMember.findUnique({ where: { id: memberId('Marco') } }))!.currentBudget
    const r5 = await createTradeOffer(LEAGUE_ID, userId('Pietro'), memberId('Marco'), [offP5], [reqMarco5], 10, 3, 'test S5')
    const t5 = r5.data as { id: string }
    const acc = await acceptTrade(t5.id, userId('Marco'))
    check(acc.success === true, 'accettazione eseguita')
    const offP5after = await prisma.playerRoster.findUnique({ where: { id: offP5 } })
    const reqM5after = await prisma.playerRoster.findUnique({ where: { id: reqMarco5 } })
    check(offP5after?.leagueMemberId === memberId('Marco'), 'giocatore offerto trasferito a Marco')
    check(reqM5after?.leagueMemberId === memberId('Pietro'), 'giocatore richiesto trasferito a Pietro')
    check(offP5after?.acquisitionType === 'TRADE' && reqM5after?.acquisitionType === 'TRADE', 'acquisitionType = TRADE su entrambi')
    const contractMoved = await prisma.playerContract.findFirst({ where: { rosterId: offP5 } })
    check(contractMoved?.leagueMemberId === memberId('Marco'), 'contratto segue il giocatore')
    const pBudgetPost = (await prisma.leagueMember.findUnique({ where: { id: memberId('Pietro') } }))!.currentBudget
    const marcoBudgetPost = (await prisma.leagueMember.findUnique({ where: { id: memberId('Marco') } }))!.currentBudget
    check(pBudgetPost === pBudgetPre - 10 + 3, `budget Pietro ${pBudgetPre}→${pBudgetPost} (atteso -10+3)`)
    check(marcoBudgetPost === marcoBudgetPre + 10 - 3, `budget Marco ${marcoBudgetPre}→${marcoBudgetPost} (atteso +10-3)`)
    const tradeMovs = await prisma.playerMovement.count({ where: { tradeId: t5.id, movementType: 'TRADE' } })
    check(tradeMovs === 2, `2 movimenti TRADE registrati (trovati ${tradeMovs})`)

    // ===== S6: ANTI-REVERSE =====
    console.log('\n[S6] Anti-reverse (Marco→Pietro nella stessa sessione dopo accettato)')
    const rev = await createTradeOffer(LEAGUE_ID, userId('Marco'), memberId('Pietro'), [pop('Marco')], [pop('Pietro')], 0, 0)
    check(rev.success === false, 'scambio inverso nella stessa sessione → rifiutato')

    // ===== S7: AUTO-INVALIDAZIONE =====
    console.log('\n[S7] Auto-invalidazione offerte conflittuali')
    const sharedPlayer = pop('Emmanuele') // coinvolto in due offerte
    const rA = await createTradeOffer(LEAGUE_ID, userId('Emmanuele'), memberId('Diego'), [sharedPlayer], [pop('Diego')], 0, 0, 'S7-A')
    const rB = await createTradeOffer(LEAGUE_ID, userId('Emmanuele'), memberId('Marcolino'), [sharedPlayer], [pop('Marcolino')], 0, 0, 'S7-B')
    check(rA.success && rB.success, 'due offerte PENDING con giocatore condiviso create')
    check((rB.warnings?.length ?? 0) > 0, 'warning di sovrapposizione sulla seconda offerta')
    const tA = rA.data as { id: string }, tB = rB.data as { id: string }
    const accA = await acceptTrade(tA.id, userId('Diego'))
    check(accA.success === true, 'offerta A accettata')
    const tBafter = await prisma.tradeOffer.findUnique({ where: { id: tB.id } })
    check(tBafter?.status === 'INVALIDATED', 'offerta B (giocatore condiviso) → INVALIDATED')

    // ===== S8: INDICATORE TRATTATIVE IN CORSO =====
    console.log('\n[S8] Indicatore trattative in corso')
    // Pending residue: S1 (Pietro↔Michele), S4-counter (Diego↔Pietro). Query come Emiliano (estraneo).
    const ind = await getOngoingTradesIndicator(LEAGUE_ID, userId('Emiliano'))
    const indData = ind.data as { count: number; pairs: Array<{ a: string; b: string }> }
    check(ind.success === true, 'indicatore ottenuto')
    check(indData.count >= 2, `conteggio offerte pending tra altri ≥ 2 (trovato ${indData.count})`)
    const involvesEmiliano = indData.pairs.some((p) => p.a === 'Emiliano' || p.b === 'Emiliano')
    check(!involvesEmiliano, 'indicatore esclude offerte che coinvolgono chi interroga')
    // Query come Pietro: deve escludere le proprie offerte → pairs senza Pietro
    const indP = await getOngoingTradesIndicator(LEAGUE_ID, userId('Pietro'))
    const indPData = indP.data as { pairs: Array<{ a: string; b: string }> }
    check(!indPData.pairs.some((p) => p.a === 'Pietro' || p.b === 'Pietro'), 'le offerte proprie sono escluse dall\'indicatore')

  } finally {
    // ---------- RESTORE ----------
    console.log('\n=== RIPRISTINO STATO ===')
    // Cancella movimenti TRADE e tutte le TradeOffer della sessione (la sessione partiva da 0 trade)
    const delMov = await prisma.playerMovement.deleteMany({ where: { marketSessionId: session.id, movementType: 'TRADE' } })
    const delTrades = await prisma.tradeOffer.deleteMany({ where: { marketSessionId: session.id } })
    console.log(`Cancellati ${delMov.count} movimenti TRADE, ${delTrades.count} TradeOffer.`)
    // Ripristina owner + acquisitionType delle rose
    let rosterRestored = 0
    for (const r of rosterSnap) {
      const res = await prisma.playerRoster.updateMany({
        where: { id: r.id, NOT: { leagueMemberId: r.leagueMemberId, acquisitionType: r.acquisitionType } },
        data: { leagueMemberId: r.leagueMemberId, acquisitionType: r.acquisitionType },
      })
      rosterRestored += res.count
    }
    // Ripristina contratti coerenti con l'owner del roster
    const allRosters = await prisma.playerRoster.findMany({ where: { leagueMember: { leagueId: LEAGUE_ID } }, select: { id: true, leagueMemberId: true } })
    let contractFixed = 0
    for (const r of allRosters) {
      const res = await prisma.playerContract.updateMany({ where: { rosterId: r.id, NOT: { leagueMemberId: r.leagueMemberId } }, data: { leagueMemberId: r.leagueMemberId } })
      contractFixed += res.count
    }
    // Ripristina budget
    let budgetRestored = 0
    for (const b of budgetSnap) {
      const res = await prisma.leagueMember.updateMany({ where: { id: b.id, NOT: { currentBudget: b.currentBudget } }, data: { currentBudget: b.currentBudget } })
      budgetRestored += res.count
    }
    console.log(`Ripristinati: ${rosterRestored} rose, ${contractFixed} contratti, ${budgetRestored} budget.`)
  }

  console.log(`\n===== RISULTATO F3: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach((f) => console.log('  ✗ ' + f)) }
  else console.log('Backend scambi F3 corretto: creazione/validazioni, rifiuto, controfferta, accettazione+trasferimento, auto-invalidazione, anti-reverse, indicatore.')
}
main().catch(console.error).finally(() => prisma.$disconnect())
