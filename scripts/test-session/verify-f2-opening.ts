/**
 * VERIFICA AUTOMATICA F2 — apertura Mercato Ricorrente.
 * Non distruttiva: ricostruisce before/after dai record di ContractHistory + PlayerMovement
 * e valida contro le regole di dominio (decremento durata, svincolo per scadenza, ritirati,
 * ricalcolo clausola, snapshot di sessione). Read-only.
 */
import { PrismaClient } from '@prisma/client'
import { calculateRescissionClause } from '../../src/services/contract.service'
const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
const SESSION = 'cmq6fav4j04kzx6pmj7cuykq3'

let pass = 0, fail = 0
const fails: string[] = []
function check(cond: boolean, label: string) {
  if (cond) { pass++ } else { fail++; fails.push(label) }
}

async function main() {
  // 1. DURATION_DECREMENT entries
  const dec = await prisma.contractHistory.findMany({
    where: { marketSessionId: SESSION, eventType: 'DURATION_DECREMENT' },
  })
  console.log(`\n[1] DURATION_DECREMENT: ${dec.length} entries`)
  let clauseErrors = 0, durErrors = 0
  for (const e of dec) {
    if (e.newDuration !== (e.previousDuration ?? 0) - 1) durErrors++
    if ((e.newDuration ?? 0) < 1) durErrors++
    const expectedClause = calculateRescissionClause(e.newSalary ?? e.previousSalary ?? 0, e.newDuration ?? 0)
    if (e.newClause !== expectedClause) clauseErrors++
    if ((e.newSalary ?? null) !== (e.previousSalary ?? null)) clauseErrors++ // salary unchanged on decrement
  }
  check(durErrors === 0, `decremento durata: ${durErrors} errori (newDuration != prev-1 o <1)`)
  check(clauseErrors === 0, `ricalcolo clausola/salary su decremento: ${clauseErrors} errori`)
  console.log(`    durErrors=${durErrors} clauseErrors=${clauseErrors}`)

  // 2. AUTO_RELEASE_EXPIRED entries
  const rel = await prisma.contractHistory.findMany({
    where: { marketSessionId: SESSION, eventType: 'AUTO_RELEASE_EXPIRED' },
  })
  console.log(`\n[2] AUTO_RELEASE_EXPIRED: ${rel.length} entries`)
  let relErrors = 0, costErrors = 0
  for (const e of rel) {
    if (e.previousDuration !== 1) relErrors++ // only duration-1 contracts expire
    if (e.cost !== 0) costErrors++            // no clause paid on expiry
    if (e.newDuration !== null && e.newDuration !== undefined) relErrors++
  }
  check(relErrors === 0, `svincolo scadenza: ${relErrors} entries con previousDuration!=1 o newDuration valorizzato`)
  check(costErrors === 0, `costo svincolo scadenza: ${costErrors} entries con cost!=0`)
  console.log(`    relErrors=${relErrors} costErrors=${costErrors}`)

  // 3. RELEASE movements match released contracts (price 0)
  const relMov = await prisma.playerMovement.findMany({
    where: { marketSessionId: SESSION, movementType: 'RELEASE' },
  })
  check(relMov.length === rel.length, `movimenti RELEASE (${relMov.length}) != AUTO_RELEASE_EXPIRED (${rel.length})`)
  check(relMov.every(m => m.price === 0), `movimenti RELEASE con price!=0: ${relMov.filter(m=>m.price!==0).length}`)
  console.log(`\n[3] RELEASE movements: ${relMov.length}, tutti price 0: ${relMov.every(m=>m.price===0)}`)

  // 4. Released rosters: status RELEASED, no active contract
  const releasedPlayerIds = rel.map(e => e.playerId)
  const releasedRosters = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID }, playerId: { in: releasedPlayerIds } },
    include: { contract: true },
  })
  const stillActive = releasedRosters.filter(r => r.status === 'ACTIVE')
  const withContract = releasedRosters.filter(r => r.contract !== null)
  check(stillActive.length === 0, `roster svincolati ancora ACTIVE: ${stillActive.length}`)
  check(withContract.length === 0, `roster svincolati con contratto residuo: ${withContract.length}`)
  console.log(`\n[4] Roster svincolati: ${releasedRosters.length}, ACTIVE residui=${stillActive.length}, con contratto=${withContract.length}`)

  // 5. SESSION_START snapshots in ManagerSnapshot (1 per active member)
  const activeMembers = await prisma.leagueMember.count({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
  const snaps = await prisma.managerSessionSnapshot.findMany({
    where: { marketSessionId: SESSION, snapshotType: 'SESSION_START' },
  }).catch((e:any)=>{ console.log('managerSessionSnapshot err', e.message); return [] as any[] })
  check(snaps.length === activeMembers, `SESSION_START snapshot: ${snaps.length} != membri attivi ${activeMembers}`)
  console.log(`\n[5] SESSION_START snapshots: ${snaps.length} (membri attivi ${activeMembers})`)

  // 6. RITIRATI: no RETIREMENT movements expected (seed has none)
  const ret = await prisma.playerMovement.count({ where: { marketSessionId: SESSION, movementType: 'RETIREMENT' } })
  const ritiratiInRoster = await prisma.playerRoster.count({
    where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE', player: { exitReason: 'RITIRATO' } },
  })
  check(ritiratiInRoster === 0, `RITIRATI ancora attivi in rosa: ${ritiratiInRoster}`)
  console.log(`\n[6] RETIREMENT movements: ${ret}, RITIRATI attivi residui: ${ritiratiInRoster}`)

  // 7. Conservation: active contracts now == DURATION_DECREMENT count
  const activeNow = await prisma.playerContract.count({
    where: { roster: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' } },
  })
  check(activeNow === dec.length, `contratti attivi ora (${activeNow}) != decrementati (${dec.length})`)
  console.log(`\n[7] Conservazione: attivi ora=${activeNow}, decrementati=${dec.length}, svincolati=${rel.length}, totale pre=${activeNow+rel.length}`)

  console.log(`\n===== RISULTATO: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach(f => console.log('  ✗ ' + f)) }
  else console.log('Tutti i controlli di dominio sull\'apertura F2 superati.')
}
main().catch(console.error).finally(()=>prisma.$disconnect())
