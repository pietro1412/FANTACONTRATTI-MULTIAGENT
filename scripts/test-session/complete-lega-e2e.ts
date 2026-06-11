/**
 * Sessione test 2026-06-07 — completa "Lega test E2E" con i manager seedati reali.
 * Porta la lega a 8 membri ACTIVE (Pietro admin + 7 manager @test.it) per avviare il Primo Mercato.
 * Idempotente: riattiva membri LEFT, crea i mancanti, riassegna firstMarketOrder.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/complete-lega-e2e.ts
 */
import { PrismaClient, MemberRole, MemberStatus, JoinType } from '@prisma/client'

const prisma = new PrismaClient()

const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'

// Manager seedati reali (oltre a Pietro admin). teamName arbitrario per il test.
const MANAGERS = [
  { email: 'michele@test.it', teamName: 'Michele FC' },
  { email: 'mirko@test.it', teamName: 'Mirko United' },
  { email: 'emmanuele@test.it', teamName: 'Emmanuele City' },
  { email: 'diego@test.it', teamName: 'Diego Stars' },
  { email: 'marco@test.it', teamName: 'Marco XI' },
  { email: 'marcolino@test.it', teamName: 'Marcolino FC' },
  { email: 'emiliano@test.it', teamName: 'Emiliano Town' },
]

async function main() {
  const league = await prisma.league.findUnique({
    where: { id: LEAGUE_ID },
    include: { members: { include: { user: true } } },
  })
  if (!league) {
    console.log('❌ Lega non trovata:', LEAGUE_ID)
    return
  }
  console.log(`📋 Lega: ${league.name} (status ${league.status}, budget ${league.initialBudget})`)

  // firstMarketOrder: admin per primo (0), poi i manager nell'ordine elencato
  const admin = league.members.find((m) => m.role === MemberRole.ADMIN)
  if (admin) {
    await prisma.leagueMember.update({
      where: { id: admin.id },
      data: { firstMarketOrder: 0 },
    })
    console.log(`   ⚙️  Admin ${admin.user.username} → firstMarketOrder 0`)
  }

  let order = 1
  for (const mgr of MANAGERS) {
    const user = await prisma.user.findUnique({ where: { email: mgr.email } })
    if (!user) {
      console.log(`   ⚠️  Utente non trovato: ${mgr.email} — salto`)
      continue
    }
    const existing = await prisma.leagueMember.findUnique({
      where: { userId_leagueId: { userId: user.id, leagueId: LEAGUE_ID } },
    })
    if (existing) {
      await prisma.leagueMember.update({
        where: { id: existing.id },
        data: {
          status: MemberStatus.ACTIVE,
          role: MemberRole.MANAGER,
          teamName: mgr.teamName,
          currentBudget: league.initialBudget,
          firstMarketOrder: order,
        },
      })
      console.log(`   ♻️  Riattivato ${user.username} (${mgr.teamName}) → ordine ${order}`)
    } else {
      await prisma.leagueMember.create({
        data: {
          userId: user.id,
          leagueId: LEAGUE_ID,
          role: MemberRole.MANAGER,
          teamName: mgr.teamName,
          status: MemberStatus.ACTIVE,
          joinType: JoinType.REQUEST,
          currentBudget: league.initialBudget,
          firstMarketOrder: order,
        },
      })
      console.log(`   ✅ Aggiunto ${user.username} (${mgr.teamName}) → ordine ${order}`)
    }
    order++
  }

  const updated = await prisma.league.findUnique({
    where: { id: LEAGUE_ID },
    include: { members: { where: { status: MemberStatus.ACTIVE }, include: { user: true } } },
  })
  console.log(`\n👥 Membri ACTIVE: ${updated?.members.length}`)
  updated?.members
    .sort((a, b) => (a.firstMarketOrder ?? 99) - (b.firstMarketOrder ?? 99))
    .forEach((m) => console.log(`   ${m.firstMarketOrder}. ${m.user.username} — ${m.teamName} (${m.role})`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
