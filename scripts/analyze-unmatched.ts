import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const notEnriched = await prisma.serieAPlayer.findMany({
    where: {
      isActive: true,
      listStatus: 'IN_LIST',
      dataEnrichedAt: null
    },
    select: { name: true, team: true },
    orderBy: [{ team: 'asc' }, { name: 'asc' }],
  })

  console.log(`Giocatori NON trovati: ${notEnriched.length}\n`)

  // Analizza i pattern
  const patterns = {
    withInitial: 0,      // "Martinez L."
    withDot: 0,          // "F.P."
    singleWord: 0,       // "Diouf"
    multiWord: 0,        // Nome normale
  }

  for (const p of notEnriched) {
    if (p.name.match(/\s[A-Z]\.$/) || p.name.match(/\s[A-Z][a-z]?\./)) {
      patterns.withInitial++
    } else if (p.name.includes('.')) {
      patterns.withDot++
    } else if (!p.name.includes(' ')) {
      patterns.singleWord++
    } else {
      patterns.multiWord++
    }
  }

  console.log('Pattern dei nomi:')
  console.log(`  Con iniziale (es. "Martinez L."): ${patterns.withInitial}`)
  console.log(`  Con punto (es. "F.P."): ${patterns.withDot}`)
  console.log(`  Parola singola (es. "Diouf"): ${patterns.singleWord}`)
  console.log(`  Nome normale: ${patterns.multiWord}`)

  console.log('\n--- Esempi per squadra ---\n')

  // Raggruppa per squadra
  const byTeam = new Map<string, string[]>()
  for (const p of notEnriched) {
    if (!byTeam.has(p.team)) byTeam.set(p.team, [])
    byTeam.get(p.team)!.push(p.name)
  }

  for (const [team, names] of byTeam) {
    console.log(`${team} (${names.length}):`)
    names.slice(0, 5).forEach(n => console.log(`  - ${n}`))
    if (names.length > 5) console.log(`  ... e altri ${names.length - 5}`)
    console.log()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
