import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const mario = await prisma.leagueMember.findFirst({
    where: {
      user: { username: { contains: 'mario', mode: 'insensitive' } }
    },
    include: {
      user: { select: { username: true } },
      roster: {
        include: {
          player: { select: { name: true, position: true } },
          contract: true
        },
        take: 8
      }
    }
  })

  if (mario) {
    console.log('=== ROSA DI', mario.user.username, '===')
    console.log('Team:', mario.teamName)
    console.log('')

    for (const r of mario.roster) {
      if (r.contract) {
        const salary = r.contract.salary
        const duration = r.contract.duration
        const clause = r.contract.rescissionClause || 0
        const rubataPrice = clause + salary

        console.log('Giocatore:', r.player.name, '(' + r.player.position + ')')
        console.log('  Ingaggio:', salary + 'M')
        console.log('  Durata:', duration + 's')
        console.log('  Clausola:', clause + 'M')
        console.log('  Rubata = Clausola + Ingaggio =', clause, '+', salary, '=', rubataPrice + 'M')
        console.log('')
      }
    }
  } else {
    console.log('Mario non trovato')
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
  })
