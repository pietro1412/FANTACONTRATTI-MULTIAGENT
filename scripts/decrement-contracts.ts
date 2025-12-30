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
  console.log('DECREMENTO DURATA CONTRATTI (-1 SEMESTRE)')
  console.log('='.repeat(60))

  // Get all active contracts
  const contracts = await prisma.playerContract.findMany({
    where: {
      roster: {
        status: 'ACTIVE',
      },
    },
    include: {
      roster: {
        include: {
          player: true,
          leagueMember: true,
        },
      },
    },
  })

  console.log(`\nTrovati ${contracts.length} contratti attivi\n`)

  let updated = 0
  let released = 0

  for (const contract of contracts) {
    const oldDuration = contract.duration
    const newDuration = oldDuration - 1

    if (newDuration <= 0) {
      // Contratto scaduto - svincola giocatore
      await prisma.playerContract.delete({
        where: { id: contract.id },
      })

      await prisma.playerRoster.update({
        where: { id: contract.rosterId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      })

      console.log(`❌ ${contract.roster.player.name} (${contract.roster.leagueMember.teamName})`)
      console.log(`    Contratto scaduto - SVINCOLATO`)
      console.log('')
      released++
    } else {
      // Decrementa durata e ricalcola clausola
      const newClause = calculateRescissionClause(contract.salary, newDuration)

      await prisma.playerContract.update({
        where: { id: contract.id },
        data: {
          duration: newDuration,
          rescissionClause: newClause,
        },
      })

      const canSpalmare = newDuration === 1 ? '✅ SPALMAINGAGGI attivo' : ''

      console.log(`✏️  ${contract.roster.player.name} (${contract.roster.leagueMember.teamName})`)
      console.log(`    Durata: ${oldDuration} → ${newDuration} semestri ${canSpalmare}`)
      console.log(`    Clausola: ${contract.rescissionClause}M → ${newClause}M`)
      console.log('')
      updated++
    }
  }

  console.log('='.repeat(60))
  console.log('RIEPILOGO')
  console.log('='.repeat(60))
  console.log(`Contratti decrementati: ${updated}`)
  console.log(`Giocatori svincolati: ${released}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
