import { PrismaClient, MemberStatus, MemberRole, JoinType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const LEAGUE_ID = 'cmk9hsvuc00019uhl8r906gee'

const USERS_TO_ADD = [
  { username: 'marco', email: 'marco@test.com', password: 'marco123', teamName: 'Squadra Marco' },
  { username: 'luca', email: 'luca@test.com', password: 'luca123', teamName: 'Luca United' },
  { username: 'giulia', email: 'giulia@test.com', password: 'giulia123', teamName: 'Giulia FC' },
  { username: 'sara', email: 'sara@test.com', password: 'sara123', teamName: 'Team Sara' },
  { username: 'andrea', email: 'andrea@test.com', password: 'andrea123', teamName: 'Andrea City' },
  { username: 'chiara', email: 'chiara@test.com', password: 'chiara123', teamName: 'Chiara Stars' },
  { username: 'davide', email: 'davide@test.com', password: 'davide123', teamName: 'Davide XI' },
]

async function main() {
  // Get league
  const league = await prisma.league.findUnique({
    where: { id: LEAGUE_ID },
    include: { members: { include: { user: true } } }
  })

  if (!league) {
    console.log('❌ Lega non trovata:', LEAGUE_ID)
    return
  }

  console.log(`\n📋 Lega: ${league.name}`)
  console.log(`   Status: ${league.status}`)
  console.log(`   Membri attuali: ${league.members.length}`)

  league.members.forEach(m => {
    console.log(`   - ${m.user.username} (${m.role})`)
  })

  const neededMembers = 8 - league.members.length
  console.log(`\n   Da aggiungere: ${neededMembers}`)

  if (neededMembers <= 0) {
    console.log('\n✅ La lega ha già 8 o più membri!')
    return
  }

  const usersToCreate = USERS_TO_ADD.slice(0, neededMembers)
  const createdUsers: { username: string; password: string }[] = []

  for (let i = 0; i < usersToCreate.length; i++) {
    const userData = usersToCreate[i]

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: userData.email }
    })

    if (!user) {
      const passwordHash = await bcrypt.hash(userData.password, 10)
      user = await prisma.user.create({
        data: {
          email: userData.email,
          username: userData.username,
          passwordHash,
          emailVerified: true,
        }
      })
      console.log(`   ✅ Creato utente: ${userData.username}`)
    } else {
      console.log(`   ⚠️  Utente esistente: ${userData.username}`)
    }

    // Check if already member
    const existingMember = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: user.id,
          leagueId: LEAGUE_ID
        }
      }
    })

    if (!existingMember) {
      await prisma.leagueMember.create({
        data: {
          userId: user.id,
          leagueId: LEAGUE_ID,
          role: MemberRole.MANAGER,
          teamName: userData.teamName,
          status: MemberStatus.ACTIVE,
          joinType: JoinType.REQUEST,
          currentBudget: league.initialBudget,
          firstMarketOrder: league.members.length + i,
        }
      })
      console.log(`   ✅ Aggiunto alla lega: ${userData.teamName}`)
    }

    createdUsers.push({ username: userData.username, password: userData.password })
  }

  // Final count
  const updatedLeague = await prisma.league.findUnique({
    where: { id: LEAGUE_ID },
    include: { members: { where: { status: 'ACTIVE' } } }
  })

  console.log('\n')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('                    MEMBRI AGGIUNTI')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log(`📊 Lega: ${league.name}`)
  console.log(`👥 Membri totali: ${updatedLeague?.members.length}`)
  console.log('')
  console.log('🔑 CREDENZIALI NUOVI UTENTI:')
  console.log('┌────────────┬────────────┐')
  console.log('│ Username   │ Password   │')
  console.log('├────────────┼────────────┤')
  for (const u of createdUsers) {
    console.log(`│ ${u.username.padEnd(10)} │ ${u.password.padEnd(10)} │`)
  }
  console.log('└────────────┴────────────┘')
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
