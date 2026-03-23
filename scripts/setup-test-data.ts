import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmlbe8xy2000912dx55eqxyd7'

async function main() {
  console.log('=== Setting up test data ===')

  // 1. Mark 3 players for indemnity testing
  const rosters = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' },
    include: {
      player: true,
      leagueMember: { select: { id: true, user: { select: { username: true } } } },
    },
    take: 50,
  })

  const seen = new Set<string>()
  const reasons = ['ESTERO', 'RETROCESSO', 'RITIRATO'] as const
  let i = 0

  for (const r of rosters) {
    if (i >= 3) break
    if (seen.has(r.leagueMember.id)) continue
    seen.add(r.leagueMember.id)

    await prisma.serieAPlayer.update({
      where: { id: r.playerId },
      data: {
        listStatus: 'NOT_IN_LIST',
        exitReason: reasons[i],
        exitDate: new Date(),
      },
    })

    console.log(`  ${r.player.name} (${r.leagueMember.user.username}) -> ${reasons[i]}`)
    i++
  }
  console.log(`Marked ${i} players for indemnity\n`)

  // 2. Check current state
  const sessions = await prisma.marketSession.findMany({
    where: { leagueId: LEAGUE_ID },
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, status: true, currentPhase: true },
  })
  console.log('Sessions:')
  sessions.forEach(s => console.log(`  ${s.type} ${s.status} (${s.currentPhase})`))

  // 3. Get svincolati count (players without roster in this league)
  const rosterPlayerIds = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' },
    select: { playerId: true },
  })
  const takenIds = new Set(rosterPlayerIds.map(r => r.playerId))
  const freeAgents = await prisma.serieAPlayer.count({
    where: { isActive: true, listStatus: 'IN_LIST', id: { notIn: Array.from(takenIds) } },
  })
  console.log(`\nFree agents available: ${freeAgents}`)

  await prisma.$disconnect()
  console.log('\nDone!')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
