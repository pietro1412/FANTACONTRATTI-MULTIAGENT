import { PrismaClient, TradeStatus } from '@prisma/client'

const prisma = new PrismaClient()

const LEAGUE_ID = 'cmk9hsvuc00019uhl8r906gee'

async function main() {
  // Prima elimino le offerte precedenti errate
  console.log('🧹 Elimino offerte precedenti...')
  await prisma.tradeOffer.deleteMany({
    where: {
      marketSession: { leagueId: LEAGUE_ID }
    }
  })

  // Trova pietro e il suo userId
  const pietro = await prisma.leagueMember.findFirst({
    where: {
      leagueId: LEAGUE_ID,
      user: { username: 'pietro' }
    },
    include: {
      user: true,
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: true }
      }
    }
  })

  if (!pietro) {
    console.log('❌ Pietro non trovato')
    return
  }

  console.log(`\n👤 Pietro trovato: ${pietro.user.username}`)
  console.log(`   Rosa: ${pietro.roster.length} giocatori`)

  // Trova altri manager con giocatori
  const otherManagers = await prisma.leagueMember.findMany({
    where: {
      leagueId: LEAGUE_ID,
      id: { not: pietro.id },
      roster: { some: { status: 'ACTIVE' } }
    },
    include: {
      user: true,
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: true }
      }
    },
    take: 2
  })

  if (otherManagers.length === 0) {
    console.log('❌ Nessun altro manager con giocatori trovato')
    return
  }

  console.log(`\n📊 Trovati ${otherManagers.length} manager con giocatori`)

  // Trova la sessione attiva
  const session = await prisma.marketSession.findFirst({
    where: {
      leagueId: LEAGUE_ID,
      status: 'ACTIVE'
    }
  })

  if (!session) {
    console.log('❌ Nessuna sessione di mercato attiva')
    return
  }

  console.log(`\n📅 Sessione attiva: ${session.type} - Fase: ${session.currentPhase}`)

  if (pietro.roster.length === 0) {
    console.log('❌ Pietro non ha giocatori nella rosa')
    return
  }

  let offersCreated = 0

  for (const manager of otherManagers) {
    if (manager.roster.length === 0) {
      console.log(`⚠️  ${manager.user.username} non ha giocatori`)
      continue
    }

    // Prendi un giocatore del manager
    const offeredRoster = manager.roster[offersCreated]
    // Prendi un giocatore di pietro
    const requestedRoster = pietro.roster[offersCreated]

    if (!offeredRoster || !requestedRoster) continue

    // Array di ROSTER IDs (non player IDs!)
    const offeredRosterIds = [offeredRoster.id]
    const requestedRosterIds = [requestedRoster.id]
    // involvedPlayers contiene tutti i playerId coinvolti
    const involvedPlayerIds = [offeredRoster.playerId, requestedRoster.playerId]

    const budgetOffered = Math.floor(Math.random() * 15) + 5 // 5-20M

    // Crea l'offerta di scambio
    const offer = await prisma.tradeOffer.create({
      data: {
        marketSessionId: session.id,
        senderId: manager.userId,
        receiverId: pietro.userId,
        status: TradeStatus.PENDING,
        offeredPlayers: offeredRosterIds,      // roster IDs!
        requestedPlayers: requestedRosterIds,  // roster IDs!
        involvedPlayers: involvedPlayerIds,    // player IDs per vincolo anti-ritroso
        offeredBudget: budgetOffered,
        requestedBudget: 0,
        message: `Ciao Pietro! Ti propongo ${offeredRoster.player.name} + ${budgetOffered}M per ${requestedRoster.player.name}. Che ne dici?`
      }
    })

    console.log(`\n✅ Offerta creata:`)
    console.log(`   Da: ${manager.user.username}`)
    console.log(`   Offre: ${offeredRoster.player.name} (${offeredRoster.player.position}) + ${budgetOffered}M`)
    console.log(`   Chiede: ${requestedRoster.player.name} (${requestedRoster.player.position})`)
    console.log(`   ID: ${offer.id}`)

    offersCreated++
  }

  console.log(`\n🎉 Create ${offersCreated} offerte di scambio per Pietro!`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
