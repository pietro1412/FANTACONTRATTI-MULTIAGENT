import { PrismaClient, Position } from '@prisma/client'

const prisma = new PrismaClient()

// Sample Serie A players for testing
const players = [
  // PORTIERI (P)
  { name: 'Maignan', team: 'Milan', position: Position.P, quotation: 18 },
  { name: 'Sommer', team: 'Inter', position: Position.P, quotation: 14 },
  { name: 'Di Gregorio', team: 'Juventus', position: Position.P, quotation: 12 },
  { name: 'Carnesecchi', team: 'Atalanta', position: Position.P, quotation: 11 },
  { name: 'Meret', team: 'Napoli', position: Position.P, quotation: 10 },
  { name: 'De Gea', team: 'Fiorentina', position: Position.P, quotation: 10 },
  { name: 'Provedel', team: 'Lazio', position: Position.P, quotation: 9 },
  { name: 'Svilar', team: 'Roma', position: Position.P, quotation: 9 },
  { name: 'Milinkovic-Savic', team: 'Torino', position: Position.P, quotation: 8 },
  { name: 'Skorupski', team: 'Bologna', position: Position.P, quotation: 8 },

  // DIFENSORI (D)
  { name: 'Theo Hernandez', team: 'Milan', position: Position.D, quotation: 25 },
  { name: 'Dimarco', team: 'Inter', position: Position.D, quotation: 22 },
  { name: 'Bastoni', team: 'Inter', position: Position.D, quotation: 18 },
  { name: 'Bremer', team: 'Juventus', position: Position.D, quotation: 16 },
  { name: 'Cambiaso', team: 'Juventus', position: Position.D, quotation: 15 },
  { name: 'Di Lorenzo', team: 'Napoli', position: Position.D, quotation: 14 },
  { name: 'Buongiorno', team: 'Napoli', position: Position.D, quotation: 13 },
  { name: 'Kolasinac', team: 'Atalanta', position: Position.D, quotation: 12 },
  { name: 'Djimsiti', team: 'Atalanta', position: Position.D, quotation: 10 },
  { name: 'Ndicka', team: 'Roma', position: Position.D, quotation: 10 },
  { name: 'Mancini', team: 'Roma', position: Position.D, quotation: 9 },
  { name: 'Gatti', team: 'Juventus', position: Position.D, quotation: 9 },
  { name: 'Pavard', team: 'Inter', position: Position.D, quotation: 12 },
  { name: 'Acerbi', team: 'Inter', position: Position.D, quotation: 8 },
  { name: 'Tomori', team: 'Milan', position: Position.D, quotation: 11 },
  { name: 'Thiaw', team: 'Milan', position: Position.D, quotation: 8 },
  { name: 'Romagnoli', team: 'Lazio', position: Position.D, quotation: 8 },
  { name: 'Marusic', team: 'Lazio', position: Position.D, quotation: 7 },
  { name: 'Olivera', team: 'Napoli', position: Position.D, quotation: 10 },
  { name: 'Rrahmani', team: 'Napoli', position: Position.D, quotation: 9 },

  // CENTROCAMPISTI (C)
  { name: 'Barella', team: 'Inter', position: Position.C, quotation: 32 },
  { name: 'Calhanoglu', team: 'Inter', position: Position.C, quotation: 25 },
  { name: 'Koopmeiners', team: 'Juventus', position: Position.C, quotation: 24 },
  { name: 'Lookman', team: 'Atalanta', position: Position.C, quotation: 28 },
  { name: 'Reijnders', team: 'Milan', position: Position.C, quotation: 20 },
  { name: 'Pulisic', team: 'Milan', position: Position.C, quotation: 22 },
  { name: 'Zielinski', team: 'Inter', position: Position.C, quotation: 16 },
  { name: 'Mkhitaryan', team: 'Inter', position: Position.C, quotation: 14 },
  { name: 'McTominay', team: 'Napoli', position: Position.C, quotation: 18 },
  { name: 'Anguissa', team: 'Napoli', position: Position.C, quotation: 15 },
  { name: 'Locatelli', team: 'Juventus', position: Position.C, quotation: 12 },
  { name: 'Douglas Luiz', team: 'Juventus', position: Position.C, quotation: 14 },
  { name: 'Pellegrini', team: 'Roma', position: Position.C, quotation: 16 },
  { name: 'Dybala', team: 'Roma', position: Position.C, quotation: 24 },
  { name: 'De Ketelaere', team: 'Atalanta', position: Position.C, quotation: 18 },
  { name: 'Ederson', team: 'Atalanta', position: Position.C, quotation: 14 },
  { name: 'Guendouzi', team: 'Lazio', position: Position.C, quotation: 14 },
  { name: 'Rovella', team: 'Lazio', position: Position.C, quotation: 10 },
  { name: 'Fofana', team: 'Milan', position: Position.C, quotation: 11 },
  { name: 'Ricci', team: 'Torino', position: Position.C, quotation: 12 },

  // ATTACCANTI (A)
  { name: 'Lautaro Martinez', team: 'Inter', position: Position.A, quotation: 38 },
  { name: 'Vlahovic', team: 'Juventus', position: Position.A, quotation: 30 },
  { name: 'Lukaku', team: 'Napoli', position: Position.A, quotation: 28 },
  { name: 'Morata', team: 'Milan', position: Position.A, quotation: 22 },
  { name: 'Retegui', team: 'Atalanta', position: Position.A, quotation: 25 },
  { name: 'Thuram', team: 'Inter', position: Position.A, quotation: 26 },
  { name: 'Leao', team: 'Milan', position: Position.A, quotation: 28 },
  { name: 'Kvaratskhelia', team: 'Napoli', position: Position.A, quotation: 30 },
  { name: 'Castellanos', team: 'Lazio', position: Position.A, quotation: 18 },
  { name: 'Dovbyk', team: 'Roma', position: Position.A, quotation: 22 },
  { name: 'Yildiz', team: 'Juventus', position: Position.A, quotation: 20 },
  { name: 'Conceicao', team: 'Juventus', position: Position.A, quotation: 16 },
  { name: 'Soulé', team: 'Roma', position: Position.A, quotation: 14 },
  { name: 'Zaccagni', team: 'Lazio', position: Position.A, quotation: 16 },
  { name: 'Isaksen', team: 'Lazio', position: Position.A, quotation: 10 },
  { name: 'Okafor', team: 'Milan', position: Position.A, quotation: 12 },
  { name: 'Politano', team: 'Napoli', position: Position.A, quotation: 14 },
  { name: 'Neres', team: 'Napoli', position: Position.A, quotation: 16 },
  { name: 'Scamacca', team: 'Atalanta', position: Position.A, quotation: 18 },
  { name: 'Zapata', team: 'Torino', position: Position.A, quotation: 16 },
]

async function main() {
  console.log('🔄 Caricamento giocatori Serie A...\n')

  let created = 0
  let skipped = 0

  for (const player of players) {
    const existing = await prisma.serieAPlayer.findFirst({
      where: { name: player.name, team: player.team }
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.serieAPlayer.create({
      data: player
    })
    created++
  }

  console.log(`✅ Creati: ${created} giocatori`)
  console.log(`⏭️  Saltati: ${skipped} (già esistenti)`)

  // Summary
  const byPosition = await prisma.serieAPlayer.groupBy({
    by: ['position'],
    _count: true
  })

  console.log('\n📊 Riepilogo:')
  byPosition.forEach(p => {
    const role = p.position === 'P' ? 'Portieri' :
                 p.position === 'D' ? 'Difensori' :
                 p.position === 'C' ? 'Centrocampisti' : 'Attaccanti'
    console.log(`   ${role}: ${p._count}`)
  })

  const total = await prisma.serieAPlayer.count()
  console.log(`\n   TOTALE: ${total} giocatori`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
