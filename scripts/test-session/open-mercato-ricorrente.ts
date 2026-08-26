/**
 * Apre il Mercato Ricorrente della Lega test E2E (createAuctionSession con isRegularMarket=true).
 * Parte di default in Fase 1 OFFERTE_PRE_RINNOVO (Scambi) — auction.service.ts:404.
 * Idempotente: se esiste già una sessione ACTIVE non fa nulla.
 *
 * Run: E2E_LEAGUE_ID=<id> bash scripts/with-env.sh .env.local npx tsx scripts/test-session/open-mercato-ricorrente.ts
 */
import { PrismaClient } from '@prisma/client'
import { createAuctionSession } from '../../src/services/auction.service'

const prisma = new PrismaClient()
const LEAGUE_ID = process.env.E2E_LEAGUE_ID
if (!LEAGUE_ID) { console.log('Serve E2E_LEAGUE_ID'); process.exit(1) }

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'pietro@test.it' } })
  if (!admin) { console.log('❌ pietro@test.it non trovato'); return }

  const existingActive = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
  if (existingActive) {
    console.log('Sessione già ACTIVE:', existingActive.id, existingActive.type, existingActive.currentPhase)
    return
  }

  const r = await createAuctionSession(LEAGUE_ID!, admin.id, true)
  if (r.success) {
    const data = r.data as { session: { id: string; type: string; currentPhase: string } }
    console.log('✅ Mercato Ricorrente aperto:', JSON.stringify(data.session))
  } else {
    console.log('❌ createAuctionSession fallita:', r.message)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
