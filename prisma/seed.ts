import { PrismaClient, Position } from '@prisma/client'

const prisma = new PrismaClient()

// Serie A 2024/25 - Giocatori principali per squadra
const serieAPlayers = [
  // ATALANTA
  { name: 'Carnesecchi', team: 'Atalanta', position: Position.P, quotation: 12 },
  { name: 'Scalvini', team: 'Atalanta', position: Position.D, quotation: 15 },
  { name: 'Kolasinac', team: 'Atalanta', position: Position.D, quotation: 10 },
  { name: 'Ederson', team: 'Atalanta', position: Position.C, quotation: 18 },
  { name: 'De Ketelaere', team: 'Atalanta', position: Position.C, quotation: 22 },
  { name: 'Lookman', team: 'Atalanta', position: Position.A, quotation: 28 },
  { name: 'Retegui', team: 'Atalanta', position: Position.A, quotation: 25 },

  // BOLOGNA
  { name: 'Skorupski', team: 'Bologna', position: Position.P, quotation: 10 },
  { name: 'Beukema', team: 'Bologna', position: Position.D, quotation: 12 },
  { name: 'Lucumi', team: 'Bologna', position: Position.D, quotation: 10 },
  { name: 'Freuler', team: 'Bologna', position: Position.C, quotation: 14 },
  { name: 'Ferguson', team: 'Bologna', position: Position.C, quotation: 12 },
  { name: 'Orsolini', team: 'Bologna', position: Position.A, quotation: 18 },
  { name: 'Castro', team: 'Bologna', position: Position.A, quotation: 16 },

  // COMO
  { name: 'Reina', team: 'Como', position: Position.P, quotation: 6 },
  { name: 'Dossena', team: 'Como', position: Position.D, quotation: 8 },
  { name: 'Nico Paz', team: 'Como', position: Position.C, quotation: 14 },
  { name: 'Strefezza', team: 'Como', position: Position.C, quotation: 10 },
  { name: 'Cutrone', team: 'Como', position: Position.A, quotation: 10 },

  // EMPOLI
  { name: 'Vasquez', team: 'Empoli', position: Position.P, quotation: 8 },
  { name: 'Ismajli', team: 'Empoli', position: Position.D, quotation: 8 },
  { name: 'Fazzini', team: 'Empoli', position: Position.C, quotation: 12 },
  { name: 'Colombo', team: 'Empoli', position: Position.A, quotation: 12 },

  // FIORENTINA
  { name: 'De Gea', team: 'Fiorentina', position: Position.P, quotation: 14 },
  { name: 'Comuzzo', team: 'Fiorentina', position: Position.D, quotation: 10 },
  { name: 'Ranieri', team: 'Fiorentina', position: Position.D, quotation: 8 },
  { name: 'Adli', team: 'Fiorentina', position: Position.C, quotation: 12 },
  { name: 'Colpani', team: 'Fiorentina', position: Position.C, quotation: 14 },
  { name: 'Gudmundsson', team: 'Fiorentina', position: Position.A, quotation: 20 },
  { name: 'Kean', team: 'Fiorentina', position: Position.A, quotation: 22 },

  // GENOA
  { name: 'Gollini', team: 'Genoa', position: Position.P, quotation: 8 },
  { name: 'Bani', team: 'Genoa', position: Position.D, quotation: 8 },
  { name: 'Badelj', team: 'Genoa', position: Position.C, quotation: 8 },
  { name: 'Messias', team: 'Genoa', position: Position.C, quotation: 10 },
  { name: 'Pinamonti', team: 'Genoa', position: Position.A, quotation: 14 },

  // INTER
  { name: 'Sommer', team: 'Inter', position: Position.P, quotation: 14 },
  { name: 'Bastoni', team: 'Inter', position: Position.D, quotation: 18 },
  { name: 'Dimarco', team: 'Inter', position: Position.D, quotation: 20 },
  { name: 'Pavard', team: 'Inter', position: Position.D, quotation: 14 },
  { name: 'Barella', team: 'Inter', position: Position.C, quotation: 28 },
  { name: 'Calhanoglu', team: 'Inter', position: Position.C, quotation: 24 },
  { name: 'Mkhitaryan', team: 'Inter', position: Position.C, quotation: 16 },
  { name: 'Thuram', team: 'Inter', position: Position.A, quotation: 28 },
  { name: 'Lautaro', team: 'Inter', position: Position.A, quotation: 32 },

  // JUVENTUS
  { name: 'Di Gregorio', team: 'Juventus', position: Position.P, quotation: 12 },
  { name: 'Bremer', team: 'Juventus', position: Position.D, quotation: 14 },
  { name: 'Gatti', team: 'Juventus', position: Position.D, quotation: 12 },
  { name: 'Cambiaso', team: 'Juventus', position: Position.D, quotation: 16 },
  { name: 'Locatelli', team: 'Juventus', position: Position.C, quotation: 14 },
  { name: 'Koopmeiners', team: 'Juventus', position: Position.C, quotation: 22 },
  { name: 'Yildiz', team: 'Juventus', position: Position.A, quotation: 20 },
  { name: 'Vlahovic', team: 'Juventus', position: Position.A, quotation: 26 },
  { name: 'Conceicao', team: 'Juventus', position: Position.A, quotation: 18 },

  // LAZIO
  { name: 'Provedel', team: 'Lazio', position: Position.P, quotation: 12 },
  { name: 'Romagnoli', team: 'Lazio', position: Position.D, quotation: 10 },
  { name: 'Gila', team: 'Lazio', position: Position.D, quotation: 10 },
  { name: 'Tavares', team: 'Lazio', position: Position.D, quotation: 16 },
  { name: 'Guendouzi', team: 'Lazio', position: Position.C, quotation: 16 },
  { name: 'Rovella', team: 'Lazio', position: Position.C, quotation: 14 },
  { name: 'Zaccagni', team: 'Lazio', position: Position.A, quotation: 18 },
  { name: 'Castellanos', team: 'Lazio', position: Position.A, quotation: 18 },
  { name: 'Dia', team: 'Lazio', position: Position.A, quotation: 16 },

  // LECCE
  { name: 'Falcone', team: 'Lecce', position: Position.P, quotation: 10 },
  { name: 'Baschirotto', team: 'Lecce', position: Position.D, quotation: 8 },
  { name: 'Rafia', team: 'Lecce', position: Position.C, quotation: 8 },
  { name: 'Krstovic', team: 'Lecce', position: Position.A, quotation: 12 },

  // MILAN
  { name: 'Maignan', team: 'Milan', position: Position.P, quotation: 16 },
  { name: 'Thiaw', team: 'Milan', position: Position.D, quotation: 12 },
  { name: 'Gabbia', team: 'Milan', position: Position.D, quotation: 10 },
  { name: 'Theo Hernandez', team: 'Milan', position: Position.D, quotation: 22 },
  { name: 'Reijnders', team: 'Milan', position: Position.C, quotation: 20 },
  { name: 'Fofana', team: 'Milan', position: Position.C, quotation: 14 },
  { name: 'Pulisic', team: 'Milan', position: Position.A, quotation: 22 },
  { name: 'Leao', team: 'Milan', position: Position.A, quotation: 26 },
  { name: 'Morata', team: 'Milan', position: Position.A, quotation: 20 },

  // MONZA
  { name: 'Turati', team: 'Monza', position: Position.P, quotation: 8 },
  { name: 'Izzo', team: 'Monza', position: Position.D, quotation: 8 },
  { name: 'Pessina', team: 'Monza', position: Position.C, quotation: 10 },
  { name: 'Maldini', team: 'Monza', position: Position.A, quotation: 12 },
  { name: 'Djuric', team: 'Monza', position: Position.A, quotation: 10 },

  // NAPOLI
  { name: 'Meret', team: 'Napoli', position: Position.P, quotation: 12 },
  { name: 'Di Lorenzo', team: 'Napoli', position: Position.D, quotation: 16 },
  { name: 'Rrahmani', team: 'Napoli', position: Position.D, quotation: 12 },
  { name: 'Buongiorno', team: 'Napoli', position: Position.D, quotation: 14 },
  { name: 'Olivera', team: 'Napoli', position: Position.D, quotation: 12 },
  { name: 'Anguissa', team: 'Napoli', position: Position.C, quotation: 16 },
  { name: 'Lobotka', team: 'Napoli', position: Position.C, quotation: 14 },
  { name: 'McTominay', team: 'Napoli', position: Position.C, quotation: 18 },
  { name: 'Politano', team: 'Napoli', position: Position.A, quotation: 16 },
  { name: 'Kvaratskhelia', team: 'Napoli', position: Position.A, quotation: 28 },
  { name: 'Lukaku', team: 'Napoli', position: Position.A, quotation: 24 },

  // PARMA
  { name: 'Suzuki', team: 'Parma', position: Position.P, quotation: 8 },
  { name: 'Delprato', team: 'Parma', position: Position.D, quotation: 8 },
  { name: 'Bernabe', team: 'Parma', position: Position.C, quotation: 10 },
  { name: 'Man', team: 'Parma', position: Position.A, quotation: 12 },
  { name: 'Bonny', team: 'Parma', position: Position.A, quotation: 12 },

  // ROMA
  { name: 'Svilar', team: 'Roma', position: Position.P, quotation: 12 },
  { name: 'Mancini', team: 'Roma', position: Position.D, quotation: 10 },
  { name: 'Ndicka', team: 'Roma', position: Position.D, quotation: 10 },
  { name: 'Angelino', team: 'Roma', position: Position.D, quotation: 12 },
  { name: 'Paredes', team: 'Roma', position: Position.C, quotation: 12 },
  { name: 'Pellegrini', team: 'Roma', position: Position.C, quotation: 16 },
  { name: 'Soule', team: 'Roma', position: Position.A, quotation: 14 },
  { name: 'Dybala', team: 'Roma', position: Position.A, quotation: 24 },
  { name: 'Dovbyk', team: 'Roma', position: Position.A, quotation: 20 },

  // TORINO
  { name: 'Milinkovic-Savic', team: 'Torino', position: Position.P, quotation: 10 },
  { name: 'Coco', team: 'Torino', position: Position.D, quotation: 10 },
  { name: 'Masina', team: 'Torino', position: Position.D, quotation: 8 },
  { name: 'Bellanova', team: 'Torino', position: Position.D, quotation: 12 },
  { name: 'Ricci', team: 'Torino', position: Position.C, quotation: 14 },
  { name: 'Ilic', team: 'Torino', position: Position.C, quotation: 12 },
  { name: 'Vlasic', team: 'Torino', position: Position.C, quotation: 12 },
  { name: 'Adams', team: 'Torino', position: Position.A, quotation: 14 },
  { name: 'Zapata', team: 'Torino', position: Position.A, quotation: 16 },

  // UDINESE
  { name: 'Okoye', team: 'Udinese', position: Position.P, quotation: 10 },
  { name: 'Bijol', team: 'Udinese', position: Position.D, quotation: 10 },
  { name: 'Perez', team: 'Udinese', position: Position.D, quotation: 8 },
  { name: 'Lovric', team: 'Udinese', position: Position.C, quotation: 10 },
  { name: 'Thauvin', team: 'Udinese', position: Position.A, quotation: 14 },
  { name: 'Lucca', team: 'Udinese', position: Position.A, quotation: 14 },

  // VENEZIA
  { name: 'Stankovic', team: 'Venezia', position: Position.P, quotation: 6 },
  { name: 'Idzes', team: 'Venezia', position: Position.D, quotation: 6 },
  { name: 'Busio', team: 'Venezia', position: Position.C, quotation: 8 },
  { name: 'Oristanio', team: 'Venezia', position: Position.A, quotation: 10 },
  { name: 'Pohjanpalo', team: 'Venezia', position: Position.A, quotation: 12 },

  // VERONA
  { name: 'Montipo', team: 'Verona', position: Position.P, quotation: 8 },
  { name: 'Magnani', team: 'Verona', position: Position.D, quotation: 6 },
  { name: 'Duda', team: 'Verona', position: Position.C, quotation: 10 },
  { name: 'Lazovic', team: 'Verona', position: Position.C, quotation: 8 },
  { name: 'Tengstedt', team: 'Verona', position: Position.A, quotation: 10 },
]

async function main() {
  console.log('Seeding database...')

  // Clear existing players
  await prisma.serieAPlayer.deleteMany()
  console.log('Cleared existing players')

  // Insert new players
  const result = await prisma.serieAPlayer.createMany({
    data: serieAPlayers,
  })

  console.log(`Created ${result.count} players`)

  // Stats
  const stats = await prisma.serieAPlayer.groupBy({
    by: ['position'],
    _count: true,
  })

  console.log('\nPlayers by position:')
  stats.forEach(s => {
    const posName: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
    console.log(`  ${posName[s.position]}: ${s._count}`)
  })

  const teams = await prisma.serieAPlayer.groupBy({
    by: ['team'],
    _count: true,
  })

  console.log(`\nTeams: ${teams.length}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
