import { PrismaClient, MemberStatus, TradeStatus, RosterStatus, AcquisitionType, MarketType, SessionStatus } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const league = await p.league.findFirst({ where: { name: 'Fantacontratti Test' } })
  if (!league) { console.error('League not found'); process.exit(1) }
  const leagueId = league.id

  // Pick 2 managers
  const [mike, mirko] = await Promise.all([
    p.leagueMember.findFirst({ where: { leagueId, user: { username: 'Michele' } } }),
    p.leagueMember.findFirst({ where: { leagueId, user: { username: 'Mirko' } } }),
  ])
  if (!mike || !mirko) { console.error('Managers not found'); process.exit(1) }

  // Get some SerieAPlayer records
  const allPlayers = await p.serieAPlayer.findMany({ take: 10 })
  console.log(`Found ${allPlayers.length} SerieAPlayer records`)
  if (allPlayers.length < 6) { console.error('Not enough players'); process.exit(1) }

  const mikeSerieA = allPlayers.slice(0, 3)
  const mirkoSerieA = allPlayers.slice(3, 6)

  // Assign players to rosters for Michele
  for (const sp of mikeSerieA) {
    const existing = await p.playerRoster.findFirst({ where: { playerId: sp.id, leagueMemberId: mike.id } })
    if (!existing) {
      await p.playerRoster.create({
        data: {
          playerId: sp.id,
          leagueMemberId: mike.id,
          acquisitionPrice: 5,
          acquisitionType: AcquisitionType.FIRST_MARKET,
          status: RosterStatus.ACTIVE,
        },
      })
      console.log(`Assigned ${sp.name} to Michele`)
    }
  }

  // Assign players to rosters for Mirko
  for (const sp of mirkoSerieA) {
    const existing = await p.playerRoster.findFirst({ where: { playerId: sp.id, leagueMemberId: mirko.id } })
    if (!existing) {
      await p.playerRoster.create({
        data: {
          playerId: sp.id,
          leagueMemberId: mirko.id,
          acquisitionPrice: 5,
          acquisitionType: AcquisitionType.FIRST_MARKET,
          status: RosterStatus.ACTIVE,
        },
      })
      console.log(`Assigned ${sp.name} to Mirko`)
    }
  }

  // Create contracts for the rosters
  const mikeRosters = await p.playerRoster.findMany({ where: { leagueMemberId: mike.id, status: RosterStatus.ACTIVE } })
  const mirkoRosters = await p.playerRoster.findMany({ where: { leagueMemberId: mirko.id, status: RosterStatus.ACTIVE } })

  for (const roster of mikeRosters) {
    const existing = await p.playerContract.findFirst({ where: { rosterId: roster.id } })
    if (!existing) {
      await p.playerContract.create({
        data: { rosterId: roster.id, leagueMemberId: roster.leagueMemberId, salary: 3, duration: 1, initialSalary: 3, initialDuration: 1, rescissionClause: 10, signedAt: new Date() },
      })
    }
  }
  for (const roster of mirkoRosters) {
    const existing = await p.playerContract.findFirst({ where: { rosterId: roster.id } })
    if (!existing) {
      await p.playerContract.create({
        data: { rosterId: roster.id, leagueMemberId: roster.leagueMemberId, salary: 3, duration: 1, initialSalary: 3, initialDuration: 1, rescissionClause: 10, signedAt: new Date() },
      })
    }
  }

  // Create a market session in trade phase
  let existingSession = await p.marketSession.findFirst({ where: { leagueId, status: SessionStatus.ACTIVE } })
  if (existingSession) {
    // Update to trade phase
    await p.marketSession.update({ where: { id: existingSession.id }, data: { currentPhase: 'OFFERTE_PRE_RINNOVO' } })
    console.log('Updated existing session to trade phase:', existingSession.id)
  } else {
    existingSession = await p.marketSession.create({
      data: { leagueId, type: MarketType.MERCATO_RICORRENTE, season: 2025, semester: 1, status: SessionStatus.ACTIVE, currentPhase: 'OFFERTE_PRE_RINNOVO', startsAt: new Date() },
    })
    console.log('Created market session:', existingSession.id)
  }

  const sessionId = existingSession.id

  // Create trade: Michele sends a player to Mirko
  if (mikeRosters.length > 0 && mirkoRosters.length > 0) {
    const existingTrade = await p.tradeOffer.findFirst({
      where: { senderId: mike.userId, receiverId: mirko.userId, marketSessionId: sessionId, status: TradeStatus.PENDING },
    })
    if (!existingTrade) {
      await p.tradeOffer.create({
        data: {
          senderId: mike.userId,
          receiverId: mirko.userId,
          marketSessionId: sessionId,
          offeredPlayers: [mikeRosters[0].id],
          requestedPlayers: [mirkoRosters[0].id],
          offeredBudget: 5,
          requestedBudget: 3,
          status: TradeStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          involvedPlayers: [mikeRosters[0].id, mirkoRosters[0].id],
          message: 'Test scambio: ti offro un giocatore',
          createdAt: new Date(),
        },
      })
      console.log('Trade offer created!')
    } else {
      console.log('Trade already exists')
    }
  }

  console.log('=== SETUP COMPLETE ===')
  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
