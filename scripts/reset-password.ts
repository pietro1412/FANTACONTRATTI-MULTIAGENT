import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const newPassword = 'test123'
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  
  const updated = await prisma.user.update({
    where: { username: 'pietro' },
    data: { passwordHash: hashedPassword },
    select: { username: true, email: true }
  })
  
  console.log('Password reset for:', updated.username)
  console.log('Email:', updated.email)
  console.log('New password: test123')
}

main().finally(() => prisma.$disconnect())
