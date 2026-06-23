/**
 * Imposta la fase della sessione MERCATO_RICORRENTE attiva di una lega
 * (default: "Fantacontratti Test") a una fase data (default: CONTRATTI),
 * per poter vedere/testare l'interfaccia di quella fase in locale.
 *
 * Uso:
 *   npx tsx scripts/setup-contratti-live.ts                       # -> CONTRATTI su "Fantacontratti Test"
 *   npx tsx scripts/setup-contratti-live.ts ASTA_SVINCOLATI       # ripristina la fase precedente
 *   npx tsx scripts/setup-contratti-live.ts CONTRATTI "Altra Lega"
 *
 * Scrive direttamente currentPhase sul DB (come gli altri script reset-to-*),
 * bypassando le validazioni di transizione: è uno strumento di setup locale.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const targetPhase = (process.argv[2] || 'CONTRATTI') as
    | 'ASTA_LIBERA' | 'OFFERTE_PRE_RINNOVO' | 'PREMI' | 'CONTRATTI'
    | 'RUBATA' | 'ASTA_SVINCOLATI' | 'OFFERTE_POST_ASTA_SVINCOLATI'
  const leagueName = process.argv[3] || 'Fantacontratti Test'

  const league = await prisma.league.findFirst({ where: { name: leagueName } })
  if (!league) {
    console.error(`Lega "${leagueName}" non trovata`)
    return
  }

  const session = await prisma.marketSession.findFirst({
    where: { leagueId: league.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) {
    console.error(`Nessuna sessione ACTIVE per la lega "${leagueName}"`)
    return
  }

  if (session.type !== 'MERCATO_RICORRENTE') {
    console.warn(`ATTENZIONE: la sessione attiva è ${session.type}, non MERCATO_RICORRENTE.`)
  }

  const prevPhase = session.currentPhase
  await prisma.marketSession.update({
    where: { id: session.id },
    data: { currentPhase: targetPhase, phaseStartedAt: new Date() },
  })

  console.log(`Lega: ${league.name} (${league.id})`)
  console.log(`Sessione: ${session.type} S${session.season}.${session.semester} (${session.id})`)
  console.log(`Fase: ${prevPhase}  ->  ${targetPhase}`)

  // Entrando in CONTRATTI: rimuovi i record di consolidamento così l'interfaccia
  // torna EDITABILE (i manager non risultano "gia consolidato"). I valori dei
  // contratti restano quelli attuali; questo riattiva solo il flusso di rinnovo.
  if (targetPhase === 'CONTRATTI') {
    const del = await prisma.contractConsolidation.deleteMany({ where: { sessionId: session.id } })
    console.log(`De-consolidamento: rimossi ${del.count} record ContractConsolidation -> contratti EDITABILI.`)
  }
  console.log(`\nPer ripristinare la fase precedente:`)
  console.log(`  npx tsx scripts/setup-contratti-live.ts ${prevPhase} "${leagueName}"`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
