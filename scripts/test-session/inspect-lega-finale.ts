/**
 * Inspect "Lega Finale" leagues + Diego's memberships (read-only).
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/inspect-lega-finale.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const leagues = await prisma.league.findMany({
    where: { name: { contains: 'Finale', mode: 'insensitive' } },
    include: {
      members: {
        include: { user: { select: { username: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  console.log(`Leghe trovate con "Finale" nel nome: ${leagues.length}\n`)
  for (const l of leagues) {
    console.log(`=== ${l.name} (id ${l.id}) — status lega: ${l.status} ===`)
    for (const m of l.members) {
      console.log(`  - ${m.user.username} <${m.user.email}> | role=${m.role} | status=${m.status} | joinType=${m.joinType} | team=${m.teamName ?? '-'}`)
    }
    console.log('')
  }

  const diego = await prisma.user.findFirst({ where: { email: 'diego@test.it' } })
  console.log(`Diego userId: ${diego?.id ?? 'NON TROVATO'}`)
  if (diego) {
    const memberships = await prisma.leagueMember.findMany({
      where: { userId: diego.id },
      include: { league: { select: { name: true, status: true } } },
    })
    console.log(`\nTutte le membership di Diego (${memberships.length}):`)
    for (const m of memberships) {
      console.log(`  - lega "${m.league.name}" (lega:${m.league.status}) | role=${m.role} | status=${m.status} | joinType=${m.joinType}`)
    }
  }
}

main().catch(console.error).finally(() => void prisma.$disconnect())
