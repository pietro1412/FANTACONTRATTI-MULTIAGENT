import { PrismaClient, MemberStatus, AuctionStatus, Position, AuctionType } from '@prisma/client'
import { placeBid } from './auction.service'

const prisma = new PrismaClient()

// ==================== BOT NOMINATION FOR FIRST MARKET ====================

/**
 * When it's a bot's turn to nominate, select a random available player
 * and nominate them (set pending nomination)
 */
export async function botNominate(
  sessionId: string,
  excludeUserId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (session.type !== 'PRIMO_MERCATO') {
    return { success: false, message: 'Bot nomination solo per PRIMO_MERCATO' }
  }

  if (session.pendingNominationPlayerId) {
    return { success: false, message: 'C\'è già una nomination in attesa' }
  }

  // Check for existing active auction
  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: 'ACTIVE',
    },
  })

  if (existingAuction) {
    return { success: false, message: 'C\'è già un\'asta attiva' }
  }

  const turnOrder = session.turnOrder as string[] | null
  if (!turnOrder || turnOrder.length === 0) {
    return { success: false, message: 'Ordine turni non impostato' }
  }

  const currentRole = session.currentRole ?? 'P'
  const currentTurnIndex = session.currentTurnIndex ?? 0

  const slotLimits: Record<string, number> = {
    P: session.league.goalkeeperSlots,
    D: session.league.defenderSlots,
    C: session.league.midfielderSlots,
    A: session.league.forwardSlots,
  }

  // Find current nominator
  let currentNominator: { id: string; userId: string } | null = null
  for (let i = 0; i < turnOrder.length; i++) {
    const idx = (currentTurnIndex + i) % turnOrder.length
    const memberId = turnOrder[idx]

    const member = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      include: {
        roster: {
          where: { status: 'ACTIVE' },
          include: { player: true },
        },
      },
    })

    if (member) {
      const roleCount = member.roster.filter(r => r.player.position === currentRole).length
      if (roleCount < (slotLimits[currentRole] ?? 0)) {
        currentNominator = { id: member.id, userId: member.userId }
        break
      }
    }
  }

  if (!currentNominator) {
    return { success: false, message: 'Nessun nominatore trovato (tutti hanno completato il ruolo)' }
  }

  // Check if the current nominator is the real user (not a bot)
  if (currentNominator.userId === excludeUserId) {
    return { success: false, message: 'È il turno del giocatore reale, non di un bot' }
  }

  // Bot needs to nominate - get available players of the current role
  const alreadyRosteredPlayerIds = await prisma.playerRoster.findMany({
    where: {
      status: 'ACTIVE',
      leagueMember: { leagueId: session.leagueId },
    },
    select: { playerId: true },
  }).then(r => r.map(x => x.playerId))

  const availablePlayers = await prisma.serieAPlayer.findMany({
    where: {
      position: currentRole,
      id: { notIn: alreadyRosteredPlayerIds },
    },
    orderBy: { quotation: 'desc' },
    take: 50, // Get top 50 by quotation
  })

  if (availablePlayers.length === 0) {
    return { success: false, message: `Nessun giocatore disponibile per il ruolo ${currentRole}` }
  }

  // Select a random player from top players (weighted towards higher quotation)
  const randomIndex = Math.floor(Math.random() * Math.min(20, availablePlayers.length))
  const selectedPlayer = availablePlayers[randomIndex]

  if (!selectedPlayer) {
    return { success: false, message: 'Errore nella selezione del giocatore' }
  }

  // Create the pending nomination (nominator must confirm separately)
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      pendingNominationPlayerId: selectedPlayer.id,
      pendingNominatorId: currentNominator.id,
      nominatorConfirmed: false, // Nominator must confirm separately
      readyMembers: [], // Reset ready members
    },
  })

  return {
    success: true,
    message: `Bot ha nominato ${selectedPlayer.name}`,
    data: {
      player: selectedPlayer,
      nominatorId: currentNominator.id,
    },
  }
}

/**
 * Confirm the pending nomination (simulates nominator confirming their choice)
 * This adds the nominator to readyMembers and allows others to mark ready
 */
export async function botConfirmNomination(
  sessionId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: {
      pendingNominationPlayer: true,
    },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (!session.pendingNominationPlayerId) {
    return { success: false, message: 'Nessuna nomination in attesa da confermare' }
  }

  if (session.nominatorConfirmed) {
    return { success: false, message: 'La nomination è già stata confermata' }
  }

  const nominatorId = session.pendingNominatorId
  if (!nominatorId) {
    return { success: false, message: 'Nominatore non trovato' }
  }

  // Confirm the nomination and add nominator to ready members
  const readyMembers = [nominatorId]

  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      nominatorConfirmed: true,
      readyMembers,
    },
  })

  return {
    success: true,
    message: `Nomination confermata per ${session.pendingNominationPlayer?.name}`,
    data: {
      player: session.pendingNominationPlayer,
      nominatorId,
    },
  }
}

/**
 * Simulate all bot managers marking ready for a pending nomination
 */
export async function botMarkAllReady(
  sessionId: string,
  excludeUserId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (!session.pendingNominationPlayerId) {
    return { success: false, message: 'Nessuna nomination in attesa' }
  }

  // Get all members
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  // Mark all bots as ready
  const readyMembers = (session.readyMembers as string[]) || []

  for (const member of allMembers) {
    if (member.userId !== excludeUserId && !readyMembers.includes(member.id)) {
      readyMembers.push(member.id)
    }
  }

  await prisma.marketSession.update({
    where: { id: sessionId },
    data: { readyMembers },
  })

  // Check if all are ready
  const allReady = readyMembers.length >= allMembers.length

  if (allReady) {
    // Start the auction
    const player = await prisma.serieAPlayer.findUnique({
      where: { id: session.pendingNominationPlayerId },
    })

    const nominatorId = session.pendingNominatorId!
    const nominator = await prisma.leagueMember.findUnique({
      where: { id: nominatorId },
    })

    const timerSeconds = session.auctionTimerSeconds
    const timerExpires = new Date(Date.now() + timerSeconds * 1000)

    const auction = await prisma.auction.create({
      data: {
        leagueId: session.leagueId,
        marketSessionId: sessionId,
        playerId: session.pendingNominationPlayerId,
        type: AuctionType.FREE_BID,
        basePrice: 1,
        currentPrice: 1,
        nominatorId,
        status: AuctionStatus.ACTIVE,
        timerExpiresAt: timerExpires,
        timerSeconds,
        startsAt: new Date(),
      },
    })

    // Nominator places first bid
    await prisma.auctionBid.create({
      data: {
        auctionId: auction.id,
        bidderId: nominatorId,
        userId: nominator!.userId,
        amount: 1,
        isWinning: true,
      },
    })

    // Clear pending nomination
    await prisma.marketSession.update({
      where: { id: sessionId },
      data: {
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        readyMembers: [],
      },
    })

    return {
      success: true,
      message: `Asta per ${player?.name} iniziata!`,
      data: {
        auctionStarted: true,
        auctionId: auction.id,
        player,
      },
    }
  }

  return {
    success: true,
    message: `Bot hanno confermato (${readyMembers.length}/${allMembers.length})`,
    data: {
      auctionStarted: false,
      readyCount: readyMembers.length,
      totalMembers: allMembers.length,
    },
  }
}

/**
 * Complete bot turn: nominate if it's bot's turn, mark ready, and optionally bid
 */
export async function completeBotTurn(
  sessionId: string,
  excludeUserId: string
): Promise<ServiceResult> {
  // Step 1: Check if there's an active auction - if so, trigger bot bidding
  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: 'ACTIVE',
    },
  })

  if (existingAuction) {
    // There's an active auction, trigger bot bidding
    return await simulateFirstMarketBotBidding(existingAuction.id, excludeUserId)
  }

  // Step 2: Check if there's a pending nomination - mark bots ready
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (session?.pendingNominationPlayerId) {
    // There's a pending nomination, mark bots as ready
    return await botMarkAllReady(sessionId, excludeUserId)
  }

  // Step 3: No auction and no pending nomination - check if it's a bot's turn to nominate
  return await botNominate(sessionId, excludeUserId)
}

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// Bot behavior types
type BotBehavior = 'aggressive' | 'moderate' | 'conservative' | 'random'

interface BotConfig {
  // Probability (0-1) that the bot will bid on this auction
  bidProbability: number
  // Max multiplier over quotation the bot is willing to pay
  maxQuotationMultiplier: number
  // Min increment over current price
  minIncrement: number
  // Max increment over current price
  maxIncrement: number
  // Behavior type
  behavior: BotBehavior
}

// Default bot configurations based on behavior
// Made more aggressive for testing - bots will bid more often and higher
const BOT_CONFIGS: Record<BotBehavior, BotConfig> = {
  aggressive: {
    bidProbability: 0.95,
    maxQuotationMultiplier: 10.0, // Will pay up to 10x quotation
    minIncrement: 1,
    maxIncrement: 5,
    behavior: 'aggressive',
  },
  moderate: {
    bidProbability: 0.85,
    maxQuotationMultiplier: 6.0, // Will pay up to 6x quotation
    minIncrement: 1,
    maxIncrement: 3,
    behavior: 'moderate',
  },
  conservative: {
    bidProbability: 0.70,
    maxQuotationMultiplier: 4.0, // Will pay up to 4x quotation
    minIncrement: 1,
    maxIncrement: 2,
    behavior: 'conservative',
  },
  random: {
    bidProbability: 0.80,
    maxQuotationMultiplier: 5.0, // Will pay up to 5x quotation
    minIncrement: 1,
    maxIncrement: 4,
    behavior: 'random',
  },
}

// Assign a random behavior to a bot based on some criteria
function assignBotBehavior(memberIndex: number): BotBehavior {
  const behaviors: BotBehavior[] = ['aggressive', 'moderate', 'conservative', 'random']
  return behaviors[memberIndex % behaviors.length] as BotBehavior
}

// Get a random number between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ==================== SIMULATE BOT BIDDING ====================

export async function simulateBotBidding(
  auctionId: string,
  excludeUserId: string // The real user's ID - exclude from bot simulation
): Promise<ServiceResult> {
  // Get the active auction
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      bids: {
        orderBy: { amount: 'desc' },
        take: 1,
      },
      league: true,
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.status !== AuctionStatus.ACTIVE) {
    return { success: false, message: 'Asta non attiva' }
  }

  // Get all league members except the real user
  const botMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: auction.leagueId,
      userId: { not: excludeUserId },
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
    },
  })

  if (botMembers.length === 0) {
    return { success: false, message: 'Nessun bot disponibile' }
  }

  const playerQuotation = auction.player.quotation
  const currentPrice = auction.currentPrice
  const position = auction.player.position

  // Get league slot configuration
  const slotMap: Record<Position, number> = {
    P: auction.league.goalkeeperSlots,
    D: auction.league.defenderSlots,
    C: auction.league.midfielderSlots,
    A: auction.league.forwardSlots,
  }

  const botBids: Array<{ botName: string; amount: number; reason: string }> = []
  let highestBid = currentPrice
  let winningBotId: string | null = null

  // Shuffle bots to add randomness
  const shuffledBots = [...botMembers].sort(() => Math.random() - 0.5)

  for (const bot of shuffledBots) {
    const behavior = assignBotBehavior(shuffledBots.indexOf(bot))
    const config = BOT_CONFIGS[behavior]

    // Check if bot wants to bid (probability check)
    if (Math.random() > config.bidProbability) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Non interessato (${behavior})`,
      })
      continue
    }

    // Check if bot has budget
    if (bot.currentBudget <= highestBid) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Budget insufficiente (${bot.currentBudget})`,
      })
      continue
    }

    // Check if bot has roster slot
    const botRoster = await prisma.playerRoster.findMany({
      where: {
        leagueMemberId: bot.id,
        status: 'ACTIVE',
      },
      include: { player: true },
    })

    const positionCount = botRoster.filter(r => r.player.position === position).length
    if (positionCount >= slotMap[position]) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Slot ${position} pieni`,
      })
      continue
    }

    // Calculate max price bot is willing to pay
    // Use at least 20 as minimum willing price, or quotation * multiplier, whichever is higher
    const maxWillingPrice = Math.max(20, Math.floor(playerQuotation * config.maxQuotationMultiplier))

    if (maxWillingPrice <= highestBid) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Prezzo troppo alto (max: ${maxWillingPrice})`,
      })
      continue
    }

    // Calculate bid amount
    const increment = randomInt(config.minIncrement, config.maxIncrement)
    let bidAmount = highestBid + increment

    // Cap at max willing price and budget
    bidAmount = Math.min(bidAmount, maxWillingPrice, bot.currentBudget)

    // Make sure bid is higher than current
    if (bidAmount <= highestBid) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Offerta non conveniente`,
      })
      continue
    }

    // Place the bid
    botBids.push({
      botName: bot.user.username,
      amount: bidAmount,
      reason: `${behavior} - offerta ${bidAmount}`,
    })

    // Update highest bid for next bot
    highestBid = bidAmount
    winningBotId = bot.id
  }

  // If any bot made a valid bid, update the auction
  if (winningBotId) {
    const winningBot = botMembers.find(b => b.id === winningBotId)!

    await prisma.$transaction(async (tx) => {
      // Mark previous bids as not winning
      await tx.auctionBid.updateMany({
        where: { auctionId },
        data: { isWinning: false },
      })

      // Create new bid
      await tx.auctionBid.create({
        data: {
          auctionId,
          bidderId: winningBotId!,
          userId: winningBot.userId,
          amount: highestBid,
          isWinning: true,
        },
      })

      // Update auction current price
      await tx.auction.update({
        where: { id: auctionId },
        data: { currentPrice: highestBid },
      })
    })
  }

  return {
    success: true,
    message: winningBotId
      ? `Bot ha offerto ${highestBid}`
      : 'Nessun bot ha fatto offerte',
    data: {
      botBids,
      newCurrentPrice: highestBid,
      hasBotBid: !!winningBotId,
    },
  }
}

// ==================== AUTO-BID MODE: Multiple rounds of bot bidding ====================

export async function runBotAuctionRounds(
  auctionId: string,
  excludeUserId: string,
  maxRounds: number = 10,
  delayMs: number = 500
): Promise<ServiceResult> {
  const results: Array<{ round: number; bidder: string; amount: number }> = []
  let round = 0
  let consecutiveNoBids = 0

  while (round < maxRounds && consecutiveNoBids < 3) {
    round++

    // Simulate bot bidding
    const result = await simulateBotBidding(auctionId, excludeUserId)

    if (!result.success) {
      break
    }

    const data = result.data as { hasBotBid: boolean; newCurrentPrice: number; botBids: Array<{ botName: string; amount: number }> }

    if (data.hasBotBid) {
      const winningBid = data.botBids.find(b => b.amount > 0)
      if (winningBid) {
        results.push({
          round,
          bidder: winningBid.botName,
          amount: winningBid.amount,
        })
      }
      consecutiveNoBids = 0
    } else {
      consecutiveNoBids++
    }

    // Small delay between rounds
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return {
    success: true,
    message: `Completati ${round} round di offerte bot`,
    data: {
      rounds: round,
      bids: results,
    },
  }
}

// ==================== GET BOT MEMBERS INFO ====================

export async function getBotMembers(
  leagueId: string,
  excludeUserId: string
): Promise<ServiceResult> {
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      userId: { not: excludeUserId },
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: { select: { position: true } } },
      },
    },
  })

  return {
    success: true,
    data: members.map((m, i) => ({
      id: m.id,
      username: m.user.username,
      teamName: m.teamName,
      budget: m.currentBudget,
      behavior: assignBotBehavior(i),
      rosterCount: m.roster.length,
      rosterByPosition: {
        P: m.roster.filter(r => r.player.position === 'P').length,
        D: m.roster.filter(r => r.player.position === 'D').length,
        C: m.roster.filter(r => r.player.position === 'C').length,
        A: m.roster.filter(r => r.player.position === 'A').length,
      },
    })),
  }
}

// ==================== FIRST MARKET BOT BIDDING ====================
// Uses placeBid from auction.service.ts which works for any active auction

export async function simulateFirstMarketBotBidding(
  auctionId: string,
  excludeUserId: string
): Promise<ServiceResult> {
  const startTime = Date.now()
  console.log(`[BOT-TIMING] === Start simulateFirstMarketBotBidding ===`)

  // Get the active auction
  const t1 = Date.now()
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      league: true,
      bids: {
        orderBy: { amount: 'desc' },
        take: 1,
      },
    },
  })
  console.log(`[BOT-TIMING] Query auction: ${Date.now() - t1}ms`)

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.status !== AuctionStatus.ACTIVE) {
    return { success: false, message: 'Asta non attiva' }
  }

  // Get all league members except the real user
  const t2 = Date.now()
  const botMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: auction.leagueId,
      userId: { not: excludeUserId },
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { id: true, username: true } },
    },
  })
  console.log(`[BOT-TIMING] Query botMembers: ${Date.now() - t2}ms`)

  if (botMembers.length === 0) {
    return { success: false, message: 'Nessun bot disponibile' }
  }

  const playerQuotation = auction.player.quotation
  const currentPrice = auction.currentPrice
  const position = auction.player.position

  // Get league slot configuration
  const slotMap: Record<Position, number> = {
    P: auction.league.goalkeeperSlots,
    D: auction.league.defenderSlots,
    C: auction.league.midfielderSlots,
    A: auction.league.forwardSlots,
  }

  const botBids: Array<{ botName: string; amount: number; reason: string }> = []
  let bestBidAmount = currentPrice
  let bestBidBot: typeof botMembers[0] | null = null

  // Shuffle bots to add randomness
  const shuffledBots = [...botMembers].sort(() => Math.random() - 0.5)

  for (const bot of shuffledBots) {
    const behavior = assignBotBehavior(shuffledBots.indexOf(bot))
    const config = BOT_CONFIGS[behavior]

    // Check if bot wants to bid (probability check)
    if (Math.random() > config.bidProbability) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Non interessato (${behavior})`,
      })
      continue
    }

    // Check if bot has budget
    if (bot.currentBudget <= bestBidAmount) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Budget insufficiente (${bot.currentBudget})`,
      })
      continue
    }

    // Check if bot has roster slot
    const botRoster = await prisma.playerRoster.findMany({
      where: {
        leagueMemberId: bot.id,
        status: 'ACTIVE',
      },
      include: { player: true },
    })

    const positionCount = botRoster.filter(r => r.player.position === position).length
    if (positionCount >= slotMap[position]) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Slot ${position} pieni`,
      })
      continue
    }

    // Calculate max price bot is willing to pay
    // Use at least 20 as minimum willing price, or quotation * multiplier, whichever is higher
    const maxWillingPrice = Math.max(20, Math.floor(playerQuotation * config.maxQuotationMultiplier))

    if (maxWillingPrice <= bestBidAmount) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Prezzo troppo alto (max: ${maxWillingPrice})`,
      })
      continue
    }

    // Calculate bid amount
    const increment = randomInt(config.minIncrement, config.maxIncrement)
    let bidAmount = bestBidAmount + increment

    // Cap at max willing price and budget
    bidAmount = Math.min(bidAmount, maxWillingPrice, bot.currentBudget)

    // Make sure bid is higher than current
    if (bidAmount <= bestBidAmount) {
      botBids.push({
        botName: bot.user.username,
        amount: 0,
        reason: `Offerta non conveniente`,
      })
      continue
    }

    // This bot wants to bid - track as potential best
    if (bidAmount > bestBidAmount) {
      bestBidAmount = bidAmount
      bestBidBot = bot
      botBids.push({
        botName: bot.user.username,
        amount: bidAmount,
        reason: `${behavior} - offerta ${bidAmount}`,
      })
    }
  }

  // Log bot decisions for debugging
  console.log('=== BOT BIDDING DEBUG ===')
  console.log(`Player: ${auction.player.name}, Quotation: ${playerQuotation}, Current Price: ${currentPrice}`)
  console.log(`Total bots evaluated: ${botBids.length}`)
  for (const bid of botBids) {
    console.log(`  ${bid.botName}: ${bid.amount > 0 ? `BIDS ${bid.amount}` : bid.reason}`)
  }
  console.log(`[BOT-TIMING] Bot evaluation loop: ${Date.now() - startTime}ms (cumulative)`)

  // If we have a best bid, place it using placeBid from auction.service
  if (bestBidBot) {
    console.log(`>>> ${bestBidBot.user.username} placing bid of ${bestBidAmount}`)
    const t3 = Date.now()
    const result = await placeBid(auctionId, bestBidBot.user.id, bestBidAmount)
    console.log(`[BOT-TIMING] placeBid call: ${Date.now() - t3}ms`)
    if (!result.success) {
      console.log(`>>> BID FAILED: ${result.message}`)
      return {
        success: false,
        message: `Bot ${bestBidBot.user.username} non è riuscito a fare offerta: ${result.message}`,
      }
    }
    console.log(`>>> BID SUCCESS`)
  } else {
    console.log('>>> No bot wanted to bid')
  }

  console.log(`[BOT-TIMING] === TOTAL: ${Date.now() - startTime}ms ===`)

  return {
    success: true,
    message: bestBidBot
      ? `${bestBidBot.user.username} ha offerto ${bestBidAmount}`
      : 'Nessun bot ha fatto offerte',
    data: {
      botBids,
      newCurrentPrice: bestBidAmount,
      hasBotBid: !!bestBidBot,
      winningBot: bestBidBot ? bestBidBot.user.username : null,
    },
  }
}
