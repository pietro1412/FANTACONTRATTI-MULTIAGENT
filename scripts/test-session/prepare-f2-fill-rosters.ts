/**
 * Sessione test 2026-06-08 — PREPARAZIONE FASE F2 ("Apertura mercato ricorrente").
 *
 * Obiettivo: portare la "Lega test E2E" a "Primo Mercato concluso, rose complete" così che
 * Pietro possa avviare dalla UI il Mercato Ricorrente (fase OFFERTE_PRE_RINNOVO) e osservare
 * decremento durata + svincoli automatici dei contratti scaduti (duration 1 → 0).
 *
 * Cosa fa (idempotente):
 *  1. Per ogni manager ACTIVE riempie gli slot ruolo configurati sulla lega (P/D/C/A)
 *     con giocatori SerieA DISPONIBILI (non già in rosa attiva nella lega), evitando duplicati
 *     anche tra manager nella stessa esecuzione.
 *  2. Crea PlayerRoster (status ACTIVE, acquisitionType FIRST_MARKET) + PlayerContract con le
 *     formule di dominio (salary = round(price/10) min 1; rescissionClause = salary × {1:3,2:7,3:9,4:11}).
 *  3. Distribuisce DURATE VARIE includendo diversi contratti duration=1 per ogni manager.
 *  4. Scala currentBudget del manager del prezzo simbolico di acquisizione (mai negativo).
 *  5. NON crea né apre il Mercato Ricorrente. La chiusura del Primo Mercato e l'apertura del
 *     Mercato Ricorrente le fa Pietro dalla UI (vedi report).
 *
 * NON tocca codice di produzione. Usa le formule esportate da contract.service.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/prepare-f2-fill-rosters.ts
 */
import { PrismaClient, Position, AcquisitionType, RosterStatus, MemberStatus } from '@prisma/client'
import { calculateDefaultSalary, calculateRescissionClause } from '../../src/services/contract.service'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'

// Prezzo simbolico di acquisizione per i giocatori aggiunti dallo script.
// salary = round(price/10) min 1 → con questi valori salary ∈ {1,2,3} (varietà), budget resta positivo.
const PRICE_CYCLE = [10, 20, 30, 15]

// Pattern di durate per i contratti NUOVI: garantisce >=1 contratto duration=1 per manager
// e un mix 1/2/3/4 per testare il decremento e gli svincoli per scadenza.
const DURATION_CYCLE = [1, 3, 2, 4, 1, 2, 3, 1, 4, 2]

const POSITIONS: Position[] = [Position.P, Position.D, Position.C, Position.A]

async function main() {
  const league = await prisma.league.findUnique({ where: { id: LEAGUE_ID } })
  if (!league) {
    console.log('ERRORE: lega non trovata', LEAGUE_ID)
    return
  }
  if (league.status !== 'ACTIVE') {
    console.log('ERRORE: lega non ACTIVE, stato =', league.status)
    return
  }

  const requiredSlots: Record<Position, number> = {
    P: league.goalkeeperSlots,
    D: league.defenderSlots,
    C: league.midfielderSlots,
    A: league.forwardSlots,
  }
  console.log(`Lega "${league.name}" budget=${league.initialBudget} slot P${requiredSlots.P} D${requiredSlots.D} C${requiredSlots.C} A${requiredSlots.A}`)

  // Pool giocatori disponibili per ruolo (esclude chi è già in una rosa ACTIVE della lega)
  const usedRosters = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID }, status: RosterStatus.ACTIVE },
    select: { playerId: true },
  })
  const usedPlayerIds = new Set(usedRosters.map((r) => r.playerId))

  const allPlayers = await prisma.serieAPlayer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, position: true, quotation: true },
    orderBy: { quotation: 'desc' },
  })
  const pools: Record<Position, { id: string; name: string }[]> = {
    P: [], D: [], C: [], A: [],
  }
  for (const p of allPlayers) {
    if (usedPlayerIds.has(p.id)) continue
    pools[p.position].push({ id: p.id, name: p.name })
  }
  console.log(`Pool disponibili: P${pools.P.length} D${pools.D.length} C${pools.C.length} A${pools.A.length}`)

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    include: {
      user: { select: { username: true } },
      roster: { where: { status: RosterStatus.ACTIVE }, include: { player: { select: { position: true } } } },
    },
    orderBy: { firstMarketOrder: 'asc' },
  })

  // Verifica capacità pool sufficiente (demand sui soli slot mancanti)
  const demand: Record<Position, number> = { P: 0, D: 0, C: 0, A: 0 }
  for (const m of members) {
    const counts: Record<Position, number> = { P: 0, D: 0, C: 0, A: 0 }
    for (const r of m.roster) counts[r.player.position]++
    for (const pos of POSITIONS) demand[pos] += Math.max(0, requiredSlots[pos] - counts[pos])
  }
  for (const pos of POSITIONS) {
    if (pools[pos].length < demand[pos]) {
      console.log(`ERRORE: pool ${pos} insufficiente — servono ${demand[pos]}, disponibili ${pools[pos].length}. STOP.`)
      return
    }
  }

  let durationCursor = 0 // globale: scorre il pattern durate tra giocatori e manager
  let createdTotal = 0

  for (const m of members) {
    const counts: Record<Position, number> = { P: 0, D: 0, C: 0, A: 0 }
    for (const r of m.roster) counts[r.player.position]++

    let budget = m.currentBudget
    let createdForMember = 0
    let priceCursor = 0

    for (const pos of POSITIONS) {
      const needed = Math.max(0, requiredSlots[pos] - counts[pos])
      for (let i = 0; i < needed; i++) {
        const player = pools[pos].shift()
        if (!player) {
          console.log(`ERRORE: pool ${pos} esaurito durante il riempimento di ${m.user.username}. STOP.`)
          return
        }
        const price = PRICE_CYCLE[priceCursor % PRICE_CYCLE.length]
        priceCursor++
        const salary = calculateDefaultSalary(price) // round(price/10) min 1
        const duration = DURATION_CYCLE[durationCursor % DURATION_CYCLE.length]
        durationCursor++
        const rescissionClause = calculateRescissionClause(salary, duration)

        if (budget - price < 0) {
          console.log(`ERRORE: budget di ${m.user.username} diventerebbe negativo (${budget} - ${price}). STOP.`)
          return
        }
        budget -= price

        await prisma.$transaction(async (tx) => {
          const roster = await tx.playerRoster.create({
            data: {
              leagueMemberId: m.id,
              playerId: player.id,
              acquisitionPrice: price,
              acquisitionType: AcquisitionType.FIRST_MARKET,
              status: RosterStatus.ACTIVE,
            },
          })
          await tx.playerContract.create({
            data: {
              rosterId: roster.id,
              leagueMemberId: m.id,
              salary,
              duration,
              initialSalary: salary,
              initialDuration: duration,
              rescissionClause,
            },
          })
        })
        createdForMember++
        createdTotal++
      }
    }

    if (createdForMember > 0) {
      await prisma.leagueMember.update({ where: { id: m.id }, data: { currentBudget: budget } })
    }
    console.log(`  ${m.user.username}: +${createdForMember} giocatori, budget ${m.currentBudget} → ${budget}`)
  }

  console.log(`\nGiocatori/contratti creati in totale: ${createdTotal}`)
  await printSummary()
}

async function printSummary() {
  const league = await prisma.league.findUnique({ where: { id: LEAGUE_ID } })
  const requiredSlots = {
    P: league!.goalkeeperSlots, D: league!.defenderSlots, C: league!.midfielderSlots, A: league!.forwardSlots,
  }
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: RosterStatus.ACTIVE },
        include: { player: { select: { position: true, name: true } }, contract: true },
      },
    },
    orderBy: { firstMarketOrder: 'asc' },
  })

  console.log('\n===== RIEPILOGO ROSE =====')
  let anyError = false
  const allPlayerIds: string[] = []
  for (const m of members) {
    const counts: Record<string, number> = { P: 0, D: 0, C: 0, A: 0 }
    const durCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    let missingContract = 0
    for (const r of m.roster) {
      counts[r.player.position]++
      allPlayerIds.push(r.playerId)
      if (r.contract) durCounts[r.contract.duration] = (durCounts[r.contract.duration] ?? 0) + 1
      else missingContract++
    }
    const slotOk = counts.P === requiredSlots.P && counts.D === requiredSlots.D && counts.C === requiredSlots.C && counts.A === requiredSlots.A
    const slotOver = counts.P > requiredSlots.P || counts.D > requiredSlots.D || counts.C > requiredSlots.C || counts.A > requiredSlots.A
    if (!slotOk) anyError = true
    if (slotOver) anyError = true
    if (m.currentBudget < 0) anyError = true
    console.log(`  ${m.user.username}: P${counts.P}/${requiredSlots.P} D${counts.D}/${requiredSlots.D} C${counts.C}/${requiredSlots.C} A${counts.A}/${requiredSlots.A} | durate d1:${durCounts[1]} d2:${durCounts[2]} d3:${durCounts[3]} d4:${durCounts[4]} | budget=${m.currentBudget} | senzaContratto=${missingContract} | ${slotOk ? 'OK' : 'SLOT KO'}`)

    // Mostra 3 contratti di esempio
    const examples = m.roster.slice(0, 3).map((r) =>
      r.contract ? `${r.player.name}[${r.player.position}] sal${r.contract.salary} dur${r.contract.duration} cl${r.contract.rescissionClause}` : `${r.player.name} NO-CONTRACT`
    )
    console.log(`      es: ${examples.join(' | ')}`)
  }

  // Duplicati tra rose
  const dupSet = new Set<string>()
  const dups = new Set<string>()
  for (const pid of allPlayerIds) {
    if (dupSet.has(pid)) dups.add(pid)
    dupSet.add(pid)
  }
  if (dups.size > 0) {
    anyError = true
    console.log(`  ERRORE: ${dups.size} giocatori duplicati tra rose!`)
  } else {
    console.log(`  Nessun giocatore duplicato tra le rose (${allPlayerIds.length} contratti attivi totali).`)
  }

  const session = await prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    select: { type: true, status: true, currentPhase: true },
  })
  console.log('\nSESSIONE ATTIVA:', JSON.stringify(session))
  console.log(anyError ? '\nSTATO: INCOERENTE — controllare gli errori sopra.' : '\nSTATO: COERENTE — rose complete, pronte per la chiusura Primo Mercato dalla UI.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
