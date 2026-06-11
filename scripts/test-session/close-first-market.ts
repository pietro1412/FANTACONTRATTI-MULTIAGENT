/**
 * Sessione test 2026-06-08 — chiude il PRIMO MERCATO della "Lega test E2E" usando il
 * service di produzione closeAuctionSession (stessa logica del bottone admin "Chiudi sessione").
 *
 * Effetto: cancella eventuali aste ACTIVE, crea contratti automatici SOLO per rose senza
 * contratto (qui 0, perché lo script di fill li ha già creati con durate varie), marca la
 * sessione PRIMO_MERCATO come COMPLETED. NON apre il Mercato Ricorrente.
 *
 * Idempotente: se la sessione è già COMPLETED non fa nulla.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/close-first-market.ts
 */
import { PrismaClient } from '@prisma/client'
import { closeAuctionSession } from '../../src/services/auction.service'

const prisma = new PrismaClient()
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
const ADMIN_EMAIL = 'pietro@test.it'

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    console.log('ERRORE: admin non trovato', ADMIN_EMAIL)
    return
  }

  const session = await prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID, type: 'PRIMO_MERCATO' },
  })
  if (!session) {
    console.log('ERRORE: nessuna sessione PRIMO_MERCATO nella lega')
    return
  }

  if (session.status === 'COMPLETED') {
    console.log('Sessione PRIMO_MERCATO già COMPLETED — niente da fare.')
    return
  }

  console.log(`Chiusura PRIMO_MERCATO ${session.id} (fase ${session.currentPhase}) come admin ${ADMIN_EMAIL}...`)
  const result = await closeAuctionSession(session.id, admin.id)
  console.log('Risultato closeAuctionSession:', JSON.stringify(result))

  const after = await prisma.marketSession.findUnique({
    where: { id: session.id },
    select: { type: true, status: true, currentPhase: true, endsAt: true },
  })
  console.log('Sessione dopo:', JSON.stringify(after))

  // Verifica: nessuna sessione ACTIVE residua (necessario perché l'apertura del Mercato
  // Ricorrente rifiuta se esiste una sessione ACTIVE).
  const activeCount = await prisma.marketSession.count({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
  console.log(`Sessioni ACTIVE residue nella lega: ${activeCount} ${activeCount === 0 ? '(OK, pronta per Mercato Ricorrente)' : '(ATTENZIONE: bloccherà apertura)'}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
