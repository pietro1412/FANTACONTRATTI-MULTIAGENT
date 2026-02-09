import { PrismaClient, MemberStatus, RosterStatus, TradeStatus } from '@prisma/client'
import { recordMovement } from './movement.service'
import { notifyTradeOffer } from './notification.service'
import { triggerTradeOfferReceived, triggerTradeUpdated } from './pusher.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== PHASE CHECK ====================

async function isInTradePhase(leagueId: string): Promise<boolean> {
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: {
        in: ['OFFERTE_PRE_RINNOVO', 'OFFERTE_POST_ASTA_SVINCOLATI'],
      },
    },
  })
  return !!activeSession
}

// ==================== CREATE TRADE OFFER ====================

export async function createTradeOffer(
  leagueId: string,
  fromUserId: string,
  toMemberId: string,
  offeredPlayerIds: string[],
  requestedPlayerIds: string[],
  offeredBudget: number = 0,
  requestedBudget: number = 0,
  message?: string,
  durationHours: number = 24 // Default 24 hours
): Promise<ServiceResult> {
  // Verify sender membership
  const fromMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: fromUserId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!fromMember) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Verify receiver membership and get user ID
  const toMember = await prisma.leagueMember.findUnique({
    where: { id: toMemberId },
    include: { user: true },
  })

  if (!toMember || toMember.leagueId !== leagueId || toMember.status !== MemberStatus.ACTIVE) {
    return { success: false, message: 'Destinatario non valido' }
  }

  if (fromMember.id === toMemberId) {
    return { success: false, message: 'Non puoi fare offerte a te stesso' }
  }

  // Check if in trade phase
  const inTradePhase = await isInTradePhase(leagueId)
  if (!inTradePhase) {
    return { success: false, message: 'Puoi fare scambi solo durante la fase SCAMBI/OFFERTE' }
  }

  // Validate offered players belong to sender
  if (offeredPlayerIds.length > 0) {
    const offeredRosters = await prisma.playerRoster.findMany({
      where: {
        id: { in: offeredPlayerIds },
        leagueMemberId: fromMember.id,
        status: RosterStatus.ACTIVE,
      },
    })

    if (offeredRosters.length !== offeredPlayerIds.length) {
      return { success: false, message: 'Alcuni giocatori offerti non sono nella tua rosa' }
    }
  }

  // Validate requested players belong to receiver
  if (requestedPlayerIds.length > 0) {
    const requestedRosters = await prisma.playerRoster.findMany({
      where: {
        id: { in: requestedPlayerIds },
        leagueMemberId: toMemberId,
        status: RosterStatus.ACTIVE,
      },
    })

    if (requestedRosters.length !== requestedPlayerIds.length) {
      return { success: false, message: 'Alcuni giocatori richiesti non sono nella rosa del destinatario' }
    }
  }

  // Validate budgets
  if (offeredBudget < 0 || requestedBudget < 0) {
    return { success: false, message: 'I budget devono essere positivi' }
  }

  if (offeredBudget > fromMember.currentBudget) {
    return { success: false, message: `Non hai abbastanza budget. Disponibile: ${fromMember.currentBudget}` }
  }

  // Get active session (required for trade offer)
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione di mercato attiva' }
  }

  // Check for anti-reverse trade rule (same session)
  const reverseTrade = await prisma.tradeOffer.findFirst({
    where: {
      marketSessionId: activeSession.id,
      senderId: toMember.userId,
      receiverId: fromUserId,
      status: TradeStatus.ACCEPTED,
    },
  })

  if (reverseTrade) {
    return { success: false, message: 'Non puoi fare uno scambio inverso nella stessa sessione di mercato' }
  }

  // Combine all involved player IDs
  const involvedPlayers = [...offeredPlayerIds, ...requestedPlayerIds]

  // Calculate expiration date
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

  // Create trade offer
  const trade = await prisma.tradeOffer.create({
    data: {
      marketSessionId: activeSession.id,
      senderId: fromUserId,
      receiverId: toMember.userId,
      offeredPlayers: offeredPlayerIds,
      requestedPlayers: requestedPlayerIds,
      offeredBudget,
      requestedBudget,
      involvedPlayers,
      message,
      status: TradeStatus.PENDING,
      expiresAt: expiresAt,
    } as any, // Type assertion until Prisma client is regenerated
    include: {
      sender: { select: { id: true, username: true } },
      receiver: { select: { id: true, username: true } },
    },
  })

  // Send push notification to receiver (fire-and-forget)
  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { name: true } })
  notifyTradeOffer(
    toMember.userId,
    trade.sender.username,
    league?.name || 'Lega'
  ).catch(() => {}) // non-blocking

  // Real-time Pusher notification (fire-and-forget)
  triggerTradeOfferReceived(leagueId, {
    tradeId: trade.id,
    senderUsername: trade.sender.username,
    receiverUserId: toMember.userId,
    timestamp: new Date().toISOString(),
  }).catch(() => {})

  return {
    success: true,
    message: 'Offerta inviata',
    data: trade,
  }
}

// ==================== GET TRADE OFFERS ====================

export async function getReceivedOffers(leagueId: string, userId: string): Promise<ServiceResult> {
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Get active session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  // Auto-expire old offers (disabled until Prisma client is regenerated)
  // TODO: Uncomment after running `npx prisma generate`
  /*
  await prisma.tradeOffer.updateMany({
    where: {
      receiverId: userId,
      status: TradeStatus.PENDING,
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' as any },
  })
  */

  const offers = await prisma.tradeOffer.findMany({
    where: {
      receiverId: userId,
      status: TradeStatus.PENDING,
      ...(activeSession ? { marketSessionId: activeSession.id } : {}),
    },
    include: {
      sender: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Enrich with player details and contracts
  const enrichedOffers = await Promise.all(
    offers.map(async (offer) => {
      const offeredPlayerIds = offer.offeredPlayers as string[]
      const requestedPlayerIds = offer.requestedPlayers as string[]

      const offeredPlayers = await prisma.playerRoster.findMany({
        where: { id: { in: offeredPlayerIds } },
        include: { player: true, contract: true },
      })
      const requestedPlayers = await prisma.playerRoster.findMany({
        where: { id: { in: requestedPlayerIds } },
        include: { player: true, contract: true },
      })
      return {
        id: offer.id,
        senderId: offer.senderId,
        receiverId: offer.receiverId,
        sender: offer.sender,
        offeredBudget: offer.offeredBudget,
        requestedBudget: offer.requestedBudget,
        message: offer.message,
        status: offer.status,
        createdAt: offer.createdAt,
        expiresAt: offer.expiresAt,
        offeredPlayerDetails: offeredPlayers.map(r => ({
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          contract: r.contract ? {
            salary: r.contract.salary,
            duration: r.contract.duration,
            rescissionClause: r.contract.rescissionClause,
          } : null,
        })),
        requestedPlayerDetails: requestedPlayers.map(r => ({
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          contract: r.contract ? {
            salary: r.contract.salary,
            duration: r.contract.duration,
            rescissionClause: r.contract.rescissionClause,
          } : null,
        })),
      }
    })
  )

  return {
    success: true,
    data: enrichedOffers,
  }
}

export async function getSentOffers(leagueId: string, userId: string): Promise<ServiceResult> {
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Get active session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  // Auto-expire old offers (disabled until Prisma client is regenerated)
  // TODO: Uncomment after running `npx prisma generate`
  /*
  await prisma.tradeOffer.updateMany({
    where: {
      senderId: userId,
      status: TradeStatus.PENDING,
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' as any },
  })
  */

  const offers = await prisma.tradeOffer.findMany({
    where: {
      senderId: userId,
      status: { in: [TradeStatus.PENDING, TradeStatus.COUNTERED] },
      ...(activeSession ? { marketSessionId: activeSession.id } : {}),
    },
    include: {
      receiver: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Enrich with player details and contracts
  const enrichedOffers = await Promise.all(
    offers.map(async (offer) => {
      const offeredPlayerIds = offer.offeredPlayers as string[]
      const requestedPlayerIds = offer.requestedPlayers as string[]

      const offeredPlayers = await prisma.playerRoster.findMany({
        where: { id: { in: offeredPlayerIds } },
        include: { player: true, contract: true },
      })
      const requestedPlayers = await prisma.playerRoster.findMany({
        where: { id: { in: requestedPlayerIds } },
        include: { player: true, contract: true },
      })
      return {
        id: offer.id,
        senderId: offer.senderId,
        receiverId: offer.receiverId,
        receiver: offer.receiver,
        offeredBudget: offer.offeredBudget,
        requestedBudget: offer.requestedBudget,
        message: offer.message,
        status: offer.status,
        createdAt: offer.createdAt,
        expiresAt: offer.expiresAt,
        offeredPlayerDetails: offeredPlayers.map(r => ({
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          contract: r.contract ? {
            salary: r.contract.salary,
            duration: r.contract.duration,
            rescissionClause: r.contract.rescissionClause,
          } : null,
        })),
        requestedPlayerDetails: requestedPlayers.map(r => ({
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          contract: r.contract ? {
            salary: r.contract.salary,
            duration: r.contract.duration,
            rescissionClause: r.contract.rescissionClause,
          } : null,
        })),
      }
    })
  )

  return {
    success: true,
    data: enrichedOffers,
  }
}

// ==================== ACCEPT/REJECT TRADE ====================

export async function acceptTrade(tradeId: string, userId: string): Promise<ServiceResult> {
  const trade = await prisma.tradeOffer.findUnique({
    where: { id: tradeId },
    include: {
      receiver: { select: { id: true, username: true } },
      sender: { select: { id: true, username: true } },
      marketSession: { select: { leagueId: true } },
    },
  })

  if (!trade) {
    return { success: false, message: 'Offerta non trovata' }
  }

  if (trade.receiverId !== userId) {
    return { success: false, message: 'Non sei autorizzato ad accettare questa offerta' }
  }

  if (trade.status !== TradeStatus.PENDING) {
    return { success: false, message: 'Questa offerta non è più valida' }
  }

  // Check if offer has expired (disabled until Prisma client is regenerated)
  // TODO: Uncomment after running `npx prisma generate`
  /*
  if ((trade as any).expiresAt && new Date() > (trade as any).expiresAt) {
    // Mark as expired
    await prisma.tradeOffer.update({
      where: { id: tradeId },
      data: { status: 'EXPIRED' as any },
    })
    return { success: false, message: 'Questa offerta è scaduta' }
  }
  */

  const leagueId = trade.marketSession.leagueId

  // Check if in trade phase
  const inTradePhase = await isInTradePhase(leagueId)
  if (!inTradePhase) {
    return { success: false, message: 'Puoi accettare scambi solo durante la fase SCAMBI/OFFERTE' }
  }

  // Get members for budget validation
  const senderMember = await prisma.leagueMember.findFirst({
    where: { leagueId, userId: trade.senderId, status: MemberStatus.ACTIVE },
  })
  const receiverMember = await prisma.leagueMember.findFirst({
    where: { leagueId, userId: trade.receiverId, status: MemberStatus.ACTIVE },
  })

  if (!senderMember || !receiverMember) {
    return { success: false, message: 'Uno dei membri non è più attivo nella lega' }
  }

  // Validate receiver has enough budget for requested budget
  if (trade.requestedBudget > receiverMember.currentBudget) {
    return { success: false, message: `Budget insufficiente. Richiesto: ${trade.requestedBudget}, Disponibile: ${receiverMember.currentBudget}` }
  }

  // Re-validate sender has enough budget
  if (trade.offeredBudget > senderMember.currentBudget) {
    return { success: false, message: 'Il mittente non ha più abbastanza budget per questa offerta' }
  }

  const offeredPlayerIds = trade.offeredPlayers as string[]
  const requestedPlayerIds = trade.requestedPlayers as string[]

  // Execute trade in transaction
  await prisma.$transaction(async (tx) => {
    // Transfer offered players (from sender to receiver)
    for (const rosterId of offeredPlayerIds) {
      await tx.playerRoster.update({
        where: { id: rosterId },
        data: {
          leagueMemberId: receiverMember.id,
          acquisitionType: 'TRADE', // Mark as acquired via trade - contract cannot be modified
        },
      })
      // Update contract ownership
      await tx.playerContract.updateMany({
        where: { rosterId },
        data: { leagueMemberId: receiverMember.id },
      })
    }

    // Transfer requested players (from receiver to sender)
    for (const rosterId of requestedPlayerIds) {
      await tx.playerRoster.update({
        where: { id: rosterId },
        data: {
          leagueMemberId: senderMember.id,
          acquisitionType: 'TRADE', // Mark as acquired via trade - contract cannot be modified
        },
      })
      // Update contract ownership
      await tx.playerContract.updateMany({
        where: { rosterId },
        data: { leagueMemberId: senderMember.id },
      })
    }

    // Transfer budget
    if (trade.offeredBudget > 0) {
      await tx.leagueMember.update({
        where: { id: senderMember.id },
        data: { currentBudget: { decrement: trade.offeredBudget } },
      })
      await tx.leagueMember.update({
        where: { id: receiverMember.id },
        data: { currentBudget: { increment: trade.offeredBudget } },
      })
    }

    if (trade.requestedBudget > 0) {
      await tx.leagueMember.update({
        where: { id: receiverMember.id },
        data: { currentBudget: { decrement: trade.requestedBudget } },
      })
      await tx.leagueMember.update({
        where: { id: senderMember.id },
        data: { currentBudget: { increment: trade.requestedBudget } },
      })
    }

    // Mark trade as accepted
    await tx.tradeOffer.update({
      where: { id: tradeId },
      data: {
        status: TradeStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    })
  })

  // Record movements for each traded player
  // Get offered players details
  const offeredRosters = await prisma.playerRoster.findMany({
    where: { id: { in: offeredPlayerIds } },
    include: { contract: true },
  })

  for (const roster of offeredRosters) {
    await recordMovement({
      leagueId,
      playerId: roster.playerId,
      movementType: 'TRADE',
      fromMemberId: senderMember.id,
      toMemberId: receiverMember.id,
      oldSalary: roster.contract?.salary,
      oldDuration: roster.contract?.duration,
      oldClause: roster.contract?.rescissionClause,
      newSalary: roster.contract?.salary,
      newDuration: roster.contract?.duration,
      newClause: roster.contract?.rescissionClause,
      tradeId,
      marketSessionId: trade.marketSessionId,
    })
  }

  // Get requested players details
  const requestedRosters = await prisma.playerRoster.findMany({
    where: { id: { in: requestedPlayerIds } },
    include: { contract: true },
  })

  for (const roster of requestedRosters) {
    await recordMovement({
      leagueId,
      playerId: roster.playerId,
      movementType: 'TRADE',
      fromMemberId: receiverMember.id,
      toMemberId: senderMember.id,
      oldSalary: roster.contract?.salary,
      oldDuration: roster.contract?.duration,
      oldClause: roster.contract?.rescissionClause,
      newSalary: roster.contract?.salary,
      newDuration: roster.contract?.duration,
      newClause: roster.contract?.rescissionClause,
      tradeId,
      marketSessionId: trade.marketSessionId,
    })
  }

  // Get full details of players received by the acceptor (receiver) for contract modification
  const receivedPlayers = await prisma.playerRoster.findMany({
    where: { id: { in: offeredPlayerIds } },
    include: {
      player: true,
      contract: true
    },
  })

  const receivedPlayersForModification = receivedPlayers.map(r => ({
    rosterId: r.id,
    contractId: r.contract?.id,
    playerId: r.player.id,
    playerName: r.player.name,
    playerTeam: r.player.team,
    playerPosition: r.player.position,
    contract: r.contract ? {
      salary: r.contract.salary,
      duration: r.contract.duration,
      initialSalary: r.contract.initialSalary,
      rescissionClause: r.contract.rescissionClause,
    } : null,
  }))

  // Real-time Pusher notification (fire-and-forget)
  triggerTradeUpdated(leagueId, {
    tradeId,
    newStatus: 'ACCEPTED',
    timestamp: new Date().toISOString(),
  }).catch(() => {})

  return {
    success: true,
    message: 'Scambio completato!',
    data: {
      receivedPlayers: receivedPlayersForModification,
    },
  }
}

export async function rejectTrade(tradeId: string, userId: string): Promise<ServiceResult> {
  const trade = await prisma.tradeOffer.findUnique({
    where: { id: tradeId },
    include: {
      receiver: { select: { id: true } },
    },
  })

  if (!trade) {
    return { success: false, message: 'Offerta non trovata' }
  }

  if (trade.receiverId !== userId) {
    return { success: false, message: 'Non sei autorizzato a rifiutare questa offerta' }
  }

  if (trade.status !== TradeStatus.PENDING) {
    return { success: false, message: 'Questa offerta non è più valida' }
  }

  const updatedTrade = await prisma.tradeOffer.update({
    where: { id: tradeId },
    data: {
      status: TradeStatus.REJECTED,
      respondedAt: new Date(),
    },
    include: { marketSession: { select: { leagueId: true } } },
  })

  // Real-time Pusher notification (fire-and-forget)
  triggerTradeUpdated(updatedTrade.marketSession.leagueId, {
    tradeId,
    newStatus: 'REJECTED',
    timestamp: new Date().toISOString(),
  }).catch(() => {})

  return {
    success: true,
    message: 'Offerta rifiutata',
  }
}

// ==================== COUNTER OFFER ====================

export async function counterOffer(
  tradeId: string,
  userId: string,
  offeredPlayerIds: string[],
  requestedPlayerIds: string[],
  offeredBudget: number = 0,
  requestedBudget: number = 0,
  message?: string
): Promise<ServiceResult> {
  const originalTrade = await prisma.tradeOffer.findUnique({
    where: { id: tradeId },
    include: {
      receiver: { select: { id: true } },
      sender: { select: { id: true } },
      marketSession: { select: { leagueId: true } },
    },
  })

  if (!originalTrade) {
    return { success: false, message: 'Offerta originale non trovata' }
  }

  if (originalTrade.receiverId !== userId) {
    return { success: false, message: 'Non sei autorizzato a controffertare' }
  }

  if (originalTrade.status !== TradeStatus.PENDING) {
    return { success: false, message: 'Questa offerta non è più valida' }
  }

  const leagueId = originalTrade.marketSession.leagueId

  // Check if in trade phase
  const inTradePhase = await isInTradePhase(leagueId)
  if (!inTradePhase) {
    return { success: false, message: 'Puoi controffertare solo durante la fase SCAMBI/OFFERTE' }
  }

  // Get the sender's member ID (the one receiving the counter offer)
  const senderMember = await prisma.leagueMember.findFirst({
    where: { leagueId, userId: originalTrade.senderId, status: MemberStatus.ACTIVE },
  })

  if (!senderMember) {
    return { success: false, message: 'Il mittente originale non è più attivo nella lega' }
  }

  // Mark original as countered
  await prisma.tradeOffer.update({
    where: { id: tradeId },
    data: {
      status: TradeStatus.COUNTERED,
      respondedAt: new Date(),
    },
  })

  // Create new counter offer (swapped from/to)
  const result = await createTradeOffer(
    leagueId,
    userId,
    senderMember.id,
    offeredPlayerIds,
    requestedPlayerIds,
    offeredBudget,
    requestedBudget,
    message || `Controofferta a offerta #${tradeId.slice(-6)}`
  )

  if (result.success) {
    result.message = 'Controofferta inviata'
  }

  return result
}

// ==================== TRADE HISTORY ====================

export async function getTradeHistory(leagueId: string, userId: string): Promise<ServiceResult> {
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const trades = await prisma.tradeOffer.findMany({
    where: {
      marketSession: { leagueId },
      status: { in: [TradeStatus.ACCEPTED, TradeStatus.REJECTED] },
    },
    include: {
      sender: { select: { id: true, username: true } },
      receiver: { select: { id: true, username: true } },
    },
    orderBy: { respondedAt: 'desc' },
    take: 50,
  })

  // Enrich with player details
  const enrichedTrades = await Promise.all(
    trades.map(async (trade) => {
      const offeredPlayerIds = trade.offeredPlayers as string[]
      const requestedPlayerIds = trade.requestedPlayers as string[]

      const offeredPlayers = await prisma.playerRoster.findMany({
        where: { id: { in: offeredPlayerIds } },
        include: { player: true, contract: true },
      })
      const requestedPlayers = await prisma.playerRoster.findMany({
        where: { id: { in: requestedPlayerIds } },
        include: { player: true, contract: true },
      })

      return {
        id: trade.id,
        senderId: trade.senderId,
        receiverId: trade.receiverId,
        sender: trade.sender,
        receiver: trade.receiver,
        offeredBudget: trade.offeredBudget,
        requestedBudget: trade.requestedBudget,
        message: trade.message,
        status: trade.status,
        createdAt: trade.createdAt,
        respondedAt: trade.respondedAt,
        offeredPlayerDetails: offeredPlayers.map(r => ({
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          contract: r.contract ? {
            salary: r.contract.salary,
            duration: r.contract.duration,
            rescissionClause: r.contract.rescissionClause,
          } : null,
        })),
        requestedPlayerDetails: requestedPlayers.map(r => ({
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          contract: r.contract ? {
            salary: r.contract.salary,
            duration: r.contract.duration,
            rescissionClause: r.contract.rescissionClause,
          } : null,
        })),
      }
    })
  )

  return {
    success: true,
    data: enrichedTrades,
  }
}

// ==================== CANCEL OFFER ====================

export async function cancelTradeOffer(tradeId: string, userId: string): Promise<ServiceResult> {
  const trade = await prisma.tradeOffer.findUnique({
    where: { id: tradeId },
    include: {
      sender: { select: { id: true } },
    },
  })

  if (!trade) {
    return { success: false, message: 'Offerta non trovata' }
  }

  if (trade.senderId !== userId) {
    return { success: false, message: 'Non sei autorizzato a cancellare questa offerta' }
  }

  if (trade.status !== TradeStatus.PENDING) {
    return { success: false, message: 'Questa offerta non può essere cancellata' }
  }

  const cancelledTrade = await prisma.tradeOffer.update({
    where: { id: tradeId },
    data: {
      status: TradeStatus.CANCELLED,
    },
    include: { marketSession: { select: { leagueId: true } } },
  })

  // Real-time Pusher notification (fire-and-forget)
  triggerTradeUpdated(cancelledTrade.marketSession.leagueId, {
    tradeId,
    newStatus: 'CANCELLED',
    timestamp: new Date().toISOString(),
  }).catch(() => {})

  return {
    success: true,
    message: 'Offerta cancellata',
  }
}
