import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

/**
 * Crea o aggiorna il Super Admin di piattaforma.
 *
 * Idempotente (upsert su email). La password va passata in env: NIENTE default.
 * Email/username di default = canonici seed locale (allineati a init-production.ts).
 *
 * ⚠️ PRODUZIONE: l'account reale su Neon è `superadmin@fantacontratti.it`
 * (creato il 18/01/2026, con storico caricamenti quotazioni). Per resettarne
 * la password usare SUPERADMIN_EMAIL=superadmin@fantacontratti.it, NON creare
 * un secondo account `admin@...`.
 *
 * Uso contro il DB di produzione:
 *   $env:SUPERADMIN_PASSWORD="<password-sicura>"
 *   npx dotenv -e .env.vercel -- tsx scripts/create-superadmin.ts
 *
 * Uso contro il DB locale:
 *   $env:SUPERADMIN_PASSWORD="SuperAdmin2025!"
 *   npx dotenv -e .env.local -- tsx scripts/create-superadmin.ts
 */

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SUPERADMIN_EMAIL || 'admin@fantacontratti.it'
  const username = process.env.SUPERADMIN_USERNAME || 'superadmin'
  const password = process.env.SUPERADMIN_PASSWORD

  if (!password || password.length < 12) {
    throw new Error(
      'SUPERADMIN_PASSWORD mancante o troppo corta (>=12 char). Impostala via env prima di eseguire.',
    )
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const admin = await prisma.user.upsert({
    where: { email },
    update: { username, passwordHash, emailVerified: true, isSuperAdmin: true },
    create: { email, username, passwordHash, emailVerified: true, isSuperAdmin: true },
  })

  const target = (process.env.DATABASE_URL || '').includes('localhost') ? 'LOCALE' : 'REMOTO'

  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`      ✅ SUPERADMIN PIATTAFORMA OK (DB ${target})`)
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log(`  Email:     ${admin.email}`)
  console.log(`  Username:  ${admin.username}`)
  console.log(`  Password:  ${password}`)
  console.log(`  isSuperAdmin: ${admin.isSuperAdmin}`)
  console.log(`  ID:        ${admin.id}`)
  console.log('')
}

main()
  .catch((e) => {
    console.error('Errore:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
