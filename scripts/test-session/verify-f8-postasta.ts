/**
 * VERIFICA AUTOMATICA F8 — Post-asta + trasversali.
 * 1) Scambi nella fase OFFERTE_POST_ASTA_SVINCOLATI (secondo round trade): conferma che
 *    trade.service è abilitato anche nella seconda fase scambi e che il trasferimento funziona.
 * 2) Sanity dei trasversali read-only: movimenti di lega (includono i 64 dell'apertura F2),
 *    finanze di lega (coerenza budget/monte ingaggi/bilancio), statistiche di lega.
 * I ricorsi (appeals) sono già stati esercitati e corretti in F1 (oss. #10-#21, #31).
 *
 * Non distruttivo: snapshot rose+budget+fase; lo scambio viene annullato e lo stato ripristinato.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f8-postasta.ts
 */
import { PrismaClient, MemberStatus, RosterStatus } from '@prisma/client'
import { createTradeOffer, acceptTrade } from '../../src/services/trade.service'
import { getLeagueMovements } from '../../src/services/movement.service'
import { getLeagueFinancials } from '../../src/services/league.service'
import { getLeagueStatistics } from '../../src/services/admin.service'

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
  const startTime = new Date()

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    include: { user: { select: { id: true, username: true } }, roster: { where: { status: RosterStatus.ACTIVE }, select: { id: true } } },
  })
  const byName: Record<string, typeof members[number]> = {}
  for (const m of members) byName[m.user.username] = m

  const rosterSnap = await prisma.playerRoster.findMany({ where: { leagueMember: { leagueId: LEAGUE_ID } }, select: { id: true, leagueMemberId: true, acquisitionType: true } })
  const budgetSnap = members.map((m) => ({ id: m.id, currentBudget: m.currentBudget }))

  try {
    // ===== S1: TRASVERSALI READ-ONLY =====
    console.log('[S1] Trasversali read-only (movimenti, finanze, statistiche)')
    const mov = await getLeagueMovements(LEAGUE_ID, byName['Pietro'].user.id, { limit: 500 })
    const movData = mov.data as { movements?: unknown[]; total?: number } | unknown[]
    const movList = Array.isArray(movData) ? movData : (movData.movements ?? [])
    check(mov.success === true, 'getLeagueMovements ok')
    check(movList.length >= 64, `movimenti includono ≥64 (apertura F2): trovati ${movList.length}`)

    const fin = await getLeagueFinancials(LEAGUE_ID, byName['Mirko'].user.id)
    const finData = fin.data as { teams?: Array<{ budget: number; balance?: number; annualContractCost?: number }> }
    check(fin.success === true, 'getLeagueFinancials ok')
    check(Array.isArray(finData.teams) && finData.teams.length === members.length, `finanze: ${finData.teams?.length}/${members.length} squadre`)
    // coerenza: bilancio = budget - monte ingaggi (se esposti)
    const coherent = (finData.teams ?? []).every((t) => t.balance === undefined || t.annualContractCost === undefined || t.balance === t.budget - t.annualContractCost)
    check(coherent, 'finanze coerenti (bilancio = budget − monte ingaggi)')

    const stats = await getLeagueStatistics(LEAGUE_ID, byName['Diego'].user.id)
    check(stats.success === true && !!stats.data, 'getLeagueStatistics ok')

    // ===== S2: SCAMBI POST-ASTA SVINCOLATI =====
    console.log('\n[S2] Scambi in OFFERTE_POST_ASTA_SVINCOLATI')
    await prisma.marketSession.update({ where: { id: SID }, data: { currentPhase: 'OFFERTE_POST_ASTA_SVINCOLATI' } })
    const offered = byName['Michele'].roster[0].id
    const requested = byName['Mirko'].roster[0].id
    const r = await createTradeOffer(LEAGUE_ID, byName['Michele'].user.id, byName['Mirko'].id, [offered], [requested], 0, 0, 'F8 post-asta')
    check(r.success === true, 'creazione offerta nella fase post-asta consentita')
    const t = r.data as { id: string }
    const acc = await acceptTrade(t.id, byName['Mirko'].user.id)
    check(acc.success === true, 'accettazione scambio post-asta')
    const offAfter = await prisma.playerRoster.findUnique({ where: { id: offered } })
    const reqAfter = await prisma.playerRoster.findUnique({ where: { id: requested } })
    check(offAfter?.leagueMemberId === byName['Mirko'].id && reqAfter?.leagueMemberId === byName['Michele'].id, 'giocatori trasferiti tra le rose')
    const movs = await prisma.playerMovement.count({ where: { tradeId: t.id, movementType: 'TRADE' } })
    check(movs === 2, `2 movimenti TRADE registrati (${movs})`)

  } finally {
    // ===== RESTORE =====
    console.log('\n=== RIPRISTINO STATO ===')
    await prisma.playerMovement.deleteMany({ where: { marketSessionId: SID, movementType: 'TRADE', createdAt: { gte: startTime } } })
    await prisma.tradeOffer.deleteMany({ where: { marketSessionId: SID, createdAt: { gte: startTime } } })
    for (const r of rosterSnap) {
      await prisma.playerRoster.updateMany({ where: { id: r.id, NOT: { leagueMemberId: r.leagueMemberId, acquisitionType: r.acquisitionType as never } }, data: { leagueMemberId: r.leagueMemberId, acquisitionType: r.acquisitionType as never } })
    }
    const allR = await prisma.playerRoster.findMany({ where: { leagueMember: { leagueId: LEAGUE_ID } }, select: { id: true, leagueMemberId: true } })
    for (const r of allR) await prisma.playerContract.updateMany({ where: { rosterId: r.id, NOT: { leagueMemberId: r.leagueMemberId } }, data: { leagueMemberId: r.leagueMemberId } })
    for (const b of budgetSnap) await prisma.leagueMember.updateMany({ where: { id: b.id, NOT: { currentBudget: b.currentBudget } }, data: { currentBudget: b.currentBudget } })
    await prisma.marketSession.update({ where: { id: SID }, data: { currentPhase: startPhase } })
    const activeR = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' } })
    console.log(`Ripristino: fase → ${startPhase}, rose ACTIVE ${activeR}, scambi/movimenti test rimossi.`)
  }

  console.log(`\n===== RISULTATO F8: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach((f) => console.log('  ✗ ' + f)) }
  else console.log('Backend F8 corretto: scambi post-asta svincolati + trasversali (movimenti, finanze coerenti, statistiche).')
}
main().catch(console.error).finally(() => prisma.$disconnect())
