/**
 * Importa il file quotazioni reale (Excel) nel catalogo SerieAPlayer del DB locale, usando la
 * stessa funzione di produzione dell'endpoint POST /api/superadmin/quotazioni/import, così da
 * avere un catalogo completo (come in prod) invece dei ~130 giocatori "principali" di
 * prisma/seed.ts — necessario per riempire rose complete di 8 manager nella Lega test E2E.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/import-quotazioni-local.ts [percorso-file] [sheetName]
 */
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { importQuotazioni } from '../../src/services/superadmin.service'

const prisma = new PrismaClient()

const filePath = process.argv[2] || 'Quotazioni_Fantacalcio_Stagione_2025_26_fine_mercato_feb_26.xlsx'
const sheetName = process.argv[3] || 'Tutti'

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@fantacontratti.it' } })
  if (!admin) { console.log('❌ superadmin admin@fantacontratti.it non trovato'); return }

  const buffer = readFileSync(filePath)
  console.log(`File: ${filePath} (${(buffer.length / 1024).toFixed(0)}KB), foglio richiesto: "${sheetName}"`)

  const result = await importQuotazioni(admin.id, buffer, sheetName, filePath)
  console.log(JSON.stringify(result, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
