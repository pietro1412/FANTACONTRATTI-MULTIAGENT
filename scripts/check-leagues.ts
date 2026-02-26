import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Checking leagues in database...\n')

    const leagues = await prisma.league.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { members: true } }
      },
    })

    console.log(`Found ${leagues.length} leagues:`)
    leagues.forEach(l => {
      console.log(` - ${l.name}`)
      console.log(`   ID: ${l.id}`)
      console.log(`   Members: ${l._count.members}`)
      console.log('')
    })

    const pietro = await prisma.user.findFirst({
      where: { email: 'pietro@test.com' },
      include: {
        leagueMemberships: {
          include: { league: true }
        }
      }
    })

    if (pietro) {
      console.log(`Pietro's league memberships:`)
      pietro.leagueMemberships.forEach(m => {
        console.log(` - ${m.league.name} (${m.league.id}) - Role: ${m.role}`)
      })
    }

  } catch (e) {
    console.error('Error:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
