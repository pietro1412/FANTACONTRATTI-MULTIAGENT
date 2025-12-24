import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  const sessions = await prisma.marketSession.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  console.log('=== MARKET SESSIONS ===')
  for (const s of sessions) {
    console.log(`ID: ${s.id}`)
    console.log(`  Type: ${s.type}`)
    console.log(`  Status: ${s.status}`)
    console.log(`  Phase: ${s.currentPhase}`)
    console.log('')
  }

  await prisma.$disconnect()
}
check()
