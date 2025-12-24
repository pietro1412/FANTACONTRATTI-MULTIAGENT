import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setTimer() {
  const result = await prisma.marketSession.updateMany({
    where: { status: 'ACTIVE' },
    data: { auctionTimerSeconds: 5 }
  })
  console.log(`Updated ${result.count} sessions to 5 second timer`)
  await prisma.$disconnect()
}

setTimer()
