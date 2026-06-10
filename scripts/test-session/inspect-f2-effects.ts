import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
const RECURRENT_SESSION = 'cmq6fav4j04kzx6pmj7cuykq3'

async function main() {
  // History entries grouped by event type for the recurrent session
  const hist = await prisma.contractHistory.groupBy({
    by: ['eventType'],
    where: { marketSessionId: RECURRENT_SESSION },
    _count: true,
  }).catch((e:any)=>{ console.log('contractHistory groupBy err', e.message); return [] })
  console.log('HISTORY by eventType (recurrent session):', JSON.stringify(hist))

  // Movements for the recurrent session
  const mov = await prisma.playerMovement.groupBy({
    by: ['movementType'],
    where: { marketSessionId: RECURRENT_SESSION },
    _count: true,
  }).catch((e:any)=>{ console.log('playerMovement groupBy err', e.message); return [] })
  console.log('MOVEMENTS by type (recurrent session):', JSON.stringify(mov))

  // Released rosters in this league
  const released = await prisma.playerRoster.count({
    where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'RELEASED' },
  })
  console.log('RELEASED rosters in league (total):', released)

  // Active contracts duration distribution now
  const contracts = await prisma.playerContract.findMany({
    where: { roster: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' } },
    select: { duration: true },
  })
  const dur: Record<number, number> = {}
  for (const c of contracts) dur[c.duration] = (dur[c.duration]??0)+1
  console.log('ACTIVE contracts duration distribution NOW:', JSON.stringify(dur), 'total', contracts.length)

  // Session timestamps
  const s = await prisma.marketSession.findUnique({ where: { id: RECURRENT_SESSION },
    select: { createdAt: true, startsAt: true, phaseStartedAt: true } })
  console.log('RECURRENT SESSION times:', JSON.stringify(s))

  // Any RITIRATO players in league rosters
  const ritirati = await prisma.playerRoster.count({
    where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE',
      player: { exitReason: 'RITIRATO' } },
  })
  console.log('Active RITIRATO players still in rosters:', ritirati)
}
main().catch(console.error).finally(()=>prisma.$disconnect())
