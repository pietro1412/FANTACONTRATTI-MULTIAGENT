/**
 * VERIFICA AUTOMATICA F6 — fase RUBATA (ordine classifica inversa, tabellone, prezzo base, preferenze).
 * Esercita rubata.service sulla sessione ricorrente ATTIVA della "Lega test E2E".
 *
 * Copertura: setRubataOrder (admin-only, ordine completo, persistenza su sessione+membri),
 * generateRubataBoard (prezzo base = clausola+ingaggio per ogni contratto attivo; ordinamento
 * per membro secondo rubataOrder e ruoli P→D→C→A; stato READY_CHECK), getRubablePlayers (prezzo
 * base), RubataPreference CRUD (watchlist/autoPass/maxBid/priority, upsert, delete).
 *
 * NON copre (→ giro manuale): asta forzata stateful (offer/bid/ready-check/ack/trasferimenti,
 * "se nessuno offre il giocatore resta") — flusso board complesso da validare a mano/E2E.
 *
 * Non distruttivo: snapshot dei campi rubata della sessione + rubataOrder dei membri + fase;
 * restore al termine. Non tocca contratti/budget.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f6-rubata.ts
 */
import { PrismaClient, Prisma, MemberStatus } from '@prisma/client'
import {
  setRubataOrder, generateRubataBoard, getRubablePlayers,
  setRubataPreference, getRubataPreferences, deleteRubataPreference,
} from '../../src/services/rubata.service'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
const POS_ORDER: Record<string, number> = { P: 1, D: 2, C: 3, A: 4 }

let pass = 0, fail = 0
const fails: string[] = []
function check(cond: boolean, label: string) { if (cond) { pass++; console.log('  ✓ ' + label) } else { fail++; fails.push(label); console.log('  ✗ ' + label) } }

async function main() {
  const session = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
  if (!session) { console.log('ERRORE: nessuna sessione ACTIVE.'); return }
  const SID = session.id
  const startPhase = session.currentPhase

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { firstMarketOrder: 'asc' },
  })
  const byName: Record<string, typeof members[number]> = {}
  for (const m of members) byName[m.user.username] = m
  const adminUser = byName['Pietro'].user.id

  // Snapshot
  const sessSnap = {
    currentPhase: session.currentPhase,
    rubataOrder: session.rubataOrder,
    rubataBoard: session.rubataBoard,
    rubataBoardIndex: session.rubataBoardIndex,
    rubataState: session.rubataState,
    rubataReadyMembers: session.rubataReadyMembers,
  }
  const memberOrderSnap = members.map((m) => ({ id: m.id, rubataOrder: m.rubataOrder }))

  // Ordine "classifica inversa" simulato: inverso del firstMarketOrder
  const inverseOrder = [...members].reverse().map((m) => m.id)
  const testPlayer = await prisma.serieAPlayer.findFirst({ where: { isActive: true } })

  try {
    // ===== S1: setRubataOrder =====
    console.log('[S1] setRubataOrder (ordine classifica inversa)')
    check((await setRubataOrder(LEAGUE_ID, byName['Michele'].user.id, inverseOrder)).success === false, 'non-admin rifiutato')
    check((await setRubataOrder(LEAGUE_ID, adminUser, inverseOrder.slice(1))).success === false, 'ordine incompleto rifiutato')
    const ok = await setRubataOrder(LEAGUE_ID, adminUser, inverseOrder)
    check(ok.success === true, 'ordine valido impostato (admin)')
    const sAfter = await prisma.marketSession.findUnique({ where: { id: SID } })
    check(JSON.stringify(sAfter?.rubataOrder) === JSON.stringify(inverseOrder), 'session.rubataOrder persistito')
    const m0 = await prisma.leagueMember.findUnique({ where: { id: inverseOrder[0] } })
    const mLast = await prisma.leagueMember.findUnique({ where: { id: inverseOrder[inverseOrder.length - 1] } })
    check(m0?.rubataOrder === 1 && mLast?.rubataOrder === members.length, `member.rubataOrder 1..${members.length} (primo a scegliere = ultimo in classifica)`)

    // ===== S2: generateRubataBoard =====
    console.log('\n[S2] generateRubataBoard')
    // Richiede fase RUBATA
    await prisma.marketSession.update({ where: { id: SID }, data: { currentPhase: 'RUBATA' } })
    check((await generateRubataBoard(LEAGUE_ID, byName['Mirko'].user.id)).success === false, 'non-admin rifiutato')
    const gen = await generateRubataBoard(LEAGUE_ID, adminUser)
    check(gen.success === true, 'tabellone generato')
    const board = (gen.data as { board: Array<{ memberId: string; playerPosition: string; rubataPrice: number; contractSalary: number; contractClause: number }> }).board
    const activeContracts = await prisma.playerContract.count({ where: { roster: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' }, duration: { gt: 0 } } })
    check(board.length === activeContracts, `board contiene tutti i contratti attivi (${board.length}/${activeContracts})`)
    const priceErrors = board.filter((b) => b.rubataPrice !== b.contractClause + b.contractSalary).length
    check(priceErrors === 0, 'prezzo base = clausola + ingaggio per ogni entry')
    // ordinamento: membri secondo rubataOrder; entro membro ruoli P→D→C→A non decrescenti
    let orderOk = true
    let memberCursor = -1
    let lastPos = 0
    const seenMembers: string[] = []
    for (const b of board) {
      const idx = inverseOrder.indexOf(b.memberId)
      if (idx !== memberCursor) {
        // nuovo membro: deve venire dopo nel rubataOrder e non già visto
        if (idx < memberCursor || seenMembers.includes(b.memberId)) orderOk = false
        memberCursor = idx; lastPos = 0; seenMembers.push(b.memberId)
      }
      const p = POS_ORDER[b.playerPosition]
      if (p < lastPos) orderOk = false
      lastPos = p
    }
    check(orderOk, 'ordinamento board: membri per rubataOrder, ruoli P→D→C→A entro ogni membro')
    const sBoard = await prisma.marketSession.findUnique({ where: { id: SID } })
    check(sBoard?.rubataState === 'READY_CHECK', 'rubataState → READY_CHECK')

    // ===== S3: getRubablePlayers (prezzo base) =====
    console.log('\n[S3] getRubablePlayers')
    const rub = await getRubablePlayers(LEAGUE_ID, byName['Diego'].id, adminUser)
    const rubData = rub.data as Array<{ rubataBasePrice: number; contract: { salary: number; rescissionClause: number } | null }>
    const rubErrors = rubData.filter((r) => r.contract && r.rubataBasePrice !== r.contract.rescissionClause + r.contract.salary).length
    check(rub.success === true && rubData.length > 0, 'rubable players di Diego ottenuti')
    check(rubErrors === 0, 'rubataBasePrice = clausola + ingaggio')

    // ===== S4: RubataPreference CRUD =====
    console.log('\n[S4] RubataPreference (watchlist/autoPass/maxBid/priority)')
    if (testPlayer) {
      const set1 = await setRubataPreference(LEAGUE_ID, byName['Diego'].user.id, testPlayer.id, { isWatchlist: true, maxBid: 50, priority: 1 })
      check(set1.success === true, 'preferenza creata (watchlist, maxBid 50, priority 1)')
      const pref1 = await prisma.rubataPreference.findFirst({ where: { sessionId: SID, memberId: byName['Diego'].id, playerId: testPlayer.id } })
      check(pref1?.isWatchlist === true && pref1?.maxBid === 50 && pref1?.priority === 1, 'campi preferenza corretti')
      const get1 = await getRubataPreferences(LEAGUE_ID, byName['Diego'].user.id)
      check(get1.success === true, 'getRubataPreferences ok')
      // upsert (update)
      const set2 = await setRubataPreference(LEAGUE_ID, byName['Diego'].user.id, testPlayer.id, { isWatchlist: true, isAutoPass: true, maxBid: 70, priority: 2 })
      const pref2 = await prisma.rubataPreference.findFirst({ where: { sessionId: SID, memberId: byName['Diego'].id, playerId: testPlayer.id } })
      check(set2.success === true && pref2?.isAutoPass === true && pref2?.maxBid === 70 && pref2?.priority === 2, 'upsert preferenza (autoPass, maxBid 70, priority 2)')
      // delete
      const del = await deleteRubataPreference(LEAGUE_ID, byName['Diego'].user.id, testPlayer.id)
      const pref3 = await prisma.rubataPreference.findFirst({ where: { sessionId: SID, memberId: byName['Diego'].id, playerId: testPlayer.id } })
      check(del.success === true && pref3 === null, 'preferenza eliminata')
    } else check(false, 'trovato un giocatore per il test preferenze')

  } finally {
    // ===== RESTORE =====
    console.log('\n=== RIPRISTINO STATO ===')
    if (testPlayer) await prisma.rubataPreference.deleteMany({ where: { sessionId: SID, memberId: byName['Diego'].id, playerId: testPlayer.id } })
    await prisma.marketSession.update({
      where: { id: SID },
      data: {
        currentPhase: sessSnap.currentPhase,
        rubataOrder: (sessSnap.rubataOrder ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        rubataBoard: (sessSnap.rubataBoard ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        rubataBoardIndex: sessSnap.rubataBoardIndex,
        rubataState: sessSnap.rubataState,
        rubataReadyMembers: (sessSnap.rubataReadyMembers ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    })
    for (const m of memberOrderSnap) {
      await prisma.leagueMember.update({ where: { id: m.id }, data: { rubataOrder: m.rubataOrder } })
    }
    const phaseNow = (await prisma.marketSession.findUnique({ where: { id: SID } }))?.currentPhase
    console.log(`Ripristino: fase → ${phaseNow}, ordine/board/preferenze azzerati.`)
  }

  console.log(`\n===== RISULTATO F6: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach((f) => console.log('  ✗ ' + f)) }
  else console.log('Backend fase Rubata F6 corretto: ordine inverso, tabellone (prezzo base clausola+ingaggio, P→D→C→A), rubable players, preferenze CRUD.')
}
main().catch(console.error).finally(() => prisma.$disconnect())
