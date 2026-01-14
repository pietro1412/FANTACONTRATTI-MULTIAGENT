import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const sessions = await prisma.marketSession.findMany({
    where: { status: 'ACTIVE' },
    include: { league: { select: { name: true } } }
  })
  console.log('Sessioni attive:')
  sessions.forEach(s => console.log(`- ${s.league.name}: fase=${s.currentPhase}, rubataState=${s.rubataState}`))
}
main().finally(() => prisma.$disconnect())
