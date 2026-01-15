import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const sessions = await prisma.marketSession.findMany({
    where: { status: 'ACTIVE' },
    include: { league: { select: { name: true } } }
  })
  sessions.forEach(s => {
    const board = s.rubataBoard as any[] | null
    console.log(`\n${s.league.name}:`)
    console.log(`  - rubataState: ${s.rubataState}`)
    console.log(`  - rubataBoard: ${board ? board.length + ' giocatori' : 'NON GENERATO'}`)
    console.log(`  - rubataOrder: ${s.rubataOrder ? 'impostato' : 'non impostato'}`)
  })
}
main().finally(() => prisma.$disconnect())
