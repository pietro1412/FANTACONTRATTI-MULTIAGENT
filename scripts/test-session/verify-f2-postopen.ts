/**
 * VERIFICA POST-APERTURA F2 — da eseguire DOPO che l'admin avvia il Mercato Ricorrente dalla UI.
 * Trova la sessione MERCATO_RICORRENTE più recente e confronta gli effetti reali con le attese
 * della baseline (62 svincoli scadenza, 154 decrementi, 2 svincoli ritirati, retrocesso/estero
 * mantenuti). Read-only.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f2-postopen.ts
 */
import { PrismaClient } from '@prisma/client'
import { calculateRescissionClause } from '../../src/services/contract.service'
const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'

// Attese dalla baseline (baseline-f2.ts)
const EXP = { expired: 62, decrement: 154, retirement: 2, activeAfter: 152 }

let pass = 0, fail = 0
const fails: string[] = []
function check(cond: boolean, label: string) { if (cond) pass++; else { fail++; fails.push(label) } }

async function main() {
  const session = await prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID, type: 'MERCATO_RICORRENTE' },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) { console.log('ERRORE: nessuna sessione MERCATO_RICORRENTE trovata. Avvia prima il mercato dalla UI.'); return }
  console.log(`Sessione ricorrente: ${session.id} status=${session.status} fase=${session.currentPhase}`)
  check(session.status === 'ACTIVE', `sessione non ACTIVE (${session.status})`)
  check(session.currentPhase === 'OFFERTE_PRE_RINNOVO', `fase iniziale != OFFERTE_PRE_RINNOVO (${session.currentPhase})`)
  const S = session.id

  const dec = await prisma.contractHistory.findMany({ where: { marketSessionId: S, eventType: 'DURATION_DECREMENT' } })
  const rel = await prisma.contractHistory.findMany({ where: { marketSessionId: S, eventType: 'AUTO_RELEASE_EXPIRED' } })
  check(dec.length === EXP.decrement, `DURATION_DECREMENT ${dec.length} != atteso ${EXP.decrement}`)
  check(rel.length === EXP.expired, `AUTO_RELEASE_EXPIRED ${rel.length} != atteso ${EXP.expired}`)
  console.log(`[1] DURATION_DECREMENT=${dec.length} (atteso ${EXP.decrement}), AUTO_RELEASE_EXPIRED=${rel.length} (atteso ${EXP.expired})`)

  // Correttezza decremento
  let durErr = 0, clauseErr = 0
  for (const e of dec) {
    if (e.newDuration !== (e.previousDuration ?? 0) - 1 || (e.newDuration ?? 0) < 1) durErr++
    if (e.newClause !== calculateRescissionClause(e.newSalary ?? e.previousSalary ?? 0, e.newDuration ?? 0)) clauseErr++
  }
  check(durErr === 0, `decremento durata errori: ${durErr}`)
  check(clauseErr === 0, `ricalcolo clausola errori: ${clauseErr}`)

  // Correttezza svincolo scadenza
  let relErr = 0
  for (const e of rel) { if (e.previousDuration !== 1 || e.cost !== 0) relErr++ }
  check(relErr === 0, `svincolo scadenza errori (prevDur!=1 o cost!=0): ${relErr}`)

  // Movimenti
  const relMov = await prisma.playerMovement.count({ where: { marketSessionId: S, movementType: 'RELEASE' } })
  const retMov = await prisma.playerMovement.count({ where: { marketSessionId: S, movementType: 'RETIREMENT' } })
  check(relMov === EXP.expired, `RELEASE movements ${relMov} != ${EXP.expired}`)
  check(retMov === EXP.retirement, `RETIREMENT movements ${retMov} != ${EXP.retirement}`)
  console.log(`[2] RELEASE=${relMov} (atteso ${EXP.expired}), RETIREMENT=${retMov} (atteso ${EXP.retirement})`)

  // Ritirati: devono essere RELEASED, NON più in rosa ACTIVE
  const ritiratiActive = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE', player: { exitReason: 'RITIRATO', listStatus: 'NOT_IN_LIST' } } })
  check(ritiratiActive === 0, `RITIRATI ancora ACTIVE in rosa: ${ritiratiActive} (attesi 0, auto-svincolati)`)

  // Retrocesso/Estero: NON toccati in F2 → ancora ACTIVE
  const retroActive = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE', player: { exitReason: 'RETROCESSO', listStatus: 'NOT_IN_LIST' } } })
  const esteroActive = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE', player: { exitReason: 'ESTERO', listStatus: 'NOT_IN_LIST' } } })
  check(retroActive === 1, `RETROCESSO attivi ${retroActive} != 1 (non deve essere svincolato in F2)`)
  check(esteroActive === 1, `ESTERO attivi ${esteroActive} != 1 (non deve essere svincolato in F2)`)
  console.log(`[3] Ritirati ACTIVE residui=${ritiratiActive} (atteso 0); Retrocesso ACTIVE=${retroActive}, Estero ACTIVE=${esteroActive} (attesi 1+1)`)

  // Snapshot di sessione
  const activeMembers = await prisma.leagueMember.count({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
  const snaps = await prisma.managerSessionSnapshot.count({ where: { marketSessionId: S, snapshotType: 'SESSION_START' } })
  check(snaps === activeMembers, `SESSION_START snapshot ${snaps} != membri ${activeMembers}`)
  console.log(`[4] SESSION_START snapshots=${snaps} (atteso ${activeMembers})`)

  // Conservazione
  const activeAfter = await prisma.playerContract.count({ where: { roster: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' } } })
  check(activeAfter === EXP.activeAfter, `contratti attivi dopo ${activeAfter} != ${EXP.activeAfter}`)
  console.log(`[5] Contratti attivi dopo=${activeAfter} (atteso ${EXP.activeAfter})`)

  console.log(`\n===== RISULTATO: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach(f => console.log('  ✗ ' + f)) }
  else console.log('Apertura F2 corretta: decremento, svincoli scadenza, svincolo ritirati, mantenimento retrocesso/estero, snapshot.')
}
main().catch(console.error).finally(() => prisma.$disconnect())
