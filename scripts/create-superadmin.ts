import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = 'superadmin'
  const email = 'superadmin@fantacontratti.it'
  const password = 'SuperAdmin2025!'

  const passwordHash = await bcrypt.hash(password, 10)

  const admin = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      emailVerified: true,
      isSuperAdmin: true,
    },
  })

  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('          ✅ SUPERADMIN PIATTAFORMA CREATO')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log(`  Username:  ${username}`)
  console.log(`  Email:     ${email}`)
  console.log(`  Password:  ${password}`)
  console.log('')
  console.log(`  ID: ${admin.id}`)
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
