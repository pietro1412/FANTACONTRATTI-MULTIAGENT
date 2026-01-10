import { PrismaClient, MemberStatus, MemberRole, LeagueStatus, JoinType } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// 8 utenti con password semplici
const USERS = [
  { username: 'admin_lega', email: 'admin@test.com', password: 'admin123', isAdmin: true, teamName: 'FC Admin' },
  { username: 'marco', email: 'marco@test.com', password: 'marco123', isAdmin: false, teamName: 'Squadra Marco' },
  { username: 'luca', email: 'luca@test.com', password: 'luca123', isAdmin: false, teamName: 'Luca United' },
  { username: 'giulia', email: 'giulia@test.com', password: 'giulia123', isAdmin: false, teamName: 'Giulia FC' },
  { username: 'sara', email: 'sara@test.com', password: 'sara123', isAdmin: false, teamName: 'Team Sara' },
  { username: 'andrea', email: 'andrea@test.com', password: 'andrea123', isAdmin: false, teamName: 'Andrea City' },
  { username: 'chiara', email: 'chiara@test.com', password: 'chiara123', isAdmin: false, teamName: 'Chiara Stars' },
  { username: 'davide', email: 'davide@test.com', password: 'davide123', isAdmin: false, teamName: 'Davide XI' },
]

const LEAGUE_CONFIG = {
  name: 'Fantacontratti 2025',
  description: 'Lega Dynasty Fantacalcio - Stagione 2025',
  initialBudget: 500,
  minParticipants: 8,
  maxParticipants: 8,
  goalkeeperSlots: 3,
  defenderSlots: 8,
  midfielderSlots: 8,
  forwardSlots: 6,
}

async function main() {
  console.log('🧹 RESET COMPLETO DATABASE...\n')

  // Cancellazione in ordine per rispettare le FK
  console.log('1. Cancellazione profezie...')
  await prisma.prophecy.deleteMany()

  console.log('2. Cancellazione movimenti...')
  await prisma.playerMovement.deleteMany()

  console.log('3. Cancellazione acknowledgments aste...')
  await prisma.auctionAcknowledgment.deleteMany()

  console.log('4. Cancellazione offerte aste...')
  await prisma.auctionBid.deleteMany()

  console.log('5. Cancellazione aste...')
  await prisma.auction.deleteMany()

  console.log('6. Cancellazione contratti...')
  await prisma.playerContract.deleteMany()

  console.log('7. Cancellazione roster...')
  await prisma.playerRoster.deleteMany()

  console.log('8. Cancellazione scambi...')
  await prisma.tradeOffer.deleteMany()

  console.log('9. Cancellazione consolidamenti...')
  await prisma.contractConsolidation.deleteMany()

  console.log('10. Cancellazione premi...')
  await prisma.prize.deleteMany()

  console.log('10a. Cancellazione session prizes...')
  await prisma.sessionPrize.deleteMany()

  console.log('10b. Cancellazione prize categories...')
  await prisma.prizeCategory.deleteMany()

  console.log('10c. Cancellazione prize phase configs...')
  await prisma.prizePhaseConfig.deleteMany()

  console.log('10d. Cancellazione draft contracts...')
  await prisma.draftContract.deleteMany()

  console.log('10e. Cancellazione chat messages...')
  await prisma.chatMessage.deleteMany()

  console.log('10f. Cancellazione auction appeals...')
  await prisma.auctionAppeal.deleteMany()

  console.log('11. Cancellazione sessioni mercato...')
  await prisma.marketSession.deleteMany()

  console.log('12. Cancellazione inviti lega...')
  await prisma.leagueInvite.deleteMany()

  console.log('13. Cancellazione membri lega...')
  await prisma.leagueMember.deleteMany()

  console.log('14. Cancellazione leghe...')
  await prisma.league.deleteMany()

  console.log('15. Cancellazione audit log...')
  await prisma.auditLog.deleteMany()

  console.log('16. Cancellazione upload quotazioni...')
  await prisma.quotazioniUpload.deleteMany()

  console.log('17. Cancellazione utenti (tranne superadmin)...')
  await prisma.user.deleteMany({
    where: { isSuperAdmin: false }
  })

  console.log('\n✅ Database pulito!\n')

  // Creazione utenti
  console.log('👥 Creazione 8 nuovi utenti...\n')

  const createdUsers = []
  for (const userData of USERS) {
    const passwordHash = await bcrypt.hash(userData.password, 10)
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        passwordHash,
        emailVerified: true,
      },
    })
    createdUsers.push({ ...userData, id: user.id })
    console.log(`   ✅ ${userData.username} (${userData.email})`)
  }

  // Creazione lega
  console.log('\n🏆 Creazione lega...')
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
      status: LeagueStatus.DRAFT, // Partenza dalla prima fase
    },
  })
  console.log(`   ✅ "${league.name}" creata (ID: ${league.id})`)
  console.log(`   📋 Codice invito: ${league.inviteCode}`)

  // Aggiunta membri alla lega
  console.log('\n👤 Aggiunta membri alla lega...')
  for (let i = 0; i < createdUsers.length; i++) {
    const userData = createdUsers[i]
    await prisma.leagueMember.create({
      data: {
        userId: userData.id,
        leagueId: league.id,
        role: userData.isAdmin ? MemberRole.ADMIN : MemberRole.MANAGER,
        teamName: userData.teamName,
        status: MemberStatus.ACTIVE,
        joinType: userData.isAdmin ? JoinType.CREATOR : JoinType.REQUEST,
        currentBudget: LEAGUE_CONFIG.initialBudget,
        firstMarketOrder: i, // Ordine iniziale
      },
    })
    const roleLabel = userData.isAdmin ? '👑 ADMIN' : '👤 Manager'
    console.log(`   ✅ ${userData.teamName} (${userData.username}) - ${roleLabel}`)
  }

  // Riepilogo finale
  console.log('\n')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('                    SETUP COMPLETATO!')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log(`📊 Lega: ${league.name}`)
  console.log(`📍 Status: DRAFT (pronta per essere attivata)`)
  console.log(`💰 Budget iniziale: ${LEAGUE_CONFIG.initialBudget} crediti`)
  console.log(`👥 Partecipanti: ${USERS.length}`)
  console.log('')
  console.log('🔑 CREDENZIALI UTENTI:')
  console.log('┌────────────┬──────────────────┬────────────┬─────────────────┐')
  console.log('│ Username   │ Email            │ Password   │ Ruolo           │')
  console.log('├────────────┼──────────────────┼────────────┼─────────────────┤')
  for (const u of USERS) {
    const role = u.isAdmin ? '👑 ADMIN LEGA' : 'Manager'
    console.log(`│ ${u.username.padEnd(10)} │ ${u.email.padEnd(16)} │ ${u.password.padEnd(10)} │ ${role.padEnd(15)} │`)
  }
  console.log('└────────────┴──────────────────┴────────────┴─────────────────┘')
  console.log('')
  console.log('📋 Prossimi passi:')
  console.log('   1. L\'admin deve attivare la lega dal pannello admin')
  console.log('   2. Avviare il PRIMO MERCATO ASSOLUTO')
  console.log('   3. Iniziare l\'asta per ruolo (P → D → C → A)')
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
