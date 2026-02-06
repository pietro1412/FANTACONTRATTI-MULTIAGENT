/**
 * Helper per test integration — crea dati test e genera token JWT
 */
import { PrismaClient, MemberRole, MemberStatus, JoinType, LeagueStatus, Position } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { generateTokens, type TokenPayload } from '../../src/utils/jwt'

const prisma = new PrismaClient({ log: ['error'] })

export interface TestContext {
  league: { id: string; name: string }
  admin: { id: string; userId: string; token: string }
  members: Array<{ id: string; userId: string; username: string; token: string }>
  players: Array<{ id: string; name: string; position: Position }>
}

/**
 * Pulisce TUTTE le tabelle del DB test (nomi PascalCase da Prisma).
 * Usa TRUNCATE CASCADE per gestire FK automaticamente.
 */
export async function cleanDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ContractConsolidation",
      "ContractHistory",
      "DraftContract",
      "PlayerMovement",
      "PlayerContract",
      "PlayerRoster",
      "AuctionBid",
      "AuctionAcknowledgment",
      "AuctionAppeal",
      "AuctionObjective",
      "Auction",
      "MarketSession",
      "ManagerSessionSnapshot",
      "IndemnityDecision",
      "TradeOffer",
      "RubataPreference",
      "LeagueInvite",
      "LeagueMember",
      "League",
      "User",
      "SerieAPlayer"
    CASCADE
  `)
}

/**
 * Crea un ambiente di test completo: league + admin + N members + players
 */
export async function seedTestData(memberCount = 4): Promise<TestContext> {
  const passwordHash = await bcrypt.hash('test123', 4)

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin-test@test.com',
      username: 'AdminTest',
      passwordHash,
      emailVerified: true,
      isSuperAdmin: false,
    },
  })

  const memberUsers = []
  for (let i = 0; i < memberCount; i++) {
    const user = await prisma.user.create({
      data: {
        email: `member${i}@test.com`,
        username: `Member${i}`,
        passwordHash,
        emailVerified: true,
        isSuperAdmin: false,
      },
    })
    memberUsers.push(user)
  }

  const league = await prisma.league.create({
    data: {
      name: `Test League ${Date.now()}`,
      initialBudget: 500,
      goalkeeperSlots: 3,
      defenderSlots: 8,
      midfielderSlots: 8,
      forwardSlots: 6,
      minParticipants: 2,
      maxParticipants: 20,
      status: LeagueStatus.ACTIVE,
    },
  })

  const adminMember = await prisma.leagueMember.create({
    data: {
      userId: adminUser.id,
      leagueId: league.id,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
      joinType: JoinType.CREATOR,
      currentBudget: 500,
      firstMarketOrder: 1,
      rubataOrder: 1,
    },
  })

  const members = []
  for (let i = 0; i < memberUsers.length; i++) {
    const member = await prisma.leagueMember.create({
      data: {
        userId: memberUsers[i]!.id,
        leagueId: league.id,
        role: MemberRole.MANAGER,
        status: MemberStatus.ACTIVE,
        joinType: JoinType.INVITE,
        currentBudget: 500,
        firstMarketOrder: i + 2,
        rubataOrder: i + 2,
      },
    })

    const payload: TokenPayload = {
      userId: memberUsers[i]!.id,
      email: memberUsers[i]!.email,
      username: memberUsers[i]!.username,
    }
    const { accessToken } = generateTokens(payload)
    members.push({
      id: member.id,
      userId: memberUsers[i]!.id,
      username: memberUsers[i]!.username,
      token: accessToken,
    })
  }

  const adminPayload: TokenPayload = {
    userId: adminUser.id,
    email: adminUser.email,
    username: adminUser.username,
  }
  const { accessToken: adminToken } = generateTokens(adminPayload)

  const playersData = [
    { name: 'TestGK1', team: 'TestTeam', position: Position.P, quotation: 10 },
    { name: 'TestDEF1', team: 'TestTeam', position: Position.D, quotation: 15 },
    { name: 'TestMID1', team: 'TestTeam', position: Position.C, quotation: 20 },
    { name: 'TestFWD1', team: 'TestTeam', position: Position.A, quotation: 30 },
    { name: 'TestFWD2', team: 'TestTeam2', position: Position.A, quotation: 50 },
  ]

  const players = []
  for (const p of playersData) {
    const player = await prisma.serieAPlayer.create({ data: p })
    players.push({ id: player.id, name: player.name, position: player.position })
  }

  return {
    league: { id: league.id, name: league.name },
    admin: { id: adminMember.id, userId: adminUser.id, token: adminToken },
    members,
    players,
  }
}

/**
 * Crea una MarketSession in fase CONTRATTI per il test
 */
export async function createContrattiSession(leagueId: string) {
  return prisma.marketSession.create({
    data: {
      leagueId,
      type: 'PRIMO_MERCATO',
      season: 1,
      semester: 1,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })
}

/**
 * Crea un roster + contratto nel DB (simula post-asta)
 */
export async function createTestRosterAndContract(opts: {
  memberId: string
  leagueId: string
  playerId: string
  playerName: string
  position: Position
  acquisitionPrice: number
  salary: number
  duration: number
  rescissionClause: number
}) {
  const roster = await prisma.playerRoster.create({
    data: {
      leagueMemberId: opts.memberId,
      playerId: opts.playerId,
      acquisitionPrice: opts.acquisitionPrice,
      acquisitionType: 'FIRST_MARKET',
      status: 'ACTIVE',
    },
  })

  const contract = await prisma.playerContract.create({
    data: {
      rosterId: roster.id,
      leagueMemberId: opts.memberId,
      salary: opts.salary,
      duration: opts.duration,
      initialSalary: opts.salary,
      initialDuration: opts.duration,
      rescissionClause: opts.rescissionClause,
    },
  })

  return { roster, contract }
}

export { prisma }
