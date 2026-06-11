/**
 * Verifica post-simulazione 3 anni (sola lettura).
 * Usage: bash scripts/with-env.sh .env.local npx tsx scripts/verify-sim-3y.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq1a61zj000938rrglhxl7u2'

async function main(): Promise<void> {
  const sessions = await prisma.marketSession.findMany({
    where: { leagueId: LEAGUE_ID },
    orderBy: { startsAt: 'asc' },
  })
  console.log('--- SESSIONI ---')
  for (const s of sessions) {
    console.log(`${s.type} S${s.season}/${s.semester} ${s.status} starts=${s.startsAt?.toISOString().slice(0, 10)} ends=${s.endsAt?.toISOString().slice(0, 10)} phase=${s.currentPhase}`)
  }

  console.log('--- MOVIMENTI PER SESSIONE (range date) ---')
  for (const s of sessions) {
    const agg = await prisma.playerMovement.aggregate({
      where: { marketSessionId: s.id },
      _count: true,
      _min: { createdAt: true },
      _max: { createdAt: true },
    })
    console.log(`S${s.season}/${s.semester}: ${agg._count} movimenti ${agg._min.createdAt?.toISOString().slice(0, 10)} -> ${agg._max.createdAt?.toISOString().slice(0, 10)}`)
  }

  const spalme = await prisma.contractHistory.count({
    where: { eventType: 'SPALMA', marketSession: { leagueId: LEAGUE_ID } },
  })
  const renewals = await prisma.contractHistory.count({
    where: { eventType: 'RENEWAL', marketSession: { leagueId: LEAGUE_ID } },
  })
  const histTotal = await prisma.contractHistory.count({
    where: { marketSession: { leagueId: LEAGUE_ID } },
  })
  console.log(`--- CONTRACT HISTORY --- spalma=${spalme} renewal=${renewals} totale=${histTotal}`)

  const snaps = await prisma.managerSessionSnapshot.groupBy({
    by: ['snapshotType'],
    where: { marketSession: { leagueId: LEAGUE_ID } },
    _count: true,
  })
  console.log('--- SNAPSHOT ---', snaps.map(s => `${s.snapshotType}=${s._count}`).join(' '))

  const trades = await prisma.tradeOffer.groupBy({
    by: ['status'],
    where: { marketSession: { leagueId: LEAGUE_ID } },
    _count: true,
  })
  console.log('--- TRADE OFFERS ---', trades.map(t => `${t.status}=${t._count}`).join(' '))

  const prophecyRange = await prisma.prophecy.aggregate({
    where: { leagueId: LEAGUE_ID },
    _count: true,
    _min: { createdAt: true },
    _max: { createdAt: true },
  })
  console.log(`--- PROFEZIE --- ${prophecyRange._count} (${prophecyRange._min.createdAt?.toISOString().slice(0, 10)} -> ${prophecyRange._max.createdAt?.toISOString().slice(0, 10)})`)

  // Bilanci finali: budget - monte ingaggi mai negativo
  console.log('--- BILANCI ---')
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    include: { user: { select: { username: true } } },
  })
  for (const m of members) {
    const monte = await prisma.playerContract.aggregate({ where: { leagueMemberId: m.id }, _sum: { salary: true } })
    const bilancio = m.currentBudget - (monte._sum.salary || 0)
    console.log(`${m.user.username}: budget=${m.currentBudget} monte=${monte._sum.salary || 0} bilancio=${bilancio}${bilancio < 0 ? '  <-- NEGATIVO!' : ''}`)
  }

  // Coerenza cross-lega: nessun'altra lega toccata oggi
  const otherLeagueMovs = await prisma.playerMovement.count({
    where: { leagueId: { not: LEAGUE_ID }, createdAt: { gte: new Date('2026-06-11T00:00:00Z') } },
  })
  const otherLeagueSessions = await prisma.marketSession.count({
    where: { leagueId: { not: LEAGUE_ID }, createdAt: { gte: new Date('2026-06-11T00:00:00Z') } },
  })
  console.log(`--- ISOLAMENTO --- movimenti altre leghe (oggi)=${otherLeagueMovs}, sessioni altre leghe (oggi)=${otherLeagueSessions}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
