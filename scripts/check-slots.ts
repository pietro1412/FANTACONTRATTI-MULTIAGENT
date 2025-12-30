import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const leagues = await prisma.league.findMany({
    select: {
      name: true,
      goalkeeperSlots: true,
      defenderSlots: true,
      midfielderSlots: true,
      forwardSlots: true,
    }
  })

  console.log('SLOT CONFIGURAZIONE LEGHE:')
  console.log('='.repeat(60))

  for (const l of leagues) {
    const total = l.goalkeeperSlots + l.defenderSlots + l.midfielderSlots + l.forwardSlots
    console.log(`${l.name}:`)
    console.log(`  P=${l.goalkeeperSlots} D=${l.defenderSlots} C=${l.midfielderSlots} A=${l.forwardSlots}`)
    console.log(`  TOTALE: ${total}`)
    console.log('')
  }

  await prisma.$disconnect()
}

main()
