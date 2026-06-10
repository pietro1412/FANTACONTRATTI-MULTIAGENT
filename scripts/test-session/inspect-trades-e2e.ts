import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
async function main() {
  const trades = await prisma.tradeOffer.findMany({
    where: { leagueId: LEAGUE_ID },
    select: { id: true, status: true, createdAt: true, updatedAt: true,
      fromMember: { select: { user: { select: { username: true } } } },
      toMember: { select: { user: { select: { username: true } } } } },
    orderBy: { createdAt: 'desc' },
  }).catch((e:any)=>{ console.log('tradeOffer err', e.message); return [] as any[] })
  console.log(`TRADE OFFERS: ${trades.length}`)
  for (const t of trades) console.log(`  ${t.status} ${t.fromMember?.user.username}→${t.toMember?.user.username} created=${t.createdAt.toISOString()}`)

  const mov = await prisma.playerMovement.findMany({
    where: { leagueId: LEAGUE_ID, movementType: 'TRADE' },
    select: { createdAt: true, playerId: true },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`\nTRADE movements: ${mov.length}, range ${mov.length?mov[mov.length-1].createdAt.toISOString():''} → ${mov.length?mov[0].createdAt.toISOString():''}`)
}
main().catch(console.error).finally(()=>prisma.$disconnect())
