/**
 * Script per riportare la lega alla fase di scelta ordine rubata
 * (dopo consolidamento rinnovi, prima della generazione tabellone)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Trova la sessione attiva
  const session = await prisma.marketSession.findFirst({
    where: {
      status: 'ACTIVE',
    },
    include: {
      league: true,
    },
  })

  if (!session) {
    console.log('Nessuna sessione attiva trovata')
    return
  }

  console.log(`Sessione trovata: ${session.id}`)
  console.log(`Lega: ${session.league.name}`)
  console.log(`Fase corrente: ${session.currentPhase}`)
  console.log(`Stato rubata: ${session.rubataState}`)

  // Aggiorna la sessione
  const updated = await prisma.marketSession.update({
    where: { id: session.id },
    data: {
      currentPhase: 'RUBATA',
      rubataState: 'WAITING',
      rubataBoard: null,
      rubataBoardIndex: null,
      rubataReadyMembers: null,
      rubataAuctionReadyInfo: null,
      rubataPendingAck: null,
      rubataTimerStartedAt: null,
      rubataPausedRemainingSeconds: null,
      rubataPausedFromState: null,
    },
  })

  console.log('\n✅ Sessione aggiornata:')
  console.log(`- Fase: ${updated.currentPhase}`)
  console.log(`- Stato rubata: ${updated.rubataState}`)
  console.log(`- Tabellone: ${updated.rubataBoard ? 'presente' : 'da generare'}`)

  // Trova aste rubata esistenti
  const rubataAuctions = await prisma.auction.findMany({
    where: {
      marketSessionId: session.id,
      type: 'RUBATA',
    },
    select: { id: true },
  })

  const auctionIds = rubataAuctions.map(a => a.id)

  if (auctionIds.length > 0) {
    // Elimina prima i record collegati
    await prisma.auctionBid.deleteMany({
      where: { auctionId: { in: auctionIds } },
    })
    await prisma.auctionAcknowledgment.deleteMany({
      where: { auctionId: { in: auctionIds } },
    })
    await prisma.auctionAppeal.deleteMany({
      where: { auctionId: { in: auctionIds } },
    })
    // Poi elimina le aste
    const deletedAuctions = await prisma.auction.deleteMany({
      where: { id: { in: auctionIds } },
    })
    console.log(`\n🗑️ Aste rubata eliminate: ${deletedAuctions.count}`)
  } else {
    console.log(`\n🗑️ Nessuna asta rubata da eliminare`)
  }

  // Elimina eventuali preferenze rubata esistenti
  const deletedPrefs = await prisma.rubataPreference.deleteMany({
    where: {
      sessionId: session.id,
    },
  })

  console.log(`🗑️ Preferenze rubata eliminate: ${deletedPrefs.count}`)

  // Mostra i membri con il loro ordine rubata attuale
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: 'ACTIVE',
    },
    include: {
      user: true,
    },
    orderBy: {
      rubataOrder: 'asc',
    },
  })

  console.log('\n👥 Membri della lega (ordine rubata attuale):')
  members.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.user.username} - ordine: ${m.rubataOrder ?? 'non impostato'}`)
  })

  console.log('\n✅ Lega pronta per la scelta dell\'ordine rubata!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
