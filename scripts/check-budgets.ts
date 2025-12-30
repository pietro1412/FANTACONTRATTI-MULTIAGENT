import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const members = await prisma.leagueMember.findMany({
    where: { status: 'ACTIVE' },
    include: { user: true },
    orderBy: { currentBudget: 'asc' }
  })

  console.log('BUDGET DEI MANAGER:')
  console.log('='.repeat(50))

  for (const m of members) {
    const status = m.currentBudget < 0 ? '❌ NEGATIVO' : '✓'
    console.log(`${m.teamName}: ${m.currentBudget}M ${status}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
