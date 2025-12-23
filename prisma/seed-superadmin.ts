import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('SuperAdmin123!', 10)

  const superAdmin = await prisma.user.upsert({
    where: { username: 'super_admin' },
    update: {
      isSuperAdmin: true,
    },
    create: {
      email: 'superadmin@fantacontratti.local',
      username: 'super_admin',
      passwordHash,
      emailVerified: true,
      isSuperAdmin: true,
    },
  })

  console.log('Superadmin creato/aggiornato:', {
    id: superAdmin.id,
    username: superAdmin.username,
    email: superAdmin.email,
    isSuperAdmin: superAdmin.isSuperAdmin,
  })
  console.log('')
  console.log('Credenziali:')
  console.log('  Username: super_admin')
  console.log('  Password: SuperAdmin123!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
