/**
 * Sessione test 2026-06-09 — F2: seed di giocatori USCITI nella "Lega test E2E" per testare
 * gli auto-svincoli all'apertura del Mercato Ricorrente.
 *
 * Marca alcuni giocatori GIÀ in rosa come usciti (SerieAPlayer.listStatus=NOT_IN_LIST + exitReason):
 *  - 2 RITIRATO  → attesi auto-svincolati in F2 (movimento RETIREMENT, gratuito)
 *  - 1 RETROCESSO → NON auto-svincolato in F2 (gestito in CONTRATTI/F5: KEEP/RELEASE gratuito)
 *  - 1 ESTERO     → NON auto-svincolato in F2 (gestito in CONTRATTI/F5: KEEP/RELEASE con indennizzo)
 *
 * Forza la durata del contratto dei giocatori scelti a 3 (clausola ricalcolata): così la loro
 * eventuale uscita è imputabile SOLO al ramo "usciti", mai al decremento-scadenza (che colpisce
 * solo i contratti a durata 1). Rende il test F2 discriminante.
 *
 * ⚠️ exitReason/listStatus sono globali sul SerieAPlayer (non per-lega): su DB di test locale OK.
 * Idempotente: rieseguibile. Opera scegliendo giocatori dalle rose ACTIVE della lega E2E.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/seed-exits-e2e.ts
 */
import { PrismaClient, MemberStatus, RosterStatus } from '@prisma/client'
import { calculateRescissionClause } from '../../src/services/contract.service'
const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
const FORCED_DURATION = 3

// Quanti giocatori marcare per ciascun motivo di uscita.
const PLAN: { reason: 'RITIRATO' | 'RETROCESSO' | 'ESTERO'; count: number }[] = [
  { reason: 'RITIRATO', count: 2 },
  { reason: 'RETROCESSO', count: 1 },
  { reason: 'ESTERO', count: 1 },
]

async function main() {
  // Idempotenza: azzera eventuali flag uscita stale (da run precedenti) su TUTTI i giocatori,
  // così un refill delle rose non re-immette ritirati "fantasma" inattesi.
  const cleared = await prisma.serieAPlayer.updateMany({
    where: { OR: [{ exitReason: { not: null } }, { listStatus: 'NOT_IN_LIST' }] },
    data: { exitReason: null, listStatus: 'IN_LIST' },
  })
  console.log(`Flag uscita azzerati su ${cleared.count} giocatori (idempotenza).`)

  // Membri ACTIVE in ordine, per distribuire le uscite su manager diversi.
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: RosterStatus.ACTIVE, contract: { isNot: null } },
        include: { player: { select: { id: true, name: true } }, contract: true },
      },
    },
    orderBy: { firstMarketOrder: 'asc' },
  })

  // Costruisce una coda di (member, roster) da manager diversi, evitando di toccare due volte
  // lo stesso giocatore.
  const picks: { username: string; rosterId: string; contractId: string; salary: number; playerId: string; playerName: string }[] = []
  const usedPlayerIds = new Set<string>()
  let memberCursor = 0
  const totalNeeded = PLAN.reduce((s, p) => s + p.count, 0)
  let guard = 0
  while (picks.length < totalNeeded && guard < 1000) {
    guard++
    const m = members[memberCursor % members.length]
    memberCursor++
    const candidate = m.roster.find((r) => !usedPlayerIds.has(r.player.id) && r.contract)
    if (!candidate || !candidate.contract) continue
    usedPlayerIds.add(candidate.player.id)
    picks.push({
      username: m.user.username,
      rosterId: candidate.id,
      contractId: candidate.contract.id,
      salary: candidate.contract.salary,
      playerId: candidate.player.id,
      playerName: candidate.player.name,
    })
  }

  if (picks.length < totalNeeded) {
    console.log(`ERRORE: trovati solo ${picks.length}/${totalNeeded} giocatori idonei. STOP.`)
    return
  }

  // Assegna i motivi secondo il PLAN.
  let idx = 0
  for (const p of PLAN) {
    for (let i = 0; i < p.count; i++) {
      const pick = picks[idx++]
      await prisma.$transaction(async (tx) => {
        await tx.serieAPlayer.update({
          where: { id: pick.playerId },
          data: { listStatus: 'NOT_IN_LIST', exitReason: p.reason },
        })
        await tx.playerContract.update({
          where: { id: pick.contractId },
          data: { duration: FORCED_DURATION, rescissionClause: calculateRescissionClause(pick.salary, FORCED_DURATION) },
        })
      })
      console.log(`  ${p.reason.padEnd(10)} ${pick.playerName} (rosa di ${pick.username}) — contratto forzato a durata ${FORCED_DURATION}`)
    }
  }

  // Verifica
  console.log('\n=== VERIFICA SEED USCITI ===')
  for (const reason of ['RITIRATO', 'RETROCESSO', 'ESTERO'] as const) {
    const inRoster = await prisma.playerRoster.count({
      where: { leagueMember: { leagueId: LEAGUE_ID }, status: RosterStatus.ACTIVE, player: { exitReason: reason, listStatus: 'NOT_IN_LIST' } },
    })
    console.log(`  ${reason}: ${inRoster} in rosa ACTIVE`)
  }
  console.log('\nAttesi in F2: i 2 RITIRATO auto-svincolati (RETIREMENT); RETROCESSO/ESTERO mantenuti fino a CONTRATTI (F5).')
}
main().catch(console.error).finally(() => prisma.$disconnect())
