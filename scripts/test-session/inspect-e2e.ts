/**
 * Inspect the E2E league current state (read-only).
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/inspect-e2e.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
const SESSION_ID = 'cmq3g2qvz07saxt0cfywwjfdv'

async function main() {
  const league = await prisma.league.findUnique({ where: { id: LEAGUE_ID } })
  console.log('LEAGUE:', JSON.stringify({
    name: league?.name,
    status: league?.status,
    currentSeason: league?.currentSeason,
    initialBudget: league?.initialBudget,
    slots: { P: league?.goalkeeperSlots, D: league?.defenderSlots, C: league?.midfielderSlots, A: league?.forwardSlots },
  }, null, 2))

  const session = await prisma.marketSession.findUnique({ where: { id: SESSION_ID } })
  console.log('SESSION:', JSON.stringify({
    type: session?.type, status: session?.status, phase: session?.currentPhase,
    season: session?.season, semester: session?.semester, currentRole: session?.currentRole,
  }, null, 2))

  const otherSessions = await prisma.marketSession.findMany({
    where: { leagueId: LEAGUE_ID }, select: { id: true, type: true, status: true, currentPhase: true },
  })
  console.log('ALL SESSIONS:', JSON.stringify(otherSessions, null, 2))

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    include: {
      user: { select: { username: true, email: true } },
      roster: { where: { status: 'ACTIVE' }, include: { player: { select: { position: true } }, contract: true } },
    },
    orderBy: { firstMarketOrder: 'asc' },
  })
  console.log(`\nACTIVE MEMBERS: ${members.length}`)
  for (const m of members) {
    const counts: Record<string, number> = { P: 0, D: 0, C: 0, A: 0 }
    let withContract = 0
    for (const r of m.roster) {
      counts[r.player.position] = (counts[r.player.position] ?? 0) + 1
      if (r.contract) withContract++
    }
    console.log(`  ${m.role} ${m.user.username} (${m.user.email}) budget=${m.currentBudget} roster=${m.roster.length} P${counts.P} D${counts.D} C${counts.C} A${counts.A} contracts=${withContract}`)
  }

  // Player availability
  const total = await prisma.serieAPlayer.count()
  const byPos = await prisma.serieAPlayer.groupBy({ by: ['position'], _count: true })
  console.log('\nPLAYERS total:', total, 'byPos:', JSON.stringify(byPos))

  // Players already in this league's active rosters
  const usedRosters = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' },
    select: { playerId: true },
  })
  console.log('Players currently in ACTIVE rosters of this league:', usedRosters.length)
}

main().catch(console.error).finally(() => prisma.$disconnect())
