import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
async function main() {
  const contracts = await prisma.playerContract.findMany({
    where: { roster: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' } },
    select: { duration: true },
  })
  const dur: Record<number, number> = {}
  for (const c of contracts) dur[c.duration] = (dur[c.duration]??0)+1
  const total = contracts.length
  const d1 = dur[1] ?? 0
  const ritirati = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE', player: { exitReason: 'RITIRATO', listStatus: 'NOT_IN_LIST' } } })
  const retro = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE', player: { exitReason: 'RETROCESSO', listStatus: 'NOT_IN_LIST' } } })
  const estero = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE', player: { exitReason: 'ESTERO', listStatus: 'NOT_IN_LIST' } } })
  console.log('=== BASELINE PRE-APERTURA F2 ===')
  console.log('Contratti attivi totali:', total)
  console.log('Distribuzione durata:', JSON.stringify(dur))
  console.log(`Usciti in rosa: RITIRATO=${ritirati} (dur 3) RETROCESSO=${retro} (dur 3) ESTERO=${estero} (dur 3)`)
  console.log('\n=== ATTESE DOPO APERTURA MERCATO RICORRENTE ===')
  console.log(`  AUTO_RELEASE_EXPIRED (svincoli scadenza): ${d1}  (contratti a durata 1)`)
  console.log(`  DURATION_DECREMENT: ${total - d1}  (tutti i dur>=2, inclusi i ${ritirati} ritirati 3->2)`)
  console.log(`  RETIREMENT (svincoli ritirati): ${ritirati}`)
  console.log(`  RELEASE movements: ${d1}`)
  console.log(`  Contratti attivi DOPO: ${total - d1 - ritirati}`)
  console.log(`  RETROCESSO/ESTERO mantenuti attivi (a durata 2): ${retro}+${estero}`)
}
main().catch(console.error).finally(()=>prisma.$disconnect())
