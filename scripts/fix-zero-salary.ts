import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixZeroSalary() {
  // Trova contratti con salary 0 e aggiornali a 1
  const result = await prisma.playerContract.updateMany({
    where: { salary: 0 },
    data: { 
      salary: 1,
      initialSalary: 1,
      rescissionClause: 4 // 1 * 2 * 2 = 4
    }
  })
  
  console.log(`Aggiornati ${result.count} contratti con ingaggio da 0 a 1`)
  await prisma.$disconnect()
}

fixZeroSalary()
