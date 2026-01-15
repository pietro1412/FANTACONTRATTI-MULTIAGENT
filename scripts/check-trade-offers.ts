import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const offers = await prisma.tradeOffer.findMany({
    take: 2,
    orderBy: { createdAt: 'desc' }
  })

  console.log('Trade Offers nel DB:\n')

  offers.forEach(o => {
    console.log('ID:', o.id)
    console.log('offeredPlayers:', JSON.stringify(o.offeredPlayers))
    console.log('requestedPlayers:', JSON.stringify(o.requestedPlayers))
    console.log('offeredBudget:', o.offeredBudget)
    console.log('requestedBudget:', o.requestedBudget)
    console.log('---')
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
