/**
 * Test seed: Simula un'asta quasi completa
 * - 4 manager con rosa quasi completa (manca solo 1 A)
 * - Budget residuo basso (20-40)
 * - Contratti per tutti i giocatori
 * - Profezie per alcuni movimenti
 */

import { PrismaClient, Position, MemberStatus, MemberRole, LeagueStatus, MarketType, SessionStatus, AuctionType, AuctionStatus, AcquisitionType, MovementType, ProphecyRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Configurazione lega
const LEAGUE_CONFIG = {
  name: 'Lega Test Asta Finale',
  initialBudget: 500,
  goalkeeperSlots: 3,
  defenderSlots: 8,
  midfielderSlots: 8,
  forwardSlots: 6, // Ognuno ne avrà 5, manca 1
}

// Manager della lega
const MANAGERS = [
  { username: 'mario_rossi', email: 'mario@test.com', teamName: 'FC Mario', budget: 25 },
  { username: 'luigi_verdi', email: 'luigi@test.com', teamName: 'Squadra Luigi', budget: 32 },
  { username: 'anna_bianchi', email: 'anna@test.com', teamName: 'Anna United', budget: 18 },
  { username: 'paolo_neri', email: 'paolo@test.com', teamName: 'Neri FC', budget: 41 },
]

// Giocatori Serie A per il test
const SERIE_A_PLAYERS: { name: string; team: string; position: Position; quotation: number }[] = [
  // Portieri (12 - 3 per manager)
  { name: 'Donnarumma', team: 'PSG', position: 'P', quotation: 15 },
  { name: 'Maignan', team: 'Milan', position: 'P', quotation: 14 },
  { name: 'Szczesny', team: 'Juventus', position: 'P', quotation: 8 },
  { name: 'Sommer', team: 'Inter', position: 'P', quotation: 10 },
  { name: 'Meret', team: 'Napoli', position: 'P', quotation: 7 },
  { name: 'Vicario', team: 'Tottenham', position: 'P', quotation: 12 },
  { name: 'Provedel', team: 'Lazio', position: 'P', quotation: 6 },
  { name: 'Carnesecchi', team: 'Atalanta', position: 'P', quotation: 5 },
  { name: 'Di Gregorio', team: 'Juventus', position: 'P', quotation: 4 },
  { name: 'Terracciano', team: 'Fiorentina', position: 'P', quotation: 3 },
  { name: 'Milinkovic-Savic', team: 'Torino', position: 'P', quotation: 4 },
  { name: 'Montipò', team: 'Verona', position: 'P', quotation: 3 },

  // Difensori (32 - 8 per manager)
  { name: 'Bastoni', team: 'Inter', position: 'D', quotation: 18 },
  { name: 'Bremer', team: 'Juventus', position: 'D', quotation: 15 },
  { name: 'Kim', team: 'Bayern', position: 'D', quotation: 12 },
  { name: 'Theo Hernandez', team: 'Milan', position: 'D', quotation: 20 },
  { name: 'Di Lorenzo', team: 'Napoli', position: 'D', quotation: 14 },
  { name: 'Dimarco', team: 'Inter', position: 'D', quotation: 16 },
  { name: 'Darmian', team: 'Inter', position: 'D', quotation: 8 },
  { name: 'Acerbi', team: 'Inter', position: 'D', quotation: 6 },
  { name: 'Tomori', team: 'Milan', position: 'D', quotation: 10 },
  { name: 'Calabria', team: 'Milan', position: 'D', quotation: 8 },
  { name: 'Gatti', team: 'Juventus', position: 'D', quotation: 7 },
  { name: 'Cambiaso', team: 'Juventus', position: 'D', quotation: 11 },
  { name: 'Rrahmani', team: 'Napoli', position: 'D', quotation: 9 },
  { name: 'Ndicka', team: 'Roma', position: 'D', quotation: 6 },
  { name: 'Mancini', team: 'Roma', position: 'D', quotation: 7 },
  { name: 'Spinazzola', team: 'Napoli', position: 'D', quotation: 5 },
  { name: 'Udogie', team: 'Tottenham', position: 'D', quotation: 10 },
  { name: 'Scalvini', team: 'Atalanta', position: 'D', quotation: 8 },
  { name: 'Kolasinac', team: 'Atalanta', position: 'D', quotation: 5 },
  { name: 'Ruggeri', team: 'Atalanta', position: 'D', quotation: 6 },
  { name: 'Lazzari', team: 'Lazio', position: 'D', quotation: 7 },
  { name: 'Romagnoli', team: 'Lazio', position: 'D', quotation: 5 },
  { name: 'Marusic', team: 'Lazio', position: 'D', quotation: 4 },
  { name: 'Parisi', team: 'Fiorentina', position: 'D', quotation: 5 },
  { name: 'Biraghi', team: 'Fiorentina', position: 'D', quotation: 6 },
  { name: 'Bellanova', team: 'Roma', position: 'D', quotation: 7 },
  { name: 'Rodriguez', team: 'Torino', position: 'D', quotation: 4 },
  { name: 'Buongiorno', team: 'Napoli', position: 'D', quotation: 12 },
  { name: 'Calafiori', team: 'Arsenal', position: 'D', quotation: 11 },
  { name: 'Gosens', team: 'Torino', position: 'D', quotation: 5 },
  { name: 'Celik', team: 'Roma', position: 'D', quotation: 4 },
  { name: 'Danilo', team: 'Juventus', position: 'D', quotation: 5 },

  // Centrocampisti (32 - 8 per manager)
  { name: 'Barella', team: 'Inter', position: 'C', quotation: 25 },
  { name: 'Calhanoglu', team: 'Inter', position: 'C', quotation: 18 },
  { name: 'Mkhitaryan', team: 'Inter', position: 'C', quotation: 10 },
  { name: 'Tonali', team: 'Newcastle', position: 'C', quotation: 12 },
  { name: 'Locatelli', team: 'Juventus', position: 'C', quotation: 9 },
  { name: 'Rabiot', team: 'Marseille', position: 'C', quotation: 8 },
  { name: 'Zielinski', team: 'Inter', position: 'C', quotation: 11 },
  { name: 'Lobotka', team: 'Napoli', position: 'C', quotation: 10 },
  { name: 'Anguissa', team: 'Napoli', position: 'C', quotation: 9 },
  { name: 'Koopmeiners', team: 'Juventus', position: 'C', quotation: 16 },
  { name: 'Pasalic', team: 'Atalanta', position: 'C', quotation: 8 },
  { name: 'De Roon', team: 'Atalanta', position: 'C', quotation: 7 },
  { name: 'Ederson', team: 'Atalanta', position: 'C', quotation: 9 },
  { name: 'Luis Alberto', team: 'Al-Duhail', position: 'C', quotation: 7 },
  { name: 'Cataldi', team: 'Fiorentina', position: 'C', quotation: 5 },
  { name: 'Guendouzi', team: 'Lazio', position: 'C', quotation: 8 },
  { name: 'Rovella', team: 'Lazio', position: 'C', quotation: 6 },
  { name: 'Bonaventura', team: 'Fiorentina', position: 'C', quotation: 5 },
  { name: 'Pellegrini', team: 'Roma', position: 'C', quotation: 10 },
  { name: 'Cristante', team: 'Roma', position: 'C', quotation: 6 },
  { name: 'Reijnders', team: 'Milan', position: 'C', quotation: 14 },
  { name: 'Bennacer', team: 'Milan', position: 'C', quotation: 7 },
  { name: 'Loftus-Cheek', team: 'Milan', position: 'C', quotation: 8 },
  { name: 'Fagioli', team: 'Juventus', position: 'C', quotation: 6 },
  { name: 'Frattesi', team: 'Inter', position: 'C', quotation: 11 },
  { name: 'Ricci', team: 'Torino', position: 'C', quotation: 8 },
  { name: 'Ilic', team: 'Torino', position: 'C', quotation: 6 },
  { name: 'Mandragora', team: 'Fiorentina', position: 'C', quotation: 4 },
  { name: 'Brescianini', team: 'Atalanta', position: 'C', quotation: 5 },
  { name: 'Samardzic', team: 'Atalanta', position: 'C', quotation: 7 },
  { name: 'McKennie', team: 'Juventus', position: 'C', quotation: 5 },
  { name: 'Vecino', team: 'Lazio', position: 'C', quotation: 4 },

  // Attaccanti (24 - 5 per manager + 4 liberi per le ultime aste)
  { name: 'Lautaro', team: 'Inter', position: 'A', quotation: 35 },
  { name: 'Vlahovic', team: 'Juventus', position: 'A', quotation: 25 },
  { name: 'Osimhen', team: 'Galatasaray', position: 'A', quotation: 28 },
  { name: 'Leao', team: 'Milan', position: 'A', quotation: 30 },
  { name: 'Thuram', team: 'Inter', position: 'A', quotation: 22 },
  { name: 'Lukaku', team: 'Napoli', position: 'A', quotation: 20 },
  { name: 'Lookman', team: 'Atalanta', position: 'A', quotation: 18 },
  { name: 'Retegui', team: 'Atalanta', position: 'A', quotation: 15 },
  { name: 'Dybala', team: 'Roma', position: 'A', quotation: 16 },
  { name: 'Dovbyk', team: 'Roma', position: 'A', quotation: 14 },
  { name: 'Kvaratskhelia', team: 'Napoli', position: 'A', quotation: 26 },
  { name: 'Pulisic', team: 'Milan', position: 'A', quotation: 17 },
  { name: 'Zaccagni', team: 'Lazio', position: 'A', quotation: 12 },
  { name: 'Castellanos', team: 'Lazio', position: 'A', quotation: 10 },
  { name: 'Chiesa', team: 'Liverpool', position: 'A', quotation: 11 },
  { name: 'Yildiz', team: 'Juventus', position: 'A', quotation: 13 },
  { name: 'Gonzalez', team: 'Juventus', position: 'A', quotation: 12 },
  { name: 'Gudmundsson', team: 'Fiorentina', position: 'A', quotation: 11 },
  { name: 'Beltran', team: 'Fiorentina', position: 'A', quotation: 8 },
  { name: 'Zapata', team: 'Torino', position: 'A', quotation: 10 },
  // 4 attaccanti liberi per le ultime aste
  { name: 'Scamacca', team: 'Atalanta', position: 'A', quotation: 14 },
  { name: 'Soulé', team: 'Roma', position: 'A', quotation: 9 },
  { name: 'Morata', team: 'Milan', position: 'A', quotation: 12 },
  { name: 'Kean', team: 'Fiorentina', position: 'A', quotation: 11 },
]

// Profezie divertenti
const PROPHECIES = [
  "Pagato troppo, farà 3 gol in tutto l'anno",
  "Un furto a questo prezzo! Capocannoniere sicuro",
  "L'ho preso per dispetto, non mi serviva",
  "Vedrete, sarà l'affare dell'anno",
  "Con questo contratto mi sono rovinato",
  "Il prossimo Messi, ricordatevi di me",
  "Troppo vecchio, ma l'esperienza conta",
  "Un investimento per il futuro",
  "Doveva essere mio, ma va bene così",
  "La coppia con l'altro mio attaccante sarà devastante",
  "Ho dovuto alzare troppo, ma ne valeva la pena",
  "Primo slot riempito, ora si fa sul serio",
]

async function main() {
  console.log('🧹 Pulizia dati esistenti...')

  // Pulizia in ordine per rispettare le FK
  await prisma.prophecy.deleteMany()
  await prisma.playerMovement.deleteMany()
  await prisma.auctionAcknowledgment.deleteMany()
  await prisma.auctionBid.deleteMany()
  await prisma.auction.deleteMany()
  await prisma.playerContract.deleteMany()
  await prisma.playerRoster.deleteMany()
  await prisma.tradeOffer.deleteMany()
  await prisma.marketSession.deleteMany()
  await prisma.leagueInvite.deleteMany()
  await prisma.leagueMember.deleteMany()
  await prisma.league.deleteMany({ where: { name: LEAGUE_CONFIG.name } })

  // Rimuovi i giocatori di test (quelli senza externalId)
  await prisma.serieAPlayer.deleteMany({ where: { externalId: null } })

  // Rimuovi gli utenti di test
  for (const manager of MANAGERS) {
    await prisma.user.deleteMany({ where: { email: manager.email } })
  }

  console.log('👥 Creazione utenti...')
  const passwordHash = await bcrypt.hash('password123', 10)

  const users = await Promise.all(
    MANAGERS.map(manager =>
      prisma.user.create({
        data: {
          email: manager.email,
          username: manager.username,
          passwordHash,
          emailVerified: true,
        },
      })
    )
  )

  console.log('🏆 Creazione lega...')
  const league = await prisma.league.create({
    data: {
      name: LEAGUE_CONFIG.name,
      description: 'Lega di test per simulare asta quasi completa',
      initialBudget: LEAGUE_CONFIG.initialBudget,
      goalkeeperSlots: LEAGUE_CONFIG.goalkeeperSlots,
      defenderSlots: LEAGUE_CONFIG.defenderSlots,
      midfielderSlots: LEAGUE_CONFIG.midfielderSlots,
      forwardSlots: LEAGUE_CONFIG.forwardSlots,
      minParticipants: 4,
      maxParticipants: 4,
      status: LeagueStatus.ACTIVE,
    },
  })

  console.log('👤 Creazione membri lega...')
  const members = await Promise.all(
    users.map((user, index) =>
      prisma.leagueMember.create({
        data: {
          userId: user.id,
          leagueId: league.id,
          role: index === 0 ? MemberRole.ADMIN : MemberRole.MANAGER,
          teamName: MANAGERS[index].teamName,
          status: MemberStatus.ACTIVE,
          currentBudget: MANAGERS[index].budget,
          firstMarketOrder: index,
        },
      })
    )
  )

  console.log('⚽ Creazione giocatori Serie A...')
  const players = await Promise.all(
    SERIE_A_PLAYERS.map(p =>
      prisma.serieAPlayer.create({
        data: {
          name: p.name,
          team: p.team,
          position: p.position,
          quotation: p.quotation,
          listStatus: 'IN_LIST',
        },
      })
    )
  )

  // Raggruppa giocatori per posizione
  const playersByPosition = {
    P: players.filter(p => p.position === 'P'),
    D: players.filter(p => p.position === 'D'),
    C: players.filter(p => p.position === 'C'),
    A: players.filter(p => p.position === 'A'),
  }

  console.log('📅 Creazione sessione mercato...')
  const session = await prisma.marketSession.create({
    data: {
      leagueId: league.id,
      type: MarketType.PRIMO_MERCATO,
      season: 1,
      semester: 1,
      status: SessionStatus.COMPLETED,
      currentRole: 'A', // Ultimo ruolo completato
      turnOrder: members.map(m => m.id),
      currentTurnIndex: 0,
      auctionTimerSeconds: 30,
    },
  })

  console.log('📋 Assegnazione giocatori ai manager...')

  // Distribuisci giocatori
  // P: 3 per manager (12 totali)
  // D: 8 per manager (32 totali)
  // C: 8 per manager (32 totali)
  // A: 6 per manager (24 totali) - rose complete!

  const rosterEntries: { memberId: string; playerId: string; price: number; playerName: string }[] = []

  // Portieri - 3 per manager
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const playerIdx = i * 3 + j
      rosterEntries.push({
        memberId: members[i].id,
        playerId: playersByPosition.P[playerIdx].id,
        price: Math.floor(Math.random() * 10) + 1,
        playerName: playersByPosition.P[playerIdx].name,
      })
    }
  }

  // Difensori - 8 per manager
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) {
      const playerIdx = i * 8 + j
      rosterEntries.push({
        memberId: members[i].id,
        playerId: playersByPosition.D[playerIdx].id,
        price: Math.floor(Math.random() * 15) + 1,
        playerName: playersByPosition.D[playerIdx].name,
      })
    }
  }

  // Centrocampisti - 8 per manager
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) {
      const playerIdx = i * 8 + j
      rosterEntries.push({
        memberId: members[i].id,
        playerId: playersByPosition.C[playerIdx].id,
        price: Math.floor(Math.random() * 20) + 1,
        playerName: playersByPosition.C[playerIdx].name,
      })
    }
  }

  // Attaccanti - 6 per manager (rose complete)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 6; j++) {
      const playerIdx = i * 6 + j
      rosterEntries.push({
        memberId: members[i].id,
        playerId: playersByPosition.A[playerIdx].id,
        price: Math.floor(Math.random() * 25) + 5,
        playerName: playersByPosition.A[playerIdx].name,
      })
    }
  }

  // Crea roster, contratti, aste, movimenti e profezie
  let prophecyIndex = 0

  for (const entry of rosterEntries) {
    // Crea roster entry
    const roster = await prisma.playerRoster.create({
      data: {
        leagueMemberId: entry.memberId,
        playerId: entry.playerId,
        acquisitionPrice: entry.price,
        acquisitionType: AcquisitionType.FIRST_MARKET,
        status: 'ACTIVE',
      },
    })

    // Crea contratto
    const duration = Math.floor(Math.random() * 4) + 1 // 1-4 semestri
    const salary = Math.floor(entry.price / 2) + 1
    const rescissionClause = salary * (duration <= 2 ? 2 : 3)

    await prisma.playerContract.create({
      data: {
        rosterId: roster.id,
        leagueMemberId: entry.memberId,
        salary,
        duration,
        initialSalary: salary,
        initialDuration: duration,
        rescissionClause,
      },
    })

    // Crea asta completata
    const auction = await prisma.auction.create({
      data: {
        leagueId: league.id,
        marketSessionId: session.id,
        playerId: entry.playerId,
        type: AuctionType.FREE_BID,
        basePrice: 1,
        currentPrice: entry.price,
        winnerId: entry.memberId,
        nominatorId: entry.memberId,
        status: AuctionStatus.COMPLETED,
      },
    })

    // Crea movimento
    const movement = await prisma.playerMovement.create({
      data: {
        leagueId: league.id,
        playerId: entry.playerId,
        movementType: MovementType.FIRST_MARKET,
        toMemberId: entry.memberId,
        price: entry.price,
        newSalary: salary,
        newDuration: duration,
        newClause: rescissionClause,
        auctionId: auction.id,
        marketSessionId: session.id,
      },
    })

    // Aggiungi profezia per alcuni movimenti (circa 1 su 4)
    if (Math.random() < 0.25) {
      await prisma.prophecy.create({
        data: {
          leagueId: league.id,
          playerId: entry.playerId,
          authorId: entry.memberId,
          movementId: movement.id,
          authorRole: ProphecyRole.BUYER,
          content: PROPHECIES[prophecyIndex % PROPHECIES.length],
        },
      })
      prophecyIndex++
    }
  }

  // Statistiche finali
  const totalRosters = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: league.id } } })
  const totalProphecies = await prisma.prophecy.count({ where: { leagueId: league.id } })

  console.log('')
  console.log('✅ Seed completato!')
  console.log('=====================================')
  console.log(`📊 Lega: ${league.name}`)
  console.log(`👥 Manager: ${members.length}`)
  console.log(`⚽ Giocatori in rosa: ${totalRosters}`)
  console.log(`📜 Profezie create: ${totalProphecies}`)
  console.log('')
  console.log('📍 Stato attuale:')
  console.log('   - PRIMO_MERCATO: COMPLETATO')
  console.log('   - Tutte le rose sono complete (25 giocatori ciascuna)')
  console.log('   - Pronto per la prossima sessione di mercato')
  console.log('')
  console.log('💰 Budget residui:')
  for (let i = 0; i < members.length; i++) {
    console.log(`   - ${MANAGERS[i].username}: ${MANAGERS[i].budget} crediti`)
  }
  console.log('')
  console.log('🔑 Credenziali login:')
  console.log('   Email: mario@test.com (admin) / luigi@test.com / anna@test.com / paolo@test.com')
  console.log('   Password: password123')
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
