import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  const league = await prisma.league.findFirst({ where: { name: 'Lega Fantacontratti 2025' } })
  if (!league) { console.log('No league'); return }

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: league.id, status: 'ACTIVE' },
    include: {
      user: { select: { username: true } },
      roster: { where: { status: 'ACTIVE' }, include: { player: true } }
    }
  })

  console.log('Members with rosters:')
  for (const m of members) {
    console.log(`  ${m.user.username}: ${m.roster.length} players`)
  }

  await prisma.$disconnect()
}
test()
