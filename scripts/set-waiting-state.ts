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
  console.log(`Stato attuale: ${session.rubataState}`)

  const updated = await prisma.marketSession.update({
    where: { id: session.id },
    data: {
      rubataState: 'WAITING',
      rubataReadyMembers: null
    }
  })

  console.log(`Nuovo stato: ${updated.rubataState}`)
}
main().finally(() => prisma.$disconnect())
