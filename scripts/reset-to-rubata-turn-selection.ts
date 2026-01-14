import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Trova la sessione della lega di test
  const session = await prisma.marketSession.findFirst({
    where: {
      status: 'ACTIVE',
      league: { name: { contains: 'Mario' } }
    },
    include: { league: true }
  })

  if (!session) {
    console.log('Sessione non trovata')
    return
  }

  console.log(`Trovata: ${session.league.name}`)
  console.log(`Stato attuale: fase=${session.currentPhase}, rubataState=${session.rubataState}`)

  // Reset completo: rimuovi tabellone e ordine
  const updated = await prisma.marketSession.update({
    where: { id: session.id },
    data: {
      currentPhase: 'RUBATA',
      rubataState: null,  // null = deve ancora impostare ordine
      rubataBoard: null,
      rubataBoardIndex: null,
      rubataOrder: null,  // Rimuovi ordine
      rubataReadyMembers: null,
      rubataAuctionReadyInfo: null,
      rubataPendingAck: null,
      rubataTimerStartedAt: null,
      rubataPausedRemainingSeconds: null,
      rubataPausedFromState: null,
    }
  })

  console.log(`\n✅ Sessione resettata:`)
  console.log(`- Fase: ${updated.currentPhase}`)
  console.log(`- rubataState: ${updated.rubataState}`)
  console.log(`- rubataBoard: ${updated.rubataBoard ? 'presente' : 'da generare'}`)
  console.log(`- rubataOrder: ${updated.rubataOrder ? 'impostato' : 'da impostare'}`)

  // Reset anche rubataOrder sui membri
  await prisma.leagueMember.updateMany({
    where: { leagueId: session.leagueId },
    data: { rubataOrder: null }
  })

  console.log(`\n✅ Ordine rubata rimosso da tutti i membri`)

  // Elimina preferenze rubata
  const deletedPrefs = await prisma.rubataPreference.deleteMany({
    where: { sessionId: session.id }
  })
  console.log(`🗑️ Preferenze eliminate: ${deletedPrefs.count}`)

  console.log(`\n✅ Ora l'admin deve impostare l'ordine turni rubata!`)
}

main().finally(() => prisma.$disconnect())
