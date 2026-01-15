import { PrismaClient, Position } from '@prisma/client'

const prisma = new PrismaClient()

// Nomi italiani per generare giocatori fittizi
const FIRST_NAMES = [
  'Marco', 'Luca', 'Andrea', 'Giuseppe', 'Francesco', 'Alessandro', 'Davide', 'Matteo',
  'Lorenzo', 'Simone', 'Federico', 'Riccardo', 'Nicola', 'Antonio', 'Stefano', 'Fabio',
  'Roberto', 'Paolo', 'Giovanni', 'Pietro', 'Tommaso', 'Gabriele', 'Edoardo', 'Giacomo',
  'Leonardo', 'Michele', 'Filippo', 'Vincenzo', 'Daniele', 'Emanuele', 'Alberto', 'Claudio'
]

const LAST_NAMES = [
  'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci',
  'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa',
  'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani',
  'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo', 'Serra'
]

const TEAMS = [
  'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Empoli', 'Fiorentina', 'Genoa',
  'Inter', 'Juventus', 'Lazio', 'Lecce', 'Milan', 'Monza', 'Napoli', 'Parma',
  'Roma', 'Torino', 'Udinese', 'Venezia', 'Verona'
]

async function main() {
  console.log('📊 Conteggio giocatori attuali...')

  const currentCounts = {
    P: await prisma.serieAPlayer.count({ where: { position: Position.P, isActive: true } }),
    D: await prisma.serieAPlayer.count({ where: { position: Position.D, isActive: true } }),
    C: await prisma.serieAPlayer.count({ where: { position: Position.C, isActive: true } }),
    A: await prisma.serieAPlayer.count({ where: { position: Position.A, isActive: true } }),
  }

  // Servono per 8 manager con slot 3P, 8D, 8C, 6A
  const needed = {
    P: 24, // 8 * 3
    D: 64, // 8 * 8
    C: 64, // 8 * 8
    A: 48, // 8 * 6
  }

  console.log('\nGiocatori attuali vs necessari:')
  console.log(`  P: ${currentCounts.P} / ${needed.P}`)
  console.log(`  D: ${currentCounts.D} / ${needed.D}`)
  console.log(`  C: ${currentCounts.C} / ${needed.C}`)
  console.log(`  A: ${currentCounts.A} / ${needed.A}`)

  const toCreate = {
    P: Math.max(0, needed.P - currentCounts.P + 5), // +5 di margine
    D: Math.max(0, needed.D - currentCounts.D + 5),
    C: Math.max(0, needed.C - currentCounts.C + 5),
    A: Math.max(0, needed.A - currentCounts.A + 5),
  }

  console.log('\nGiocatori da creare:')
  console.log(`  P: ${toCreate.P}`)
  console.log(`  D: ${toCreate.D}`)
  console.log(`  C: ${toCreate.C}`)
  console.log(`  A: ${toCreate.A}`)

  let created = 0
  const usedNames = new Set<string>()

  function generateName(): string {
    for (let i = 0; i < 100; i++) {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
      const name = `${first} ${last}`
      if (!usedNames.has(name)) {
        usedNames.add(name)
        return name
      }
    }
    // Fallback con numero
    const num = Math.floor(Math.random() * 1000)
    return `Giocatore ${num}`
  }

  for (const [position, count] of Object.entries(toCreate)) {
    for (let i = 0; i < count; i++) {
      const name = generateName()
      const team = TEAMS[Math.floor(Math.random() * TEAMS.length)]
      const quotation = Math.floor(Math.random() * 15) + 1 // 1-15

      await prisma.serieAPlayer.create({
        data: {
          name,
          team,
          position: position as Position,
          quotation,
          isActive: true,
        },
      })
      created++
    }
  }

  console.log(`\n✅ Creati ${created} nuovi giocatori`)

  // Conteggio finale
  const finalCounts = {
    P: await prisma.serieAPlayer.count({ where: { position: Position.P, isActive: true } }),
    D: await prisma.serieAPlayer.count({ where: { position: Position.D, isActive: true } }),
    C: await prisma.serieAPlayer.count({ where: { position: Position.C, isActive: true } }),
    A: await prisma.serieAPlayer.count({ where: { position: Position.A, isActive: true } }),
  }

  const total = finalCounts.P + finalCounts.D + finalCounts.C + finalCounts.A

  console.log('\n📊 Conteggio finale:')
  console.log(`  P: ${finalCounts.P}`)
  console.log(`  D: ${finalCounts.D}`)
  console.log(`  C: ${finalCounts.C}`)
  console.log(`  A: ${finalCounts.A}`)
  console.log(`  TOTALE: ${total}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
