import { PrismaClient, MemberRole, MemberStatus, JoinType, LeagueStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Script di inizializzazione per la versione production
 * Crea:
 * - Super Admin piattaforma (per caricare quotazioni)
 * - 8 utenti per la lega di prova
 * - Lega "Fantacontratti Test" con gli 8 partecipanti
 */

// Configurazione utenti
const SUPER_ADMIN = {
  email: 'admin@fantacontratti.it',
  username: 'superadmin',
  password: 'SuperAdmin2025!', // Cambiare in produzione!
}

const LEAGUE_USERS = [
  { username: 'Pietro', email: 'pietro@test.it', password: 'Pietro2025!', isAdmin: true },
  { username: 'Michele', email: 'michele@test.it', password: 'Michele2025!' },
  { username: 'Mirko', email: 'mirko@test.it', password: 'Mirko2025!' },
  { username: 'Emmanuele', email: 'emmanuele@test.it', password: 'Emmanuele2025!' },
  { username: 'Diego', email: 'diego@test.it', password: 'Diego2025!' },
  { username: 'Marco', email: 'marco@test.it', password: 'Marco2025!' },
  { username: 'Marcolino', email: 'marcolino@test.it', password: 'Marcolino2025!' },
  { username: 'Emiliano', email: 'emiliano@test.it', password: 'Emiliano2025!' },
]

const LEAGUE_CONFIG = {
  name: 'Fantacontratti Test',
  description: 'Lega di prova per testare la piattaforma',
  initialBudget: 500,
  goalkeeperSlots: 3,
  defenderSlots: 8,
  midfielderSlots: 8,
  forwardSlots: 6,
}

async function main() {
  console.log('🚀 Inizializzazione database production...\n')

  // 1. Crea Super Admin piattaforma
  console.log('👤 Creazione Super Admin piattaforma...')
  const superAdminHash = await bcrypt.hash(SUPER_ADMIN.password, 10)

  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN.email },
    update: {},
    create: {
      email: SUPER_ADMIN.email,
      username: SUPER_ADMIN.username,
      passwordHash: superAdminHash,
      emailVerified: true,
      isSuperAdmin: true,
    },
  })
  console.log(`   ✅ Super Admin creato: ${superAdmin.username}`)
  console.log(`   📧 Email: ${SUPER_ADMIN.email}`)
  console.log(`   🔑 Password: ${SUPER_ADMIN.password}\n`)

  // 2. Crea utenti della lega
  console.log('👥 Creazione utenti lega...')
  const createdUsers: { id: string; username: string; isAdmin: boolean }[] = []

  for (const userData of LEAGUE_USERS) {
    const passwordHash = await bcrypt.hash(userData.password, 10)

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        username: userData.username,
        passwordHash: passwordHash,
        emailVerified: true,
        isSuperAdmin: false,
      },
    })

    createdUsers.push({
      id: user.id,
      username: user.username,
      isAdmin: userData.isAdmin || false,
    })

    console.log(`   ✅ ${user.username} - ${userData.email} - Password: ${userData.password}`)
  }

  // 3. Crea la lega
  console.log('\n🏆 Creazione lega di prova...')

  // Prima elimina eventuale lega esistente con lo stesso nome
  const existingLeague = await prisma.league.findFirst({
    where: { name: LEAGUE_CONFIG.name }
  })

  if (existingLeague) {
    // Elimina membri esistenti
    await prisma.leagueMember.deleteMany({
      where: { leagueId: existingLeague.id }
    })
    await prisma.league.delete({
      where: { id: existingLeague.id }
    })
    console.log('   🗑️  Lega esistente eliminata')
  }

  const league = await prisma.league.create({
    data: {
      name: LEAGUE_CONFIG.name,
      description: LEAGUE_CONFIG.description,
      initialBudget: LEAGUE_CONFIG.initialBudget,
      goalkeeperSlots: LEAGUE_CONFIG.goalkeeperSlots,
      defenderSlots: LEAGUE_CONFIG.defenderSlots,
      midfielderSlots: LEAGUE_CONFIG.midfielderSlots,
      forwardSlots: LEAGUE_CONFIG.forwardSlots,
      minParticipants: 6,
      maxParticipants: 20,
      status: LeagueStatus.ACTIVE,
    },
  })
  console.log(`   ✅ Lega creata: ${league.name}`)
  console.log(`   🔗 Codice invito: ${league.inviteCode}`)

  // 4. Aggiungi membri alla lega
  console.log('\n📋 Aggiunta membri alla lega...')

  for (let i = 0; i < createdUsers.length; i++) {
    const userData = createdUsers[i]!

    await prisma.leagueMember.create({
      data: {
        userId: userData.id,
        leagueId: league.id,
        role: userData.isAdmin ? MemberRole.ADMIN : MemberRole.MANAGER,
        status: MemberStatus.ACTIVE,
        joinType: userData.isAdmin ? JoinType.CREATOR : JoinType.INVITE,
        currentBudget: LEAGUE_CONFIG.initialBudget,
        firstMarketOrder: i + 1,
        rubataOrder: i + 1,
      },
    })

    const roleLabel = userData.isAdmin ? '👑 ADMIN' : '👤 Manager'
    console.log(`   ✅ ${userData.username} - ${roleLabel}`)
  }

  // Riepilogo finale
  console.log('\n' + '='.repeat(50))
  console.log('🎉 INIZIALIZZAZIONE COMPLETATA!')
  console.log('='.repeat(50))

  console.log('\n📌 CREDENZIALI SUPER ADMIN (per caricare quotazioni):')
  console.log(`   Email: ${SUPER_ADMIN.email}`)
  console.log(`   Password: ${SUPER_ADMIN.password}`)

  console.log('\n📌 CREDENZIALI UTENTI LEGA:')
  for (const userData of LEAGUE_USERS) {
    const role = userData.isAdmin ? ' (Admin Lega)' : ''
    console.log(`   ${userData.username}${role}: ${userData.email} / ${userData.password}`)
  }

  console.log('\n📌 LEGA:')
  console.log(`   Nome: ${league.name}`)
  console.log(`   Budget iniziale: ${LEAGUE_CONFIG.initialBudget}`)
  console.log(`   Slot rosa: ${LEAGUE_CONFIG.goalkeeperSlots}P + ${LEAGUE_CONFIG.defenderSlots}D + ${LEAGUE_CONFIG.midfielderSlots}C + ${LEAGUE_CONFIG.forwardSlots}A = ${LEAGUE_CONFIG.goalkeeperSlots + LEAGUE_CONFIG.defenderSlots + LEAGUE_CONFIG.midfielderSlots + LEAGUE_CONFIG.forwardSlots}`)
}

main()
  .catch((e) => {
    console.error('❌ Errore:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
