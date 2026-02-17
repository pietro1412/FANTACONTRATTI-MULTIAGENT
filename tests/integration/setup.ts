/**
 * Integration test setup — connessione a PostgreSQL locale (porta 5434)
 *
 * Prerequisiti:
 *   docker compose up db-test -d --wait
 *   bash scripts/with-env.sh .env.test npx prisma db push --schema=prisma/schema.generated.prisma --accept-data-loss
 */
import { PrismaClient } from '@prisma/client'

// Verifica che puntiamo al DB test e non a Neon
const dbUrl = process.env.DATABASE_URL || ''
if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
  throw new Error(
    `SAFETY CHECK: DATABASE_URL non punta a localhost!\n` +
    `Valore attuale: ${dbUrl.slice(0, 50)}...\n` +
    `Esegui i test con: bash scripts/with-env.sh .env.test npx vitest run -c vitest.integration.config.ts`
  )
}

export const testPrisma = new PrismaClient({
  log: ['error'],
})

beforeAll(async () => {
  // Verifica connessione al DB test
  await testPrisma.$queryRaw`SELECT 1`
})

afterAll(async () => {
  await testPrisma.$disconnect()
})
