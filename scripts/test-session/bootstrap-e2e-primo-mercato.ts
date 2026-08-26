/**
 * Avvia la Lega test E2E (DRAFT → ACTIVE) e crea la sessione PRIMO_MERCATO iniziale, tramite
 * le funzioni di produzione startLeague + createAuctionSession. Necessario solo la prima volta
 * dopo create-e2e-league.ts (una lega nuova non ha ancora nessuna sessione, quindi
 * reset-e2e-to-first-market-pending.ts — che si aspetta una sessione PRIMO_MERCATO già esistente
 * — non può ancora girare).
 *
 * Run: E2E_LEAGUE_ID=<id> bash scripts/with-env.sh .env.local npx tsx scripts/test-session/bootstrap-e2e-primo-mercato.ts
 */
import { PrismaClient } from '@prisma/client'
import { startLeague } from '../../src/services/league.service'
import { createAuctionSession } from '../../src/services/auction.service'

const prisma = new PrismaClient()
const LEAGUE_ID = process.env.E2E_LEAGUE_ID
if (!LEAGUE_ID) { console.log('Serve E2E_LEAGUE_ID'); process.exit(1) }

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'pietro@test.it' } })
  if (!admin) { console.log('❌ pietro@test.it non trovato'); return }

  const league = await prisma.league.findUnique({ where: { id: LEAGUE_ID } })
  if (!league) { console.log('❌ lega non trovata'); return }

  if (league.status === 'DRAFT') {
    const r = await startLeague(LEAGUE_ID!, admin.id)
    console.log('startLeague:', r.success ? '✅' : `❌ ${r.message}`)
  } else {
    console.log(`Lega già status=${league.status}, salto startLeague`)
  }

  const existingPrimoMercato = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, type: 'PRIMO_MERCATO' } })
  if (existingPrimoMercato) {
    console.log('Sessione PRIMO_MERCATO già esistente:', existingPrimoMercato.id, existingPrimoMercato.status, existingPrimoMercato.currentPhase)
    return
  }

  const r2 = await createAuctionSession(LEAGUE_ID!, admin.id, false)
  if (r2.success) {
    const session = r2.data as { session: { id: string } }
    console.log('✅ Sessione PRIMO_MERCATO creata:', session.session.id)
  } else {
    console.log('❌ createAuctionSession fallita:', r2.message)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
