import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.serieAPlayer.count()
  console.log('Giocatori presenti:', count)

  await prisma.serieAPlayer.deleteMany()

  const after = await prisma.serieAPlayer.count()
  console.log('Giocatori dopo cancellazione:', after)
  console.log('✅ Tutti i giocatori sono stati cancellati!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
