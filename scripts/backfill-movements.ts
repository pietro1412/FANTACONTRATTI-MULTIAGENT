import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmlbe8xy2000912dx55eqxyd7'

async function main() {
  // Get primo mercato session
  const session = await prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID, type: 'PRIMO_MERCATO' },
  })
  console.log('Session:', session?.id, session?.status)

  // Count existing movements
  const existing = await prisma.playerMovement.count({ where: { leagueId: LEAGUE_ID } })
  console.log('Existing movements:', existing)

  // Get all active roster entries
  const rosters = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId: LEAGUE_ID },
      status: 'ACTIVE',
    },
    include: {
      player: true,
      contract: true,
      leagueMember: true,
    },
  })
  console.log('Total roster entries:', rosters.length)

  // Find which already have movements
  const movedPlayerIds = await prisma.playerMovement.findMany({
    where: { leagueId: LEAGUE_ID },
    select: { playerId: true },
  })
  const movedIds = new Set(movedPlayerIds.map(m => m.playerId))

  const missing = rosters.filter(r => !movedIds.has(r.playerId))
  console.log('Missing movements:', missing.length)

  if (missing.length === 0) {
    console.log('Nothing to backfill!')
    await prisma.$disconnect()
    return
  }

  // Create missing movements
  let created = 0
  for (const r of missing) {
    await prisma.playerMovement.create({
      data: {
        leagueId: LEAGUE_ID,
        playerId: r.playerId,
        movementType: 'FIRST_MARKET',
        toMemberId: r.leagueMemberId,
        price: r.acquisitionPrice,
        marketSessionId: session?.id || null,
        newSalary: r.contract?.salary || 1,
        newDuration: r.contract?.duration || 3,
        newClause: r.contract?.rescissionClause || 0,
      },
    })
    created++
    if (created % 50 === 0) console.log(`  Created ${created}/${missing.length}...`)
  }

  console.log(`Done! Created ${created} movements`)

  // Verify
  const total = await prisma.playerMovement.count({ where: { leagueId: LEAGUE_ID } })
  console.log('Total movements now:', total)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
