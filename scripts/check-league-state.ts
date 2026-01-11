import { PrismaClient, AuctionStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const league = await prisma.league.findUnique({
    where: { id: 'cmk9hsvuc00019uhl8r906gee' },
    include: {
      members: { include: { user: true } },
      marketSessions: true
    }
  })

  if (!league) {
    console.log('Lega non trovata')
    return
  }

  console.log('Lega:', league.name)
  console.log('Status:', league.status)
  console.log('Sessioni:', league.marketSessions.length)

  if (league.marketSessions.length > 0) {
    const session = league.marketSessions[0]
    console.log('\nSessione:')
    console.log('  ID:', session.id)
    console.log('  Tipo:', session.type)
    console.log('  Status:', session.status)
    console.log('  Fase:', session.currentPhase)

    // Check for active auctions
    const activeAuction = await prisma.auction.findFirst({
      where: {
        sessionId: session.id,
        status: AuctionStatus.IN_PROGRESS
      },
      include: { player: true }
    })

    if (activeAuction) {
      console.log('\n  Asta attiva:')
      console.log('    Giocatore:', activeAuction.player.name)
      console.log('    Prezzo:', activeAuction.currentPrice)
    } else {
      console.log('\n  Nessuna asta attiva')
    }
  }

  console.log('\nMembri:')
  league.members.forEach(m => {
    console.log(`  - ${m.id} | ${m.user.username} (${m.role}) - Budget: ${m.currentBudget}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
