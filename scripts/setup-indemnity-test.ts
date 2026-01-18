/**
 * Script to set up test data for indemnity phase testing
 *
 * This script will:
 * 1. Create test users (superadmin, admin, managers)
 * 2. Create a league with members
 * 3. Complete a first market with players assigned to managers
 * 4. Mark some players as NOT_IN_LIST with exit reasons to simulate indemnity scenario
 */

import { PrismaClient, MemberRole, MemberStatus, JoinType, RosterStatus, PlayerListStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Setting up indemnity test scenario...\n')

  // 0. Cleanup existing test data
  console.log('0. Cleaning up existing test data...')
  try {
    // Delete in correct order due to foreign keys
    await prisma.sessionPrize.deleteMany({ where: { prizeCategory: { marketSession: { leagueId: 'test-league-indemnity' } } } })
    await prisma.prizeCategory.deleteMany({ where: { marketSession: { leagueId: 'test-league-indemnity' } } })
    await prisma.prizePhaseConfig.deleteMany({ where: { marketSession: { leagueId: 'test-league-indemnity' } } })
    await prisma.playerMovement.deleteMany({ where: { leagueId: 'test-league-indemnity' } })
    await prisma.playerContract.deleteMany({ where: { leagueMember: { leagueId: 'test-league-indemnity' } } })
    await prisma.playerRoster.deleteMany({ where: { leagueMember: { leagueId: 'test-league-indemnity' } } })
    await prisma.indemnityDecision.deleteMany({ where: { session: { leagueId: 'test-league-indemnity' } } })
    await prisma.marketSession.deleteMany({ where: { leagueId: 'test-league-indemnity' } })
    await prisma.leagueMember.deleteMany({ where: { leagueId: 'test-league-indemnity' } })
    await prisma.league.deleteMany({ where: { id: 'test-league-indemnity' } })
    // Reset player exit status
    await prisma.serieAPlayer.updateMany({
      where: { exitReason: { not: null } },
      data: { listStatus: 'IN_LIST', exitReason: null, exitDate: null }
    })
    console.log('   ✓ Cleanup complete')
  } catch (e) {
    console.log('   ✓ No existing data to clean')
  }

  // 1. Create SuperAdmin
  console.log('1. Creating SuperAdmin...')
  const superadminPassword = await bcrypt.hash('super123', 10)
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@test.com' },
    update: {
      isSuperAdmin: true, // Ensure superadmin flag is set even if user already exists
      passwordHash: superadminPassword,
      emailVerified: true,
    },
    create: {
      email: 'superadmin@test.com',
      username: 'SuperAdmin',
      passwordHash: superadminPassword,
      isSuperAdmin: true,
      emailVerified: true,
    },
  })
  console.log(`   ✓ SuperAdmin: ${superadmin.email}`)

  // 2. Create Admin and Managers
  console.log('\n2. Creating Admin and Managers...')
  const password = await bcrypt.hash('test123', 10)
  const adminPassword = await bcrypt.hash('admin123', 10)

  const users = [
    { email: 'pietro@test.com', username: 'Pietro', passwordHash: adminPassword },
    { email: 'mario@test.com', username: 'Mario', passwordHash: password },
    { email: 'luigi@test.com', username: 'Luigi', passwordHash: password },
    { email: 'peach@test.com', username: 'Peach', passwordHash: password },
  ]

  const createdUsers = []
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        emailVerified: true,
      },
    })
    createdUsers.push(user)
    console.log(`   ✓ ${user.username}: ${user.email}`)
  }

  // 3. Create League
  console.log('\n3. Creating League...')
  const league = await prisma.league.upsert({
    where: { id: 'test-league-indemnity' },
    update: {},
    create: {
      id: 'test-league-indemnity',
      name: 'Test Indennizzi League',
      description: 'League for testing indemnity phase',
      maxParticipants: 8,
      initialBudget: 500,
      currentSeason: 1,
      goalkeeperSlots: 3,
      defenderSlots: 8,
      midfielderSlots: 8,
      forwardSlots: 6,
      status: 'ACTIVE',
    },
  })
  console.log(`   ✓ League: ${league.name}`)

  // 4. Add members to league
  console.log('\n4. Adding members to league...')
  const teamNames = ['FC Pietro', 'AC Mario', 'AS Luigi', 'US Peach']
  const members = []

  for (let i = 0; i < createdUsers.length; i++) {
    const member = await prisma.leagueMember.upsert({
      where: {
        userId_leagueId: {
          leagueId: league.id,
          userId: createdUsers[i].id,
        },
      },
      update: {},
      create: {
        leagueId: league.id,
        userId: createdUsers[i].id,
        role: i === 0 ? MemberRole.ADMIN : MemberRole.MANAGER,
        status: MemberStatus.ACTIVE,
        joinType: JoinType.CREATED,
        teamName: teamNames[i],
        currentBudget: 200, // Remaining budget after first market
      },
    })
    members.push(member)
    console.log(`   ✓ ${teamNames[i]} (${i === 0 ? 'Admin' : 'Manager'})`)
  }

  // 5. Get players from database
  console.log('\n5. Getting players from database...')
  const allPlayers = await prisma.serieAPlayer.findMany({
    orderBy: { quotation: 'desc' },
  })
  console.log(`   ✓ Found ${allPlayers.length} players`)

  // 6. Create a completed market session
  console.log('\n6. Creating completed first market session...')
  const marketSession = await prisma.marketSession.upsert({
    where: { id: 'test-session-indemnity' },
    update: {},
    create: {
      id: 'test-session-indemnity',
      leagueId: league.id,
      type: 'PRIMO_MERCATO',
      season: 1,
      semester: 1, // 1 = estivo
      status: 'COMPLETED',
      currentPhase: null,
    },
  })
  console.log(`   ✓ First Market Session created (COMPLETED)`)

  // 7. Assign players to managers with contracts
  console.log('\n7. Assigning players to managers with contracts...')

  // Group players by position
  const playersByPosition = {
    P: allPlayers.filter(p => p.position === 'P').slice(0, 12), // 3 per manager
    D: allPlayers.filter(p => p.position === 'D').slice(0, 20), // 5 per manager
    C: allPlayers.filter(p => p.position === 'C').slice(0, 20), // 5 per manager
    A: allPlayers.filter(p => p.position === 'A').slice(0, 16), // 4 per manager
  }

  let playerIndex = { P: 0, D: 0, C: 0, A: 0 }
  const assignedRosters: Array<{ roster: any; player: any; member: any }> = []

  for (const member of members) {
    // Assign goalkeepers (3)
    for (let i = 0; i < 3; i++) {
      const player = playersByPosition.P[playerIndex.P++]
      if (player) {
        const roster = await createRosterWithContract(member, player, marketSession.id, league)
        assignedRosters.push({ roster, player, member })
      }
    }
    // Assign defenders (5)
    for (let i = 0; i < 5; i++) {
      const player = playersByPosition.D[playerIndex.D++]
      if (player) {
        const roster = await createRosterWithContract(member, player, marketSession.id, league)
        assignedRosters.push({ roster, player, member })
      }
    }
    // Assign midfielders (5)
    for (let i = 0; i < 5; i++) {
      const player = playersByPosition.C[playerIndex.C++]
      if (player) {
        const roster = await createRosterWithContract(member, player, marketSession.id, league)
        assignedRosters.push({ roster, player, member })
      }
    }
    // Assign forwards (4)
    for (let i = 0; i < 4; i++) {
      const player = playersByPosition.A[playerIndex.A++]
      if (player) {
        const roster = await createRosterWithContract(member, player, marketSession.id, league)
        assignedRosters.push({ roster, player, member })
      }
    }
    console.log(`   ✓ Assigned 17 players to ${member.teamName}`)
  }

  // 8. Mark some players as exited (to simulate indemnity scenario)
  console.log('\n8. Marking players as exited from Serie A...')

  // For each manager, mark 3 players as exited (one per exit reason)
  const exitReasons = ['RITIRATO', 'RETROCESSO', 'ESTERO'] as const
  let exitedCount = 0

  for (const member of members) {
    const memberRosters = assignedRosters.filter(r => r.member.id === member.id)

    // Select 3 players from different positions to mark as exited
    const playersToExit = [
      memberRosters.find(r => r.player.position === 'A'),
      memberRosters.find(r => r.player.position === 'C'),
      memberRosters.find(r => r.player.position === 'D'),
    ].filter(Boolean)

    for (let i = 0; i < playersToExit.length; i++) {
      const { player } = playersToExit[i]!
      const exitReason = exitReasons[i % 3]

      await prisma.serieAPlayer.update({
        where: { id: player.id },
        data: {
          listStatus: PlayerListStatus.NOT_IN_LIST,
          exitReason: exitReason,
          exitDate: new Date(),
        },
      })

      console.log(`   ✓ ${player.name} (${member.teamName}) → ${exitReason}`)
      exitedCount++
    }
  }

  // 9. Create a new market session in PREMI phase (recurring market)
  console.log('\n9. Creating new market session in PREMI phase...')
  const newSession = await prisma.marketSession.upsert({
    where: { id: 'test-session-ricorrente' },
    update: {
      status: 'ACTIVE',
      currentPhase: 'PREMI',
    },
    create: {
      id: 'test-session-ricorrente',
      leagueId: league.id,
      type: 'MERCATO_RICORRENTE',
      season: 1,
      semester: 2, // 2 = invernale
      status: 'ACTIVE',
      currentPhase: 'PREMI',
    },
  })
  console.log(`   ✓ Recurring Market Session created (PREMI phase)`)

  // 10. Create prize phase config with Indennizzo category
  console.log('\n10. Setting up prize phase with Indennizzo category...')

  const prizeConfig = await prisma.prizePhaseConfig.upsert({
    where: { marketSessionId: newSession.id },
    update: {},
    create: {
      marketSessionId: newSession.id,
      baseReincrement: 50,
      isFinalized: false,
    },
  })

  // Create Indennizzo Partenza Estero category
  const indennizzoCategory = await prisma.prizeCategory.upsert({
    where: {
      marketSessionId_name: {
        marketSessionId: newSession.id,
        name: 'Indennizzo Partenza Estero',
      },
    },
    update: {},
    create: {
      marketSessionId: newSession.id,
      name: 'Indennizzo Partenza Estero',
      isSystemPrize: true,
    },
  })

  // Create default indennizzo prizes for each member
  for (const member of members) {
    await prisma.sessionPrize.upsert({
      where: {
        prizeCategoryId_leagueMemberId: {
          prizeCategoryId: indennizzoCategory.id,
          leagueMemberId: member.id,
        },
      },
      update: {},
      create: {
        prizeCategoryId: indennizzoCategory.id,
        leagueMemberId: member.id,
        amount: 50, // Default 50M
      },
    })
  }
  console.log(`   ✓ Prize phase config and Indennizzo category created`)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('✅ TEST SCENARIO READY!')
  console.log('='.repeat(60))
  console.log(`
📋 SCENARIO:
   - League: ${league.name}
   - 4 managers with 17 players each
   - ${exitedCount} players marked as exited (need indemnity processing)

🔑 CREDENTIALS:
   SuperAdmin: superadmin@test.com / super123
   Admin Lega: pietro@test.com / admin123
   Manager:    mario@test.com / test123

🧪 TESTING FLOW:
   1. Login as SuperAdmin → SuperAdmin Panel
   2. Go to "Giocatori Usciti" section to classify exit reasons
   3. Login as Admin Lega (pietro@test.com)
   4. Go to Market Session → currently in PREMI phase
   5. Configure prizes and advance to CALCOLO_INDENNIZZI phase
   6. Managers will see their affected players and make KEEP/RELEASE decisions

🌐 URL: http://localhost:5173
`)
}

async function createRosterWithContract(
  member: any,
  player: any,
  sessionId: string,
  league: any
) {
  const acquisitionPrice = player.quotation + Math.floor(Math.random() * 20)
  const salary = Math.ceil(player.quotation * 0.2)
  const duration = 2 + Math.floor(Math.random() * 2) // 2-3 years
  const rescissionClause = Math.ceil(acquisitionPrice * 0.5) // 50% rescission clause

  const roster = await prisma.playerRoster.create({
    data: {
      leagueMemberId: member.id,
      playerId: player.id,
      status: RosterStatus.ACTIVE,
      acquisitionType: 'FIRST_MARKET',
      acquisitionPrice,
      acquiredAt: new Date(),
      contract: {
        create: {
          leagueMemberId: member.id,
          salary,
          initialSalary: salary,
          duration,
          initialDuration: duration,
          rescissionClause,
          signedAt: new Date(),
        },
      },
    },
  })

  // Record movement
  await prisma.playerMovement.create({
    data: {
      leagueId: league.id,
      playerId: player.id,
      movementType: 'FIRST_MARKET',
      toMemberId: member.id,
      price: acquisitionPrice,
      marketSessionId: sessionId,
      newSalary: salary,
      newDuration: duration,
      newClause: rescissionClause,
    },
  })

  return roster
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
