import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.serieAPlayer.count()
  console.log('Giocatori totali:', count)

  if (count > 0) {
    const byPosition = await prisma.serieAPlayer.groupBy({
      by: ['position'],
      _count: true
    })
    console.log('\nPer ruolo:')
    byPosition.forEach(p => {
      const role = p.position === 'P' ? 'Portieri' :
                   p.position === 'D' ? 'Difensori' :
                   p.position === 'C' ? 'Centrocampisti' : 'Attaccanti'
      console.log(`  ${role}: ${p._count}`)
    })

    // Show some sample players
    const samples = await prisma.serieAPlayer.findMany({
      take: 10,
      orderBy: { quotation: 'desc' }
    })
    console.log('\nTop 10 per quotazione:')
    samples.forEach(p => {
      console.log(`  ${p.name} (${p.team}) - ${p.position} - Quot: ${p.quotation}`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
