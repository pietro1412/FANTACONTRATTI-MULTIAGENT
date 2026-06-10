/**
 * VERIFICA AUTOMATICA F5 — fase CONTRATTI (rinnovi, svincoli, spalma, consolidamento).
 * Esercita contract.service end-to-end sulla sessione ricorrente ATTIVA della "Lega test E2E".
 *
 * Copertura: formule pure (release cost, validazione rinnovo), renewContract standalone
 * (rinnovo valido, spalma, casi invalidi, ownership), releasePlayer standalone (costo normale
 * = ceil(s*d/2) con scalo budget; GRATIS per ESTERO/RETROCESSO), pipeline consolidamento
 * (consolidateContracts applica + crea ContractConsolidation + preConsolidationBudget; status;
 * standalone bloccato dopo consolidamento; canAdvanceFromContratti gate; re-consolidate bloccato).
 *
 * Non distruttivo: SNAPSHOT completo (contratti, rose, budget, fase) + RESTORE con verifica
 * di integrità finale. La fase viene portata a CONTRATTI come test-infra (DB).
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f5-contracts.ts
 */
import { PrismaClient, Prisma, MemberStatus, RosterStatus } from '@prisma/client'
import {
  calculateReleaseCost, isValidRenewal, renewContract, releasePlayer,
  consolidateContracts, getConsolidationStatus, canAdvanceFromContratti,
} from '../../src/services/contract.service'

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
    include: { user: { select: { id: true, username: true } } },
  })
  const byName: Record<string, typeof members[number]> = {}
  for (const m of members) byName[m.user.username] = m

  // ---------- SNAPSHOT COMPLETO ----------
  const contractSnap = await prisma.playerContract.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID } },
  })
  const rosterSnap = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID } },
    select: { id: true, status: true, releasedAt: true, leagueMemberId: true, acquisitionType: true },
  })
  const budgetSnap = members.map((m) => ({ id: m.id, currentBudget: m.currentBudget, preConsolidationBudget: m.preConsolidationBudget }))
  const snapActiveContracts = contractSnap.length
  const snapActiveRosters = rosterSnap.filter((r) => r.status === 'ACTIVE').length
  console.log(`Snapshot: ${contractSnap.length} contratti, ${rosterSnap.length} rose (${snapActiveRosters} ACTIVE), ${budgetSnap.length} budget. Sessione ${SID}, fase ${startPhase}.\n`)

  try {
    // Porta in CONTRATTI (test-infra)
    await prisma.marketSession.update({ where: { id: SID }, data: { currentPhase: 'CONTRATTI' } })

    // ===== S1: FORMULE PURE =====
    console.log('[S1] Formule pure')
    check(calculateReleaseCost(4, 3) === 6, 'releaseCost(4,3)=ceil(12/2)=6')
    check(calculateReleaseCost(3, 3) === 5, 'releaseCost(3,3)=ceil(9/2)=5 (arrotonda su)')
    check(isValidRenewal(2, 2, 3, 3, 2).valid === true, 'rinnovo valido: salary↑ + durata↑')
    check(isValidRenewal(2, 2, 1, 2, 2).valid === false, 'salary↓ rifiutato')
    check(isValidRenewal(2, 2, 2, 3, 2).valid === false, 'durata↑ senza salary↑ rifiutato')
    check(isValidRenewal(2, 2, 5, 5, 2).valid === false, 'durata > MAX(4) rifiutata')
    check(isValidRenewal(3, 1, 1, 3, 3).valid === true, 'spalma valido: 1×?  → 1×3=3 ≥ initial 3')
    check(isValidRenewal(3, 1, 1, 2, 3).valid === false, 'spalma invalido: 1×2=2 < initial 3')

    // Helper per recuperare un contratto ACTIVE di un manager con durata data
    async function contractOf(username: string, opts: { duration?: number } = {}) {
      return prisma.playerContract.findFirst({
        where: {
          leagueMember: { id: byName[username].id },
          ...(opts.duration ? { duration: opts.duration } : {}),
          // solo giocatori NON usciti per i test "normali"
          roster: { status: RosterStatus.ACTIVE, player: { exitReason: null } },
        },
        include: { roster: { include: { player: true } } },
      })
    }

    // ===== S2: RENEW STANDALONE =====
    console.log('\n[S2] renewContract standalone')
    const cRenew = await contractOf('Diego', { duration: 2 })
    if (cRenew) {
      const r = await renewContract(cRenew.id, byName['Diego'].user.id, cRenew.salary + 2, 3)
      check(r.success === true, `rinnovo valido (sal ${cRenew.salary}→${cRenew.salary + 2}, dur 2→3)`)
      const after = await prisma.playerContract.findUnique({ where: { id: cRenew.id } })
      check(after?.duration === 3 && after?.salary === cRenew.salary + 2, 'contratto aggiornato')
      check(after?.rescissionClause === (cRenew.salary + 2) * 9, 'clausola ricalcolata (×9 per dur 3)')
      // invalido: salary giù
      const bad = await renewContract(cRenew.id, byName['Diego'].user.id, 1, 3)
      check(bad.success === false, 'rinnovo con salary < corrente rifiutato')
      // ownership
      const notOwner = await renewContract(cRenew.id, byName['Marco'].user.id, 99, 4)
      check(notOwner.success === false, 'rinnovo da non proprietario rifiutato')
    } else check(false, 'trovato un contratto dur2 di Diego per il rinnovo')

    // spalma: contratto durata 1
    const cSpalma = await contractOf('Marcolino', { duration: 1 })
    if (cSpalma) {
      const r = await renewContract(cSpalma.id, byName['Marcolino'].user.id, cSpalma.initialSalary, 2)
      check(r.success === true, `spalma dur1→2 (sal ${cSpalma.initialSalary}×2 ≥ initial ${cSpalma.initialSalary})`)
    } else check(false, 'trovato un contratto dur1 di Marcolino per la spalma')

    // ===== S3: RELEASE STANDALONE =====
    console.log('\n[S3] releasePlayer standalone')
    const cRel = await contractOf('Marco', { duration: 2 })
    if (cRel) {
      const budgetPre = (await prisma.leagueMember.findUnique({ where: { id: byName['Marco'].id } }))!.currentBudget
      const expectedCost = calculateReleaseCost(cRel.salary, cRel.duration)
      const r = await releasePlayer(cRel.id, byName['Marco'].user.id)
      check(r.success === true, `svincolo normale (costo atteso ${expectedCost})`)
      const budgetPost = (await prisma.leagueMember.findUnique({ where: { id: byName['Marco'].id } }))!.currentBudget
      check(budgetPost === budgetPre - expectedCost, `budget scalato del costo taglio (${budgetPre}→${budgetPost})`)
      const rosterRel = await prisma.playerRoster.findUnique({ where: { id: cRel.rosterId } })
      check(rosterRel?.status === 'RELEASED', 'roster → RELEASED')
      check((await prisma.playerContract.findUnique({ where: { id: cRel.id } })) === null, 'contratto cancellato')
    } else check(false, 'trovato un contratto dur2 di Marco per lo svincolo')

    // ESTERO (Sommer/Emmanuele) → gratis
    const sommerRoster = await prisma.playerRoster.findFirst({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE', player: { name: 'Sommer', exitReason: 'ESTERO' } }, include: { contract: true, leagueMember: { include: { user: true } } } })
    if (sommerRoster?.contract) {
      const bPre = (await prisma.leagueMember.findUnique({ where: { id: sommerRoster.leagueMemberId } }))!.currentBudget
      const r = await releasePlayer(sommerRoster.contract.id, sommerRoster.leagueMember.user.id)
      check(r.success === true && (r.data as { releaseCost: number }).releaseCost === 0, 'svincolo ESTERO gratuito (costo 0)')
      const bPost = (await prisma.leagueMember.findUnique({ where: { id: sommerRoster.leagueMemberId } }))!.currentBudget
      check(bPost === bPre, 'budget invariato per ESTERO')
    } else check(false, 'Sommer ESTERO con contratto presente')

    // RETROCESSO (Di Gregorio/Mirko) → gratis
    const digRoster = await prisma.playerRoster.findFirst({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE', player: { name: 'Di Gregorio', exitReason: 'RETROCESSO' } }, include: { contract: true, leagueMember: { include: { user: true } } } })
    if (digRoster?.contract) {
      const r = await releasePlayer(digRoster.contract.id, digRoster.leagueMember.user.id)
      check(r.success === true && (r.data as { releaseCost: number }).releaseCost === 0, 'svincolo RETROCESSO gratuito (costo 0)')
    } else check(false, 'Di Gregorio RETROCESSO con contratto presente')

    // ===== S4: CONSOLIDAMENTO =====
    console.log('\n[S4] Pipeline consolidamento (Michele)')
    const cCons = await contractOf('Michele', { duration: 2 })
    if (cCons) {
      const budgetPre = (await prisma.leagueMember.findUnique({ where: { id: byName['Michele'].id } }))!.currentBudget
      const cons = await consolidateContracts(LEAGUE_ID, byName['Michele'].user.id, [{ contractId: cCons.id, salary: cCons.salary + 1, duration: 3 }], [])
      check(cons.success === true, 'consolidateContracts ok (1 rinnovo)')
      const recCons = await prisma.contractConsolidation.findUnique({ where: { sessionId_memberId: { sessionId: SID, memberId: byName['Michele'].id } } })
      check(!!recCons, 'record ContractConsolidation creato')
      const memAfter = await prisma.leagueMember.findUnique({ where: { id: byName['Michele'].id } })
      check(memAfter?.preConsolidationBudget === budgetPre, 'preConsolidationBudget salvato')
      const contractAfter = await prisma.playerContract.findUnique({ where: { id: cCons.id } })
      check(contractAfter?.duration === 3 && contractAfter?.salary === cCons.salary + 1, 'rinnovo applicato dal consolidamento')
      const status = await getConsolidationStatus(LEAGUE_ID, byName['Michele'].user.id)
      check((status.data as { isConsolidated: boolean }).isConsolidated === true, 'getConsolidationStatus → consolidato')
      // standalone bloccato dopo consolidamento
      const blockedRenew = await renewContract(cCons.id, byName['Michele'].user.id, cCons.salary + 5, 4)
      check(blockedRenew.success === false, 'renew standalone bloccato dopo consolidamento')
      // re-consolidate bloccato
      const reCons = await consolidateContracts(LEAGUE_ID, byName['Michele'].user.id, [], [])
      check(reCons.success === false, 're-consolidamento bloccato')
    } else check(false, 'trovato un contratto dur2 di Michele per il consolidamento')

    // gate avanzamento fase
    const gate = await canAdvanceFromContratti(SID)
    check(gate.canAdvance === false, 'canAdvanceFromContratti=false (non tutti consolidati)')

  } finally {
    // ---------- RESTORE ----------
    console.log('\n=== RIPRISTINO STATO ===')
    await prisma.contractConsolidation.deleteMany({ where: { sessionId: SID } })
    await prisma.draftContract.deleteMany({ where: { session: { leagueId: LEAGUE_ID } } }).catch(() => {})
    await prisma.contractHistory.deleteMany({ where: { marketSessionId: SID, createdAt: { gte: startTime } } })
    await prisma.playerMovement.deleteMany({ where: { marketSessionId: SID, createdAt: { gte: startTime }, movementType: { in: ['RELEASE', 'CONTRACT_RENEW', 'ABROAD_COMPENSATION', 'RELEGATION_RELEASE', 'RELEGATION_KEEP', 'ABROAD_KEEP'] } } })

    // Ricrea/ripristina contratti
    const nowContracts = await prisma.playerContract.findMany({ where: { leagueMember: { leagueId: LEAGUE_ID } }, select: { id: true } })
    const nowIds = new Set(nowContracts.map((c) => c.id))
    const snapIds = new Set(contractSnap.map((c) => c.id))
    // cancella contratti nuovi non presenti nello snapshot
    for (const c of nowContracts) if (!snapIds.has(c.id)) await prisma.playerContract.delete({ where: { id: c.id } })
    // upsert dei contratti dello snapshot (ricrea quelli cancellati, ripristina i mutati)
    for (const c of contractSnap) {
      const data = {
        salary: c.salary, duration: c.duration, initialSalary: c.initialSalary, initialDuration: c.initialDuration,
        rescissionClause: c.rescissionClause, preConsolidationSalary: c.preConsolidationSalary, preConsolidationDuration: c.preConsolidationDuration,
        renewalHistory: (c.renewalHistory ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      }
      if (nowIds.has(c.id)) {
        await prisma.playerContract.update({ where: { id: c.id }, data })
      } else {
        await prisma.playerContract.create({ data: { id: c.id, rosterId: c.rosterId, leagueMemberId: c.leagueMemberId, ...data } })
      }
    }
    // ripristina stato rose
    for (const r of rosterSnap) {
      await prisma.playerRoster.updateMany({ where: { id: r.id }, data: { status: r.status, releasedAt: r.releasedAt, acquisitionType: r.acquisitionType } })
    }
    // ripristina budget
    for (const b of budgetSnap) {
      await prisma.leagueMember.update({ where: { id: b.id }, data: { currentBudget: b.currentBudget, preConsolidationBudget: b.preConsolidationBudget } })
    }
    await prisma.marketSession.update({ where: { id: SID }, data: { currentPhase: startPhase } })

    // verifica integrità ripristino
    const afterContracts = await prisma.playerContract.count({ where: { leagueMember: { leagueId: LEAGUE_ID } } })
    const afterRostersActive = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' } })
    const okRestore = afterContracts === snapActiveContracts && afterRostersActive === snapActiveRosters
    console.log(`Ripristino: contratti ${afterContracts}/${snapActiveContracts}, rose ACTIVE ${afterRostersActive}/${snapActiveRosters} → ${okRestore ? 'OK' : 'INCOERENTE!'}`)
    if (!okRestore) console.log('  ⚠️ ATTENZIONE: ripristino incoerente, controllare manualmente.')
  }

  console.log(`\n===== RISULTATO F5: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach((f) => console.log('  ✗ ' + f)) }
  else console.log('Backend fase Contratti F5 corretto: formule, rinnovo, spalma, svincolo (normale+esteri/retrocessi gratis), consolidamento+lock+gate.')
}
main().catch(console.error).finally(() => prisma.$disconnect())
