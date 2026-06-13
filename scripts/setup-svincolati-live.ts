/**
 * Porta una lega alla fase ASTA_SVINCOLATI pronta da giocare (parte dal setup
 * ordine turni). Speculare a setup-rubata-live.ts.
 *
 * Uso:  bash scripts/with-env.sh .env.local npx tsx scripts/setup-svincolati-live.ts
 *       LEAGUE_ID=<id> bash scripts/with-env.sh .env.local npx tsx scripts/setup-svincolati-live.ts
 *
 * Stampa la fase precedente: per ripristinarla, rilancia con RESTORE_PHASE=<fase>.
 */
import { PrismaClient, MarketPhase } from '@prisma/client'

const prisma = new PrismaClient()
// Default: lega "Fantacontratti Test" (quella usata per le prove)
const LEAGUE_ID = process.env.LEAGUE_ID || 'cmq1a61zj000938rrglhxl7u2'
const RESTORE_PHASE = process.env.RESTORE_PHASE as MarketPhase | undefined

async function main() {
  const session = await prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    include: { league: { select: { name: true } } },
  })

  if (!session) {
    console.error(`Nessuna sessione ACTIVE per la lega ${LEAGUE_ID}.`)
    return
  }

  if (RESTORE_PHASE) {
    await prisma.marketSession.update({
      where: { id: session.id },
      data: { currentPhase: RESTORE_PHASE },
    })
    console.log(`Ripristinata fase ${RESTORE_PHASE} sulla lega "${session.league.name}".`)
    return
  }

  console.log(`Lega "${session.league.name}" (${LEAGUE_ID})`)
  console.log(`Fase precedente: ${session.currentPhase}  ← per ripristinarla: RESTORE_PHASE=${session.currentPhase}`)

  await prisma.marketSession.update({
    where: { id: session.id },
    data: {
      currentPhase: MarketPhase.ASTA_SVINCOLATI,
      // stato svincolati pulito → la pagina parte dal SETUP ordine turni
      svincolatiState: null,
      svincolatiTurnOrder: undefined,
      svincolatiCurrentTurnIndex: 0,
      svincolatiReadyMembers: undefined,
      svincolatiPassedMembers: undefined,
      svincolatiFinishedMembers: undefined,
      svincolatiPendingPlayerId: null,
      svincolatiPendingNominatorId: null,
      svincolatiNominatorConfirmed: false,
      svincolatiPendingAck: undefined,
      svincolatiTimerStartedAt: null,
    },
  })

  console.log('\n✅ Lega pronta in ASTA_SVINCOLATI.')
  console.log('   Apri come admin (pietro@test.it):  /leagues/' + LEAGUE_ID + '/svincolati')
  console.log('   → "Conferma e Inizia Aste" → sala asta. Usa il FAB "Test" per simulare scelta/pronti.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => { void prisma.$disconnect() })
