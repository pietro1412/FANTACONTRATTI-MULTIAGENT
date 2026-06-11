/**
 * VERIFICA AUTOMATICA F7 — fase ASTA_SVINCOLATI (ordine turni, free agents, nomination, pass, timer).
 * Esercita svincolati.service sulla sessione ricorrente ATTIVA della "Lega test E2E".
 *
 * Copertura deterministica: setSvincolatiTurnOrder (admin-only, ordine esplicito + auto-reverse
 * da rubataOrder, persistenza, stato READY_CHECK), getFreeAgents (pool = IN_LIST non in rosa),
 * setSvincolatiTimer (admin, range 10-300), nominateFreeAgent (turno, free-agent, budget, → NOMINATION),
 * confirmSvincolatiNomination (solo nominatore), passSvincolatiTurn (turno + avanzamento).
 *
 * NON copre (→ giro manuale): esecuzione asta stateful (ready-check completo, bid + reset timer,
 * chiusura → assegnazione + contratto 10%/3sem, real-time, bot).
 *
 * Non distruttivo: snapshot campi svincolati della sessione + rubataOrder + fase; restore al termine.
 * Non crea rose/contratti (nomination/confirm/pass non assegnano giocatori; lo fa solo la chiusura).
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f7-svincolati.ts
 */
import { PrismaClient, Prisma, MemberStatus } from '@prisma/client'
import {
  setSvincolatiTurnOrder, getFreeAgents, setSvincolatiTimer,
  nominateFreeAgent, confirmSvincolatiNomination, passSvincolatiTurn,
} from '../../src/services/svincolati.service'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'

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
  const order = members.map((m) => m.id) // ordine esplicito turni

  // Snapshot campi rilevanti della sessione
  const snap = await prisma.marketSession.findUnique({ where: { id: SID } })

  try {
    await prisma.marketSession.update({ where: { id: SID }, data: { currentPhase: 'ASTA_SVINCOLATI' } })

    // ===== S1: setSvincolatiTurnOrder =====
    console.log('[S1] setSvincolatiTurnOrder')
    check((await setSvincolatiTurnOrder(LEAGUE_ID, byName['Michele'].user.id, order)).success === false, 'non-admin rifiutato')
    const set1 = await setSvincolatiTurnOrder(LEAGUE_ID, adminUser, order)
    check(set1.success === true, 'ordine esplicito impostato (admin)')
    let s = await prisma.marketSession.findUnique({ where: { id: SID } })
    check(JSON.stringify(s?.svincolatiTurnOrder) === JSON.stringify(order), 'svincolatiTurnOrder persistito')
    check(s?.svincolatiState === 'READY_CHECK' && s?.svincolatiCurrentTurnIndex === 0, 'stato READY_CHECK, turno 0')
    // auto-reverse da rubataOrder
    const fakeRubata = [...order].reverse()
    await prisma.marketSession.update({ where: { id: SID }, data: { rubataOrder: fakeRubata } })
    const setAuto = await setSvincolatiTurnOrder(LEAGUE_ID, adminUser, [])
    s = await prisma.marketSession.findUnique({ where: { id: SID } })
    check(setAuto.success === true && JSON.stringify(s?.svincolatiTurnOrder) === JSON.stringify([...fakeRubata].reverse()), 'auto-reverse: ordine = rubataOrder invertito')
    // ripristina ordine esplicito per i test seguenti
    await setSvincolatiTurnOrder(LEAGUE_ID, adminUser, order)

    // ===== S2: getFreeAgents =====
    console.log('\n[S2] getFreeAgents')
    const fa = await getFreeAgents(LEAGUE_ID, adminUser)
    const freeAgents = fa.data as Array<{ id: string; listStatus: string }>
    check(fa.success === true && freeAgents.length > 0, `free agents disponibili (${freeAgents.length})`)
    const assignedIds = new Set((await prisma.playerRoster.findMany({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' }, select: { playerId: true } })).map((r) => r.playerId))
    const overlap = freeAgents.filter((p) => assignedIds.has(p.id)).length
    check(overlap === 0, 'nessun free agent è già in rosa (pool corretto)')
    check(freeAgents.every((p) => p.listStatus === 'IN_LIST'), 'free agents solo IN_LIST')

    // ===== S3: setSvincolatiTimer =====
    console.log('\n[S3] setSvincolatiTimer')
    check((await setSvincolatiTimer(LEAGUE_ID, adminUser, 45)).success === true, 'timer 45s impostato')
    check((await prisma.marketSession.findUnique({ where: { id: SID } }))?.svincolatiTimerSeconds === 45, 'timer persistito')
    check((await setSvincolatiTimer(LEAGUE_ID, adminUser, 5)).success === false, 'timer < 10 rifiutato')
    check((await setSvincolatiTimer(LEAGUE_ID, adminUser, 400)).success === false, 'timer > 300 rifiutato')
    check((await setSvincolatiTimer(LEAGUE_ID, byName['Mirko'].user.id, 30)).success === false, 'non-admin rifiutato')

    // ===== S4: nominateFreeAgent + confirm =====
    console.log('\n[S4] nominateFreeAgent + confirm')
    const nominator = members.find((m) => m.id === order[0])! // turno 0
    const nonTurn = members.find((m) => m.id === order[1])!
    const freeAgentId = freeAgents[0].id
    const assignedPlayerId = [...assignedIds][0]
    check((await nominateFreeAgent(LEAGUE_ID, nonTurn.user.id, freeAgentId)).success === false, 'nomina da chi non è di turno rifiutata')
    check((await nominateFreeAgent(LEAGUE_ID, nominator.user.id, assignedPlayerId)).success === false, 'nomina di giocatore già in rosa rifiutata')
    const nom = await nominateFreeAgent(LEAGUE_ID, nominator.user.id, freeAgentId)
    check(nom.success === true, 'nomina free agent valida')
    s = await prisma.marketSession.findUnique({ where: { id: SID } })
    check(s?.svincolatiState === 'NOMINATION' && s?.svincolatiPendingPlayerId === freeAgentId && s?.svincolatiPendingNominatorId === nominator.id, 'stato NOMINATION + pending corretti')
    check((await confirmSvincolatiNomination(LEAGUE_ID, nonTurn.user.id)).success === false, 'conferma da non-nominatore rifiutata')
    const conf = await confirmSvincolatiNomination(LEAGUE_ID, nominator.user.id)
    check(conf.success === true, 'conferma nomina (nominatore)')
    check((await prisma.marketSession.findUnique({ where: { id: SID } }))?.svincolatiNominatorConfirmed === true, 'svincolatiNominatorConfirmed = true')

    // ===== S5: passSvincolatiTurn =====
    console.log('\n[S5] passSvincolatiTurn')
    await setSvincolatiTurnOrder(LEAGUE_ID, adminUser, order) // reset a READY_CHECK, turno 0
    check((await passSvincolatiTurn(LEAGUE_ID, nonTurn.user.id)).success === false, 'pass da chi non è di turno rifiutato')
    const ps = await passSvincolatiTurn(LEAGUE_ID, nominator.user.id)
    check(ps.success === true, 'pass del manager di turno')
    s = await prisma.marketSession.findUnique({ where: { id: SID } })
    check(s?.svincolatiCurrentTurnIndex === 1 && (s?.svincolatiPassedMembers as string[]).includes(nominator.id), 'turno avanzato a indice 1 + membro in passedMembers')

  } finally {
    // ===== RESTORE =====
    console.log('\n=== RIPRISTINO STATO ===')
    await prisma.marketSession.update({
      where: { id: SID },
      data: {
        currentPhase: startPhase,
        rubataOrder: (snap?.rubataOrder ?? Prisma.JsonNull) as never,
        svincolatiTurnOrder: (snap?.svincolatiTurnOrder ?? Prisma.JsonNull) as never,
        svincolatiCurrentTurnIndex: snap?.svincolatiCurrentTurnIndex ?? null,
        svincolatiState: snap?.svincolatiState ?? null,
        svincolatiReadyMembers: (snap?.svincolatiReadyMembers ?? Prisma.JsonNull) as never,
        svincolatiPassedMembers: (snap?.svincolatiPassedMembers ?? Prisma.JsonNull) as never,
        svincolatiPendingPlayerId: snap?.svincolatiPendingPlayerId ?? null,
        svincolatiPendingNominatorId: snap?.svincolatiPendingNominatorId ?? null,
        svincolatiNominatorConfirmed: snap?.svincolatiNominatorConfirmed ?? false,
        svincolatiTimerSeconds: snap?.svincolatiTimerSeconds ?? null,
      },
    })
    const phaseNow = (await prisma.marketSession.findUnique({ where: { id: SID } }))?.currentPhase
    console.log(`Ripristino: fase → ${phaseNow}, campi svincolati/rubataOrder azzerati.`)
  }

  console.log(`\n===== RISULTATO F7: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach((f) => console.log('  ✗ ' + f)) }
  else console.log('Backend fase Svincolati F7 corretto: ordine turni (+auto-reverse), free agents, timer, nomination/confirm, pass/avanzamento.')
}
main().catch(console.error).finally(() => prisma.$disconnect())
