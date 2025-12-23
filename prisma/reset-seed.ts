import { PrismaClient, MemberRole, MemberStatus, LeagueStatus, JoinType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const SALT_ROUNDS = 12

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// Configurazione utenti
const SUPERADMIN = {
  email: 'superadmin@fantacontratti.it',
  username: 'superadmin',
  password: 'SuperAdmin1!'
}

const LEAGUE_USERS = [
  { email: 'admin@fantacontratti.it', username: 'admin_lega', password: 'AdminLega1!', teamName: 'FC Admin' },
  { email: 'mario@fantacontratti.it', username: 'mario_rossi', password: 'Password1!', teamName: 'Rossi United' },
  { email: 'luigi@fantacontratti.it', username: 'luigi_verdi', password: 'Password1!', teamName: 'Verdi FC' },
  { email: 'paolo@fantacontratti.it', username: 'paolo_bianchi', password: 'Password1!', teamName: 'Bianchi City' },
  { email: 'marco@fantacontratti.it', username: 'marco_neri', password: 'Password1!', teamName: 'Neri Athletic' },
  { email: 'andrea@fantacontratti.it', username: 'andrea_blu', password: 'Password1!', teamName: 'Blu Rangers' },
  { email: 'luca@fantacontratti.it', username: 'luca_gialli', password: 'Password1!', teamName: 'Gialli Sport' },
  { email: 'giuseppe@fantacontratti.it', username: 'giuseppe_viola', password: 'Password1!', teamName: 'Viola Club' },
]

const LEAGUE_CONFIG = {
  name: 'Lega Fantacontratti 2025',
  description: 'Lega di test per il primo mercato',
  initialBudget: 500,
  minParticipants: 6,
  maxParticipants: 20,
  goalkeeperSlots: 3,
  defenderSlots: 8,
  midfielderSlots: 8,
  forwardSlots: 6,
}

async function main() {
  console.log('='.repeat(60))
  console.log('RESET E SETUP FANTACONTRATTI')
  console.log('='.repeat(60))

  // ========== FASE 1: PULIZIA COMPLETA ==========
  console.log('\n[1/4] Pulizia database...')

  // Ordine di cancellazione per rispettare le foreign keys
  await prisma.prophecy.deleteMany()
  await prisma.playerMovement.deleteMany()
  await prisma.auctionAcknowledgment.deleteMany()
  await prisma.auctionBid.deleteMany()
  await prisma.auction.deleteMany()
  await prisma.tradeOffer.deleteMany()
  await prisma.marketSession.deleteMany()
  await prisma.playerContract.deleteMany()
  await prisma.playerRoster.deleteMany()
  await prisma.leagueInvite.deleteMany()
  await prisma.leagueMember.deleteMany()
  await prisma.league.deleteMany()
  await prisma.quotazioniUpload.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.user.deleteMany()
  // NON cancelliamo i giocatori SerieA - li importeremo da Excel

  console.log('   Database pulito!')

  // ========== FASE 2: CREAZIONE SUPERADMIN ==========
  console.log('\n[2/4] Creazione SuperAdmin piattaforma...')

  const superadminHash = await hashPassword(SUPERADMIN.password)
  const superadmin = await prisma.user.create({
    data: {
      email: SUPERADMIN.email,
      username: SUPERADMIN.username,
      passwordHash: superadminHash,
      emailVerified: true,
      isSuperAdmin: true,
    }
  })
  console.log(`   SuperAdmin creato: ${superadmin.username} (${superadmin.email})`)

  // ========== FASE 3: CREAZIONE UTENTI LEGA ==========
  console.log('\n[3/4] Creazione 8 utenti per la lega...')

  const users = []
  for (const userData of LEAGUE_USERS) {
    const hash = await hashPassword(userData.password)
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        passwordHash: hash,
        emailVerified: true,
        isSuperAdmin: false,
      }
    })
    users.push({ ...user, teamName: userData.teamName, password: userData.password })
    console.log(`   Utente creato: ${user.username}`)
  }

  // ========== FASE 4: CREAZIONE LEGA E MEMBRI ==========
  console.log('\n[4/4] Creazione lega e assegnazione membri...')

  const league = await prisma.league.create({
    data: {
      name: LEAGUE_CONFIG.name,
      description: LEAGUE_CONFIG.description,
      initialBudget: LEAGUE_CONFIG.initialBudget,
      minParticipants: LEAGUE_CONFIG.minParticipants,
      maxParticipants: LEAGUE_CONFIG.maxParticipants,
      goalkeeperSlots: LEAGUE_CONFIG.goalkeeperSlots,
      defenderSlots: LEAGUE_CONFIG.defenderSlots,
      midfielderSlots: LEAGUE_CONFIG.midfielderSlots,
      forwardSlots: LEAGUE_CONFIG.forwardSlots,
      status: LeagueStatus.ACTIVE,
    }
  })
  console.log(`   Lega creata: ${league.name}`)

  // Aggiungi membri alla lega
  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const isAdmin = i === 0 // Il primo utente è l'admin della lega

    await prisma.leagueMember.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: isAdmin ? MemberRole.ADMIN : MemberRole.MANAGER,
        teamName: user.teamName,
        status: MemberStatus.ACTIVE,
        joinType: isAdmin ? JoinType.CREATOR : JoinType.INVITE,
        currentBudget: LEAGUE_CONFIG.initialBudget,
        firstMarketOrder: i + 1, // Ordine turno primo mercato
      }
    })
    console.log(`   Membro aggiunto: ${user.teamName} (${isAdmin ? 'ADMIN' : 'MANAGER'})`)
  }

  // ========== RIEPILOGO ==========
  console.log('\n' + '='.repeat(60))
  console.log('SETUP COMPLETATO!')
  console.log('='.repeat(60))

  console.log('\n--- CREDENZIALI SUPERADMIN PIATTAFORMA ---')
  console.log(`Email:    ${SUPERADMIN.email}`)
  console.log(`Username: ${SUPERADMIN.username}`)
  console.log(`Password: ${SUPERADMIN.password}`)
  console.log('(Usa queste credenziali per importare i giocatori da Excel)')

  console.log('\n--- CREDENZIALI ADMIN LEGA ---')
  console.log(`Email:    ${LEAGUE_USERS[0].email}`)
  console.log(`Username: ${LEAGUE_USERS[0].username}`)
  console.log(`Password: ${LEAGUE_USERS[0].password}`)
  console.log(`Team:     ${LEAGUE_USERS[0].teamName}`)
  console.log('(Usa queste credenziali per gestire la lega e il primo mercato)')

  console.log('\n--- ALTRI MANAGER ---')
  for (let i = 1; i < LEAGUE_USERS.length; i++) {
    console.log(`${i}. ${LEAGUE_USERS[i].username} / ${LEAGUE_USERS[i].password} - ${LEAGUE_USERS[i].teamName}`)
  }

  console.log('\n--- LEGA ---')
  console.log(`Nome:   ${league.name}`)
  console.log(`Budget: ${LEAGUE_CONFIG.initialBudget} crediti per manager`)
  console.log(`Status: ACTIVE`)
  console.log(`Codice invito: ${league.inviteCode}`)

  console.log('\n' + '='.repeat(60))
}

main()
  .catch(e => {
    console.error('Errore:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
