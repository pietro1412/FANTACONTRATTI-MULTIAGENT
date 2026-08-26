/**
 * Crea da zero la "Lega test E2E" quando non esiste più nel DB locale (es. dopo un reset del
 * DB Docker) — la vecchia lega con id hardcoded 'cmq3eqxpf06p7xt0cjcjil3qe' referenziata dagli
 * altri script scripts/test-session/*.ts non esiste più in questo ambiente. Crea una lega nuova,
 * ADMIN = pietro@test.it, stessi default delle altre leghe di test (budget 500, slot P3/D8/C8/A6).
 * Stampa il nuovo id da passare come E2E_LEAGUE_ID a tutti gli altri script test-session/*.ts.
 *
 * NON tocca le leghe "vive" (Fantacontratti Test / deew / LEGA TEST FINALE).
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/create-e2e-league.ts
 */
import { PrismaClient } from '@prisma/client'
import { createLeague } from '../../src/services/league.service'

const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'pietro@test.it' } })
  if (!admin) {
    console.log('❌ Utente pietro@test.it non trovato — esegui prima npm run db:seed / init-production')
    return
  }

  const result = await createLeague(admin.id, {
    name: 'Lega test E2E',
    description: 'Lega dedicata ai test automatici scripts/test-session/*.ts — non toccare da UI',
    initialBudget: 500,
    goalkeeperSlots: 3,
    defenderSlots: 8,
    midfielderSlots: 8,
    forwardSlots: 6,
    isPublic: false,
    teamName: 'Pietro Test E2E',
  })

  if (!result.success) {
    console.log('❌ Creazione fallita:', result.message)
    return
  }

  const league = result.data as { id: string; name: string }
  console.log(`✅ Lega creata: ${league.name}`)
  console.log(`   id: ${league.id}`)
  console.log(`\nUsa questo id per gli altri script:`)
  console.log(`   E2E_LEAGUE_ID=${league.id} bash scripts/with-env.sh .env.local npx tsx scripts/test-session/complete-lega-e2e.ts`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
