/**
 * VERIFICA AUTOMATICA F4 — fase PREMI (Mercato Ricorrente).
 * Esercita prize-phase.service end-to-end sulla sessione ricorrente ATTIVA della "Lega test E2E"
 * e asserisce: inizializzazione (config 100M + categoria sistema indennizzo 50M/membro),
 * re-incremento base, categorie custom (dup/empty/delete-system), premi per manager, indennizzo
 * ESTERO custom, finalizzazione (accredito budget = base + premi NON di sistema; sistema esclusi),
 * correzione admin post-finalize (delta a budget solo per categorie non-sistema), validazioni.
 *
 * Non distruttivo: snapshot budget+fase, sposta la sessione in PREMI, e al termine RIPRISTINA
 * (cancella config/categorie/premi, ripristina budget, riporta la fase a OFFERTE_PRE_RINNOVO).
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/verify-f4-prizes.ts
 */
import { PrismaClient, MemberStatus } from '@prisma/client'
import {
  initializePrizePhase, getPrizePhaseData, updateBaseReincrement, createPrizeCategory,
  deletePrizeCategory, setMemberPrize, adminCorrectMemberPrize, finalizePrizePhase, setCustomIndemnity,
} from '../../src/services/prize-phase.service'
import { setMarketPhase } from '../../src/services/auction.service'

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
  })
  const byName: Record<string, typeof members[number]> = {}
  for (const m of members) byName[m.user.username] = m
  const adminId = byName['Pietro'].user.id
  const MICHELE = byName['Michele'].id

  // Snapshot budget + fase
  const budgetSnap = members.map((m) => ({ id: m.id, currentBudget: m.currentBudget }))

  try {
    // ===== Sposta la sessione in PREMI (percorso di produzione) =====
    console.log('[setup] Sposto la sessione in fase PREMI')
    const ph = await setMarketPhase(SID, adminId, 'PREMI')
    check(ph.success === true, 'setMarketPhase → PREMI')

    // ===== INIT =====
    console.log('\n[S1] Inizializzazione fase premi')
    const init = await initializePrizePhase(SID, adminId)
    check(init.success === true, 'initializePrizePhase ok')
    const cfg = await prisma.prizePhaseConfig.findUnique({ where: { marketSessionId: SID } })
    check(cfg?.baseReincrement === 100, `baseReincrement default 100 (=${cfg?.baseReincrement})`)
    const sysCat = await prisma.prizeCategory.findFirst({ where: { marketSessionId: SID, name: 'Indennizzo Partenza Estero' } })
    check(!!sysCat && sysCat.isSystemPrize, 'categoria sistema "Indennizzo Partenza Estero" creata')
    const sysPrizes = await prisma.sessionPrize.count({ where: { prizeCategoryId: sysCat!.id } })
    check(sysPrizes === members.length, `premio indennizzo 50M per ogni membro (${sysPrizes}/${members.length})`)
    const sample = await prisma.sessionPrize.findFirst({ where: { prizeCategoryId: sysCat!.id } })
    check(sample?.amount === 50, `importo indennizzo default 50 (=${sample?.amount})`)
    const reinit = await initializePrizePhase(SID, adminId)
    check(reinit.success === false, 're-inizializzazione rifiutata')

    // ===== BASE REINCREMENT =====
    console.log('\n[S2] Re-incremento base')
    check((await updateBaseReincrement(SID, adminId, 120)).success === true, 'updateBaseReincrement(120) ok')
    check((await prisma.prizePhaseConfig.findUnique({ where: { marketSessionId: SID } }))?.baseReincrement === 120, 'baseReincrement aggiornato a 120')
    check((await updateBaseReincrement(SID, adminId, -5)).success === false, 'importo negativo rifiutato')
    check((await updateBaseReincrement(SID, adminId, 3.5)).success === false, 'importo non intero rifiutato')
    check((await updateBaseReincrement(SID, byName['Michele'].user.id, 200)).success === false, 'non-admin rifiutato')

    // ===== CATEGORIE CUSTOM =====
    console.log('\n[S3] Categorie custom')
    const catRes = await createPrizeCategory(SID, adminId, 'Vincitore Campionato')
    check(catRes.success === true, 'createPrizeCategory ok')
    const CUSTOM_CAT = (catRes.data as { id: string }).id
    check((await createPrizeCategory(SID, adminId, 'Vincitore Campionato')).success === false, 'categoria duplicata rifiutata')
    check((await createPrizeCategory(SID, adminId, '   ')).success === false, 'nome vuoto rifiutato')
    check((await deletePrizeCategory(sysCat!.id, adminId)).success === false, 'eliminazione categoria di sistema rifiutata')

    // ===== PREMI PER MANAGER =====
    console.log('\n[S4] Premi per manager')
    check((await setMemberPrize(CUSTOM_CAT, MICHELE, adminId, 30)).success === true, 'setMemberPrize(Michele,30) ok')
    check((await setMemberPrize(CUSTOM_CAT, MICHELE, adminId, 45)).success === true, 'upsert premio (Michele→45)')
    const mPrize = await prisma.sessionPrize.findUnique({ where: { prizeCategoryId_leagueMemberId: { prizeCategoryId: CUSTOM_CAT, leagueMemberId: MICHELE } } })
    check(mPrize?.amount === 45, `premio Michele = 45 (=${mPrize?.amount})`)
    check((await setMemberPrize(CUSTOM_CAT, MICHELE, adminId, -1)).success === false, 'importo negativo rifiutato')

    // ===== INDENNIZZO ESTERO CUSTOM =====
    console.log('\n[S5] Indennizzo ESTERO custom')
    const sommer = await prisma.serieAPlayer.findFirst({ where: { name: 'Sommer', exitReason: 'ESTERO' } })
    check(!!sommer, 'giocatore ESTERO Sommer presente (seed)')
    if (sommer) {
      const ind = await setCustomIndemnity(SID, sommer.id, adminId, 70)
      check(ind.success === true, 'setCustomIndemnity(Sommer,70) ok')
      const indCat = await prisma.prizeCategory.findFirst({ where: { marketSessionId: SID, name: 'Indennizzo - Sommer' } })
      check(!!indCat && indCat.isSystemPrize, 'categoria sistema "Indennizzo - Sommer" creata')
    }
    const nonEstero = await prisma.serieAPlayer.findFirst({ where: { exitReason: null, listStatus: 'IN_LIST' } })
    if (nonEstero) check((await setCustomIndemnity(SID, nonEstero.id, adminId, 30)).success === false, 'indennizzo su non-ESTERO rifiutato')

    // ===== FINALIZE =====
    console.log('\n[S6] Finalizzazione (accredito budget)')
    const preFinalize = await prisma.leagueMember.findMany({ where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE }, select: { id: true, currentBudget: true } })
    const preMap = new Map(preFinalize.map((m) => [m.id, m.currentBudget]))
    const fin = await finalizePrizePhase(SID, adminId)
    check(fin.success === true, 'finalizePrizePhase ok')
    check((await prisma.prizePhaseConfig.findUnique({ where: { marketSessionId: SID } }))?.isFinalized === true, 'config marcato finalized')
    // Atteso: ogni membro +120 (base); Michele +45 (categoria non-sistema). Indennizzi (sistema) ESCLUSI.
    const postFinalize = await prisma.leagueMember.findMany({ where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE }, select: { id: true, currentBudget: true } })
    let creditErrors = 0
    for (const m of postFinalize) {
      const expectedDelta = 120 + (m.id === MICHELE ? 45 : 0)
      const actualDelta = m.currentBudget - (preMap.get(m.id) ?? 0)
      if (actualDelta !== expectedDelta) { creditErrors++; console.log(`     ! ${m.id}: delta ${actualDelta} != atteso ${expectedDelta}`) }
    }
    check(creditErrors === 0, 'accredito budget = base + premi NON-sistema (indennizzi esclusi)')
    check((await finalizePrizePhase(SID, adminId)).success === false, 're-finalizzazione rifiutata')
    check((await setMemberPrize(CUSTOM_CAT, MICHELE, adminId, 99)).success === false, 'setMemberPrize dopo finalize rifiutato')
    check((await createPrizeCategory(SID, adminId, 'Tardiva')).success === false, 'createPrizeCategory dopo finalize rifiutato')

    // ===== CORREZIONE ADMIN POST-FINALIZE =====
    console.log('\n[S7] Correzione admin post-finalize')
    const micheleBudgetPre = (await prisma.leagueMember.findUnique({ where: { id: MICHELE } }))!.currentBudget
    const corr = await adminCorrectMemberPrize(LEAGUE_ID, adminId, { marketSessionId: SID, categoryId: CUSTOM_CAT, leagueMemberId: MICHELE, newAmount: 60 })
    check(corr.success === true, 'adminCorrectMemberPrize(45→60) ok')
    const micheleBudgetPost = (await prisma.leagueMember.findUnique({ where: { id: MICHELE } }))!.currentBudget
    check(micheleBudgetPost === micheleBudgetPre + 15, `delta +15 applicato al budget (${micheleBudgetPre}→${micheleBudgetPost})`)
    // Correzione su categoria di sistema: NON tocca il budget
    const emmaId = byName['Emmanuele'].id
    const sysBudgetPre = (await prisma.leagueMember.findUnique({ where: { id: emmaId } }))!.currentBudget
    const corrSys = await adminCorrectMemberPrize(LEAGUE_ID, adminId, { marketSessionId: SID, categoryId: sysCat!.id, leagueMemberId: emmaId, newAmount: 80 })
    check(corrSys.success === true, 'adminCorrectMemberPrize su categoria sistema ok')
    const sysBudgetPost = (await prisma.leagueMember.findUnique({ where: { id: emmaId } }))!.currentBudget
    check(sysBudgetPost === sysBudgetPre, `categoria sistema: budget invariato (${sysBudgetPre}→${sysBudgetPost})`)

    // getPrizePhaseData accessibile a un membro
    check((await getPrizePhaseData(SID, byName['Mirko'].user.id)).success === true, 'getPrizePhaseData leggibile da un manager')

  } finally {
    // ===== RESTORE =====
    console.log('\n=== RIPRISTINO STATO ===')
    const cats = await prisma.prizeCategory.findMany({ where: { marketSessionId: SID }, select: { id: true } })
    const catIds = cats.map((c) => c.id)
    const delPrizes = await prisma.sessionPrize.deleteMany({ where: { prizeCategoryId: { in: catIds } } })
    const delCats = await prisma.prizeCategory.deleteMany({ where: { marketSessionId: SID } })
    const delCfg = await prisma.prizePhaseConfig.deleteMany({ where: { marketSessionId: SID } })
    let budgetRestored = 0
    for (const b of budgetSnap) {
      const r = await prisma.leagueMember.updateMany({ where: { id: b.id, NOT: { currentBudget: b.currentBudget } }, data: { currentBudget: b.currentBudget } })
      budgetRestored += r.count
    }
    await prisma.marketSession.update({ where: { id: SID }, data: { currentPhase: startPhase } })
    console.log(`Cancellati ${delPrizes.count} premi, ${delCats.count} categorie, ${delCfg.count} config. Budget ripristinati: ${budgetRestored}. Fase → ${startPhase}.`)
  }

  console.log(`\n===== RISULTATO F4: ${pass} PASS, ${fail} FAIL =====`)
  if (fail > 0) { console.log('FALLITI:'); fails.forEach((f) => console.log('  ✗ ' + f)) }
  else console.log('Backend fase Premi F4 corretto: init, base, categorie, premi, indennizzo ESTERO, finalize (sistema esclusi), correzione post-finalize, validazioni.')
}
main().catch(console.error).finally(() => prisma.$disconnect())
