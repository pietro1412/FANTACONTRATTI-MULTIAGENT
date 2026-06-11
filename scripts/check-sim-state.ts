/**
 * Read-only snapshot of the target league state before the 3-year simulation.
 * Usage: bash scripts/with-env.sh .env.local npx tsx scripts/check-sim-state.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq1a61zj000938rrglhxl7u2'

async function main(): Promise<void> {
  const league = await prisma.league.findUnique({
    where: { id: LEAGUE_ID },
    select: {
      id: true, name: true, status: true, currentSeason: true, initialBudget: true,
      goalkeeperSlots: true, defenderSlots: true, midfielderSlots: true, forwardSlots: true,
    },
  })
  console.log('LEAGUE:', JSON.stringify(league, null, 2))

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID },
    include: {
      user: { select: { email: true, username: true } },
      roster: { where: { status: 'ACTIVE' }, include: { player: { select: { name: true, position: true } }, contract: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })
  for (const m of members) {
    console.log(`MEMBER ${m.id} ${m.user.email} role=${m.role} status=${m.status} team="${m.teamName}" budget=${m.currentBudget} roster=${m.roster.length}`)
    for (const r of m.roster) {
      console.log(`   - ${r.player.position} ${r.player.name} price=${r.acquisitionPrice} contract=${r.contract ? `${r.contract.salary}/${r.contract.duration}` : 'NONE'}`)
    }
  }

  const sessions = await prisma.marketSession.findMany({
    where: { leagueId: LEAGUE_ID },
    orderBy: { createdAt: 'asc' },
  })
  for (const s of sessions) {
    console.log(`SESSION ${s.id} type=${s.type} season=${s.season} sem=${s.semester} status=${s.status} phase=${s.currentPhase} role=${s.currentRole} timer=${s.auctionTimerSeconds}`)
  }

  const playerCount = await prisma.serieAPlayer.count({ where: { isActive: true } })
  const byPos = await prisma.serieAPlayer.groupBy({ by: ['position'], where: { isActive: true }, _count: true })
  console.log('ACTIVE SERIE A PLAYERS:', playerCount, JSON.stringify(byPos))

  const movements = await prisma.playerMovement.count({ where: { leagueId: LEAGUE_ID } })
  const prophecies = await prisma.prophecy.count({ where: { leagueId: LEAGUE_ID } })
  const snapshots = await prisma.managerSessionSnapshot.count({ where: { marketSession: { leagueId: LEAGUE_ID } } })
  console.log(`movements=${movements} prophecies=${prophecies} snapshots=${snapshots}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
