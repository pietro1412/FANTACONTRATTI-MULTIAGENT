import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROPHECY_TEXTS = [
  "Questo giocatore farà almeno 15 gol quest'anno!",
  "Sarà il flop della stagione, segnatevelo!",
  "MVP garantito, vincerete il fantacalcio con lui",
  "Troppo pagato, non vale più di 5 crediti",
  "Il colpo dell'anno, fidatevi di me!",
  "Si infortunerà entro la terza giornata",
  "Farà il triplo dei fantapunti rispetto al prezzo pagato",
  "Rimarrà in panchina per tutta la stagione"
]

async function main() {
  // Find the league
  const league = await prisma.league.findFirst({
    where: { id: 'cmk9hsvuc00019uhl8r906gee' },
    include: {
      members: {
        where: { status: 'ACTIVE' },
        include: { user: true }
      }
    }
  })

  if (!league) {
    console.log('League not found')
    return
  }

  console.log(`League: ${league.name}`)
  console.log(`Members: ${league.members.map(m => m.user.username).join(', ')}`)

  // Find movements (from first market auctions)
  const movements = await prisma.playerMovement.findMany({
    where: {
      leagueId: league.id,
      movementType: 'FIRST_MARKET'
    },
    include: {
      player: true,
      toMember: { include: { user: true } }
    },
    take: 10
  })

  console.log(`\nFound ${movements.length} movements`)

  if (movements.length === 0) {
    console.log('No movements found for prophecies')
    return
  }

  // Create prophecies - each member makes a prophecy on random movements
  let created = 0
  for (const member of league.members) {
    // Each member makes 2-3 prophecies
    const numProphecies = Math.floor(Math.random() * 2) + 2

    for (let i = 0; i < numProphecies && i < movements.length; i++) {
      // Pick a random movement that's not their own
      const otherMovements = movements.filter(m => m.toMemberId !== member.id)
      if (otherMovements.length === 0) continue

      const movement = otherMovements[Math.floor(Math.random() * otherMovements.length)]
      const prophecyText = PROPHECY_TEXTS[Math.floor(Math.random() * PROPHECY_TEXTS.length)]

      // Check if prophecy already exists
      const existing = await prisma.prophecy.findFirst({
        where: {
          movementId: movement.id,
          authorId: member.id
        }
      })

      if (existing) continue

      // Determine if author is the buyer or an observer (seller)
      const isBuyer = movement.toMemberId === member.id

      await prisma.prophecy.create({
        data: {
          leagueId: league.id,
          playerId: movement.playerId,
          authorId: member.id,
          movementId: movement.id,
          authorRole: isBuyer ? 'BUYER' : 'SELLER',
          content: prophecyText
        }
      })

      console.log(`Created prophecy by ${member.user.username} on ${movement.player.name}: "${prophecyText.substring(0, 30)}..."`)
      created++
    }
  }

  console.log(`\nTotal prophecies created: ${created}`)

  // Show all prophecies
  const allProphecies = await prisma.prophecy.findMany({
    where: { leagueId: league.id },
    include: {
      player: true,
      author: { include: { user: true } },
      movement: true
    }
  })

  console.log(`\n=== All prophecies in league ===`)
  for (const p of allProphecies) {
    console.log(`- ${p.author.user.username} on ${p.player.name}: "${p.content}"`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
