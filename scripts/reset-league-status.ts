import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const league = await prisma.league.findFirst({
    orderBy: { createdAt: 'desc' }
  })

  if (!league) {
    console.log('Nessuna lega trovata')
    return
  }

  console.log(`Lega trovata: ${league.name}`)
  console.log(`Stato attuale: ${league.status}`)

  await prisma.league.update({
    where: { id: league.id },
    data: { status: 'DRAFT' }
  })

  console.log('Stato aggiornato a: DRAFT (Creazione Lega)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
