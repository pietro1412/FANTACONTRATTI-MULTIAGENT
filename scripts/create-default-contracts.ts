import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Crea contratti default per tutti i giocatori senza contratto
 * Ingaggio: 10% del costo di acquisto (arrotondato a 0.5)
 * Durata: 2 semestri
 */
async function createDefaultContracts() {
  console.log('🔍 Cercando giocatori senza contratto...\n')

  // Trova tutti i roster entry attivi senza contratto
  const rostersWithoutContract = await prisma.playerRoster.findMany({
    where: {
      status: 'ACTIVE',
      contract: null
    },
    include: {
      player: true,
      leagueMember: {
        include: { user: { select: { username: true } } }
      }
    }
  })

  console.log(`📋 Trovati ${rostersWithoutContract.length} giocatori senza contratto\n`)

  let created = 0
  for (const roster of rostersWithoutContract) {
    // Calcola ingaggio: 10% del costo, arrotondato a 0.5
    const rawSalary = roster.acquisitionPrice * 0.1
    const salary = Math.round(rawSalary * 2) / 2 // Arrotonda a 0.5
    const duration = 2 // 2 semestri

    // Clausola rescissoria: salary * duration * 2 (o formula custom)
    const rescissionClause = Math.round(salary * duration * 2)

    await prisma.playerContract.create({
      data: {
        rosterId: roster.id,
        leagueMemberId: roster.leagueMemberId,
        salary: salary,
        duration: duration,
        initialSalary: salary,
        initialDuration: duration,
        rescissionClause: rescissionClause
      }
    })

    console.log(`✅ ${roster.player.name} (${roster.leagueMember.user.username}): ${salary}M x ${duration}sem [clausola: ${rescissionClause}M]`)
    created++
  }

  console.log(`\n🎉 Creati ${created} contratti default!`)

  await prisma.$disconnect()
}

createDefaultContracts().catch(console.error)
