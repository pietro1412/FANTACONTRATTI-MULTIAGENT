import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const league = await prisma.league.findFirst()

  if (!league) {
    console.log('❌ Nessuna lega trovata')
    return
  }

  console.log(`Lega: ${league.name}`)
  console.log(`Status attuale: ${league.status}`)

  if (league.status === 'ACTIVE') {
    console.log('✅ La lega è già attiva')
    return
  }

  await prisma.league.update({
    where: { id: league.id },
    data: { status: 'ACTIVE' }
  })

  console.log('✅ Lega attivata! Nuovo status: ACTIVE')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
