import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { username: { contains: 'pietro', mode: 'insensitive' } },
    select: { id: true, username: true, email: true }
  })
  console.log('Users found:', users)
}

main().finally(() => prisma.$disconnect())
