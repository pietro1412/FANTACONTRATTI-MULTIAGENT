import { PrismaClient, MemberStatus, MemberRole, JoinType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const testUsers = [
  { username: 'manager1', email: 'manager1@test.com', password: 'test123' },
  { username: 'manager2', email: 'manager2@test.com', password: 'test123' },
  { username: 'manager3', email: 'manager3@test.com', password: 'test123' },
  { username: 'manager4', email: 'manager4@test.com', password: 'test123' },
  { username: 'manager5', email: 'manager5@test.com', password: 'test123' },
  { username: 'manager6', email: 'manager6@test.com', password: 'test123' },
  { username: 'manager7', email: 'manager7@test.com', password: 'test123' },
]

async function main() {
  console.log('🔍 Cercando la lega esistente...')

  // Find existing league
  const league = await prisma.league.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { members: true }
  })

  if (!league) {
    console.log('❌ Nessuna lega trovata. Creane una prima!')
    return
  }

  console.log(`✅ Lega trovata: "${league.name}" (ID: ${league.id})`)
  console.log(`   Status: ${league.status}`)
  console.log(`   Membri attuali: ${league.members.filter(m => m.status === 'ACTIVE').length}`)
  console.log(`   Partecipanti richiesti: ${league.minParticipants} - ${league.maxParticipants}`)
  console.log('')

  console.log('👥 Creando utenti di test...')

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      })

      let user
      if (existingUser) {
        console.log(`   ⚠️  ${userData.username} esiste già`)
        user = existingUser
      } else {
        // Create user
        const passwordHash = await bcrypt.hash(userData.password, 10)
        user = await prisma.user.create({
          data: {
            email: userData.email,
            username: userData.username,
            passwordHash,
            emailVerified: true
          }
        })
        console.log(`   ✅ Creato: ${userData.username}`)
      }

      // Check if already member of league
      const existingMember = await prisma.leagueMember.findUnique({
        where: {
          userId_leagueId: {
            userId: user.id,
            leagueId: league.id
          }
        }
      })

      if (existingMember) {
        console.log(`      → Già membro della lega`)
      } else {
        // Add to league
        await prisma.leagueMember.create({
          data: {
            userId: user.id,
            leagueId: league.id,
            role: MemberRole.MANAGER,
            status: MemberStatus.ACTIVE,
            joinType: JoinType.REQUEST,
            currentBudget: league.initialBudget
          }
        })
        console.log(`      → Aggiunto alla lega con budget ${league.initialBudget}`)
      }

    } catch (error) {
      console.log(`   ❌ Errore per ${userData.username}:`, error)
    }
  }

  // Final count
  const updatedLeague = await prisma.league.findUnique({
    where: { id: league.id },
    include: { members: { where: { status: 'ACTIVE' } } }
  })

  console.log('')
  console.log('📊 Riepilogo finale:')
  console.log(`   Membri attivi: ${updatedLeague?.members.length}`)
  console.log(`   Minimo richiesto: ${league.minParticipants}`)
  console.log('')
  console.log('🔑 Credenziali utenti di test:')
  console.log('   ┌────────────┬─────────────────────┬──────────┐')
  console.log('   │ Username   │ Email               │ Password │')
  console.log('   ├────────────┼─────────────────────┼──────────┤')
  for (const u of testUsers) {
    console.log(`   │ ${u.username.padEnd(10)} │ ${u.email.padEnd(19)} │ ${u.password.padEnd(8)} │`)
  }
  console.log('   └────────────┴─────────────────────┴──────────┘')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
