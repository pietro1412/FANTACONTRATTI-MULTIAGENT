import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  try {
    const sessions = await prisma.marketSession.findMany({
      where: { status: 'ACTIVE' },
      include: { league: { select: { name: true } } }
    })
    console.log('\n=== Active Market Sessions ===')
    for (const s of sessions) {
      console.log(`League: ${s.league.name}, Phase: ${s.currentPhase}, Type: ${s.type}`)
    }

    const members = await prisma.leagueMember.findMany({
      where: { status: 'ACTIVE' },
      include: { user: { select: { username: true } }, league: { select: { name: true } } }
    })
    console.log('\n=== Active Members ===')
    for (const m of members) {
      console.log(`${m.user.username} - ${m.league.name} - Budget: ${m.currentBudget} - Team: ${m.teamName || 'N/A'}`)
    }

  } finally {
    await prisma.$disconnect()
  }
}

check()
