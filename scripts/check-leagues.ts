import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const leagues = await prisma.league.findMany({
    include: {
      members: {
        include: { user: { select: { username: true, email: true } } }
      }
    }
  })

  console.log('=== LEGHE ===')
  for (const league of leagues) {
    console.log('Lega:', league.name, '- Status:', league.status)
    console.log('Min/Max partecipanti:', league.minParticipants, '/', league.maxParticipants)
    console.log('Membri:')
    for (const m of league.members) {
      console.log('  -', m.user.username, '(' + m.role + ')', 'Status:', m.status)
    }
    console.log('')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
