import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('CORREZIONE BUDGET NEGATIVI')
  console.log('='.repeat(60))

  // Find members with negative budget
  const negativeMembers = await prisma.leagueMember.findMany({
    where: {
      status: 'ACTIVE',
      currentBudget: { lt: 0 }
    },
    include: { user: true }
  })

  if (negativeMembers.length === 0) {
    console.log('\nNessun manager con budget negativo!')
    return
  }

  console.log(`\nTrovati ${negativeMembers.length} manager con budget negativo:\n`)

  for (const member of negativeMembers) {
    console.log(`❌ ${member.teamName}: ${member.currentBudget}M → 0M`)

    await prisma.leagueMember.update({
      where: { id: member.id },
      data: { currentBudget: 0 }
    })
  }

  console.log('\n✅ Budget corretti a 0M')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
