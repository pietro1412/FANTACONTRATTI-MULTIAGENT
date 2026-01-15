import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const sessions = await prisma.marketSession.findMany({
    where: { status: 'ACTIVE' },
    include: {
      league: { select: { name: true, id: true } },
      prizePhaseConfig: true
    }
  })

  console.log('Active sessions:', sessions.length)
  for (const s of sessions) {
    console.log('---')
    console.log('League:', s.league.name, '(' + s.league.id + ')')
    console.log('Session ID:', s.id)
    console.log('Type:', s.type)
    console.log('Phase:', s.currentPhase)
    console.log('Prize Config Finalized:', s.prizePhaseConfig?.isFinalized ?? 'no config')
  }
}

main().finally(() => prisma.$disconnect())
