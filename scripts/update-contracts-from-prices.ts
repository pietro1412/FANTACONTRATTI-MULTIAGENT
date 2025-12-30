import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Moltiplicatori clausola rescissoria
const DURATION_MULTIPLIERS: Record<number, number> = {
  1: 4,
  2: 3,
  3: 2,
  4: 1,
}

function calculateRescissionClause(salary: number, duration: number): number {
  const multiplier = DURATION_MULTIPLIERS[duration] ?? 4
  return salary * multiplier
}

async function main() {
  console.log('='.repeat(60))
  console.log('AGGIORNAMENTO CONTRATTI IN BASE AI PREZZI DI ACQUISTO')
  console.log('='.repeat(60))

  // Get all active rosters with contracts
  const rosters = await prisma.playerRoster.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      player: true,
      contract: true,
      leagueMember: {
        include: {
          user: true,
        },
      },
    },
  })

  console.log(`\nTrovati ${rosters.length} giocatori nelle rose\n`)

  let updated = 0
  let created = 0

  for (const roster of rosters) {
    const newSalary = Math.max(1, Math.round(roster.acquisitionPrice * 0.1))
    const duration = roster.contract?.duration ?? 2
    const newClause = calculateRescissionClause(newSalary, duration)

    if (roster.contract) {
      // Update existing contract
      const oldSalary = roster.contract.salary
      const oldClause = roster.contract.rescissionClause

      await prisma.playerContract.update({
        where: { id: roster.contract.id },
        data: {
          salary: newSalary,
          initialSalary: newSalary,
          rescissionClause: newClause,
        },
      })

      console.log(`✏️  ${roster.player.name} (${roster.leagueMember.teamName})`)
      console.log(`    Prezzo acquisto: ${roster.acquisitionPrice}M`)
      console.log(`    Ingaggio: ${oldSalary}M → ${newSalary}M (10%)`)
      console.log(`    Clausola: ${oldClause}M → ${newClause}M`)
      console.log(`    Durata: ${duration} semestri`)
      console.log('')
      updated++
    } else {
      // Create new contract
      await prisma.playerContract.create({
        data: {
          rosterId: roster.id,
          leagueMemberId: roster.leagueMemberId,
          salary: newSalary,
          duration: 2,
          initialSalary: newSalary,
          initialDuration: 2,
          rescissionClause: calculateRescissionClause(newSalary, 2),
        },
      })

      console.log(`➕ ${roster.player.name} (${roster.leagueMember.teamName})`)
      console.log(`    Prezzo acquisto: ${roster.acquisitionPrice}M`)
      console.log(`    Nuovo contratto: ${newSalary}M x 2 semestri`)
      console.log('')
      created++
    }
  }

  console.log('='.repeat(60))
  console.log('RIEPILOGO')
  console.log('='.repeat(60))
  console.log(`Contratti aggiornati: ${updated}`)
  console.log(`Contratti creati: ${created}`)
  console.log(`Totale: ${updated + created}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
