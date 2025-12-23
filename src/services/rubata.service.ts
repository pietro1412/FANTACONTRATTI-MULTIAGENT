import { PrismaClient, MemberStatus, RosterStatus, AuctionStatus, Position } from '@prisma/client'
import { recordMovement } from './movement.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== PHASE CHECK ====================

async function isInRubataPhase(leagueId: string): Promise<boolean> {
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })
  return !!activeSession
}

// ==================== RUBATA ORDER MANAGEMENT ====================

export async function setRubataOrder(
  leagueId: string,
  adminUserId: string,
  memberOrder: string[]
): Promise<ServiceResult> {
  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Verify all memberIds belong to this league and are active
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  const memberIds = members.map(m => m.id)
  const validOrder = memberOrder.every(id => memberIds.includes(id))

  if (!validOrder || memberOrder.length !== memberIds.length) {
    return { success: false, message: 'Ordine non valido: tutti i membri attivi devono essere inclusi' }
  }

  // Update the rubata order in the active session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione di mercato attiva' }
  }

  // Update session rubata order and member rubataOrder fields
  await prisma.$transaction(async (tx) => {
    await tx.marketSession.update({
      where: { id: activeSession.id },
      data: { rubataOrder: memberOrder },
    })

    // Update individual member rubataOrder for easy querying
    for (let i = 0; i < memberOrder.length; i++) {
      await tx.leagueMember.update({
        where: { id: memberOrder[i] },
        data: { rubataOrder: i + 1 },
      })
    }
  })

  return {
    success: true,
    message: 'Ordine rubata impostato',
    data: { order: memberOrder },
  }
}

export async function getRubataOrder(leagueId: string, userId: string): Promise<ServiceResult> {
  // Verify membership
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

  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
    },
    orderBy: { rubataOrder: 'asc' },
  })

  return {
    success: true,
    data: members.map(m => ({
      id: m.id,
      username: m.user.username,
      teamName: m.teamName,
      rubataOrder: m.rubataOrder,
      currentBudget: m.currentBudget,
    })),
  }
}

// ==================== RUBATA TURN MANAGEMENT ====================

export async function getCurrentRubataTurn(leagueId: string, userId: string): Promise<ServiceResult> {
  // Verify membership
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

  // Check if in RUBATA phase
  const inRubataPhase = await isInRubataPhase(leagueId)
  if (!inRubataPhase) {
    return { success: false, message: 'Non siamo in fase RUBATA' }
  }

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession || !activeSession.rubataOrder) {
    return { success: false, message: 'Ordine rubata non impostato' }
  }

  const rubataOrder = activeSession.rubataOrder as string[]

  // Find current active rubata auction if any
  const activeAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'RUBATA',
      status: { in: ['PENDING', 'ACTIVE'] },
    },
    include: {
      player: true,
    },
  })

  // Determine current turn (first member in order who hasn't been fully processed)
  // For now, return first member - a proper implementation would track completed turns
  const currentTurnMemberId = rubataOrder[0]
  const currentTurnMember = await prisma.leagueMember.findUnique({
    where: { id: currentTurnMemberId },
    include: {
      user: { select: { username: true } },
    },
  })

  return {
    success: true,
    data: {
      currentTurn: currentTurnMember
        ? {
            memberId: currentTurnMember.id,
            username: currentTurnMember.user.username,
            teamName: currentTurnMember.teamName,
          }
        : null,
      activeAuction: activeAuction
        ? {
            id: activeAuction.id,
            player: activeAuction.player,
            basePrice: activeAuction.basePrice,
            currentPrice: activeAuction.currentPrice,
            status: activeAuction.status,
          }
        : null,
      isMyTurn: currentTurnMemberId === member.id,
    },
  }
}

// ==================== GET RUBABLE PLAYERS ====================

// Get players that can be "rubati" from a member's roster
// Returns players in order: P -> D -> C -> A, then alphabetically
export async function getRubablePlayers(
  leagueId: string,
  targetMemberId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify membership
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

  // Get target member's roster with contracts
  const roster = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: targetMemberId,
      status: RosterStatus.ACTIVE,
    },
    include: {
      player: true,
      contract: true,
    },
  })

  // Filter players with active contracts (rubatable)
  const rubablePlayers = roster.filter(r => r.contract && r.contract.duration > 0)

  // Sort by position (P, D, C, A) then alphabetically
  const positionOrder: Record<Position, number> = { P: 1, D: 2, C: 3, A: 4 }

  rubablePlayers.sort((a, b) => {
    const posA = positionOrder[a.player.position]
    const posB = positionOrder[b.player.position]
    if (posA !== posB) return posA - posB
    return a.player.name.localeCompare(b.player.name)
  })

  return {
    success: true,
    data: rubablePlayers.map(r => ({
      rosterId: r.id,
      player: r.player,
      contract: r.contract
        ? {
            salary: r.contract.salary,
            duration: r.contract.duration,
            rescissionClause: r.contract.rescissionClause,
          }
        : null,
      // Base price for rubata = clausola + ingaggio
      rubataBasePrice: r.contract
        ? r.contract.rescissionClause + r.contract.salary
        : 0,
    })),
  }
}

// ==================== PUT PLAYER ON THE PLATE ====================

export async function putPlayerOnPlate(
  leagueId: string,
  rosterId: string,
  adminUserId: string
): Promise<ServiceResult> {
  // Verify admin or it's the member's turn
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check if in RUBATA phase
  const inRubataPhase = await isInRubataPhase(leagueId)
  if (!inRubataPhase) {
    return { success: false, message: 'Puoi mettere giocatori sul piatto solo in fase RUBATA' }
  }

  // Get the roster entry
  const rosterEntry = await prisma.playerRoster.findUnique({
    where: { id: rosterId },
    include: {
      player: true,
      contract: true,
      leagueMember: true,
    },
  })

  if (!rosterEntry) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  if (rosterEntry.leagueMember.leagueId !== leagueId) {
    return { success: false, message: 'Giocatore non in questa lega' }
  }

  if (!rosterEntry.contract) {
    return { success: false, message: 'Giocatore senza contratto' }
  }

  // Verify it's this member's turn
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession || !activeSession.rubataOrder) {
    return { success: false, message: 'Ordine rubata non impostato' }
  }

  // Check no active rubata auction
  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'RUBATA',
      status: { in: ['PENDING', 'ACTIVE'] },
    },
  })

  if (existingAuction) {
    return { success: false, message: 'C\'è già un\'asta rubata in corso' }
  }

  // Calculate base price = clausola + ingaggio
  const basePrice = rosterEntry.contract.rescissionClause + rosterEntry.contract.salary

  // Create rubata auction
  const auction = await prisma.auction.create({
    data: {
      leagueId,
      marketSessionId: activeSession.id,
      playerId: rosterEntry.playerId,
      type: 'RUBATA',
      basePrice,
      currentPrice: basePrice,
      sellerId: rosterEntry.leagueMemberId,
      status: AuctionStatus.ACTIVE,
      startsAt: new Date(),
    },
    include: {
      player: true,
    },
  })

  return {
    success: true,
    message: `${rosterEntry.player.name} messo sul piatto a ${basePrice}`,
    data: {
      auction: {
        id: auction.id,
        player: auction.player,
        basePrice: auction.basePrice,
        sellerId: auction.sellerId,
      },
    },
  }
}

// ==================== BID ON RUBATA AUCTION ====================

export async function bidOnRubata(
  auctionId: string,
  userId: string,
  amount: number
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      bids: {
        orderBy: { amount: 'desc' },
        take: 1,
      },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.type !== 'RUBATA') {
    return { success: false, message: 'Non è un\'asta rubata' }
  }

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  // Get bidder member
  const bidder = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!bidder) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Seller cannot bid on their own player
  if (bidder.id === auction.sellerId) {
    return { success: false, message: 'Non puoi fare offerte per un tuo giocatore' }
  }

  // Check bid amount
  if (amount <= auction.currentPrice) {
    return { success: false, message: `L'offerta deve essere maggiore di ${auction.currentPrice}` }
  }

  // Check budget
  if (amount > bidder.currentBudget) {
    return { success: false, message: `Budget insufficiente. Disponibile: ${bidder.currentBudget}` }
  }

  // Place bid
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
        bidderId: bidder.id,
        userId,
        amount,
        isWinning: true,
      },
    })

    // Update auction current price
    await tx.auction.update({
      where: { id: auctionId },
      data: { currentPrice: amount },
    })
  })

  return {
    success: true,
    message: `Offerta di ${amount} registrata`,
    data: { currentPrice: amount },
  }
}

// ==================== CLOSE RUBATA AUCTION ====================

export async function closeRubataAuction(
  auctionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      bids: {
        where: { isWinning: true },
        include: {
          bidder: true,
        },
      },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.type !== 'RUBATA') {
    return { success: false, message: 'Non è un\'asta rubata' }
  }

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  const winningBid = auction.bids[0]

  if (!winningBid) {
    // No bids - auction ends with no winner, player stays
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.NO_BIDS,
        endsAt: new Date(),
      },
    })

    return {
      success: true,
      message: 'Nessuna offerta. Il giocatore rimane al proprietario.',
      data: { noBids: true },
    }
  }

  // Execute the rubata transfer
  await prisma.$transaction(async (tx) => {
    // Get seller
    const seller = await tx.leagueMember.findUnique({
      where: { id: auction.sellerId! },
    })

    if (!seller) throw new Error('Seller not found')

    // Get the roster entry
    const rosterEntry = await tx.playerRoster.findFirst({
      where: {
        leagueMemberId: auction.sellerId!,
        playerId: auction.playerId,
        status: RosterStatus.ACTIVE,
      },
      include: { contract: true },
    })

    if (!rosterEntry) throw new Error('Roster entry not found')

    // Calculate payment: winner pays currentPrice (clausola + ingaggio or higher)
    const payment = auction.currentPrice

    // Update winner budget (decrease)
    await tx.leagueMember.update({
      where: { id: winningBid.bidderId },
      data: { currentBudget: { decrement: payment } },
    })

    // Update seller budget (increase by payment)
    await tx.leagueMember.update({
      where: { id: auction.sellerId! },
      data: { currentBudget: { increment: payment } },
    })

    // Transfer roster to winner
    await tx.playerRoster.update({
      where: { id: rosterEntry.id },
      data: {
        leagueMemberId: winningBid.bidderId,
        acquisitionType: 'RUBATA',
        acquisitionPrice: payment,
      },
    })

    // Transfer contract to winner
    if (rosterEntry.contract) {
      await tx.playerContract.update({
        where: { id: rosterEntry.contract.id },
        data: { leagueMemberId: winningBid.bidderId },
      })
    }

    // Complete auction
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.COMPLETED,
        winnerId: winningBid.bidderId,
        endsAt: new Date(),
      },
    })
  })

  // Record movement - get roster entry again for contract info
  const completedRosterEntry = await prisma.playerRoster.findFirst({
    where: {
      leagueMemberId: winningBid.bidderId,
      playerId: auction.playerId,
      status: RosterStatus.ACTIVE,
    },
    include: { contract: true },
  })

  await recordMovement({
    leagueId: auction.leagueId,
    playerId: auction.playerId,
    movementType: 'RUBATA',
    fromMemberId: auction.sellerId!,
    toMemberId: winningBid.bidderId,
    price: auction.currentPrice,
    oldSalary: completedRosterEntry?.contract?.salary,
    oldDuration: completedRosterEntry?.contract?.duration,
    oldClause: completedRosterEntry?.contract?.rescissionClause,
    newSalary: completedRosterEntry?.contract?.salary,
    newDuration: completedRosterEntry?.contract?.duration,
    newClause: completedRosterEntry?.contract?.rescissionClause,
    auctionId,
    marketSessionId: auction.marketSessionId ?? undefined,
  })

  return {
    success: true,
    message: `${auction.player.name} rubato da ${winningBid.bidder.teamName || 'vincitore'} per ${auction.currentPrice}`,
    data: {
      player: auction.player,
      winnerId: winningBid.bidderId,
      finalPrice: auction.currentPrice,
    },
  }
}

// ==================== SKIP RUBATA TURN ====================

export async function skipRubataTurn(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Check if in RUBATA phase
  const inRubataPhase = await isInRubataPhase(leagueId)
  if (!inRubataPhase) {
    return { success: false, message: 'Non siamo in fase RUBATA' }
  }

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession || !activeSession.rubataOrder) {
    return { success: false, message: 'Ordine rubata non impostato' }
  }

  const rubataOrder = activeSession.rubataOrder as string[]

  if (rubataOrder.length <= 1) {
    return {
      success: true,
      message: 'Fase rubata completata',
      data: { completed: true },
    }
  }

  // Remove first member from order (advance to next)
  const newOrder = rubataOrder.slice(1)

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: { rubataOrder: newOrder },
  })

  const nextMember = await prisma.leagueMember.findUnique({
    where: { id: newOrder[0] },
    include: { user: { select: { username: true } } },
  })

  return {
    success: true,
    message: `Turno passato. Ora tocca a ${nextMember?.user.username}`,
    data: {
      nextMemberId: newOrder[0],
      remainingTurns: newOrder.length,
    },
  }
}

// ==================== GET RUBATA STATUS ====================

export async function getRubataStatus(leagueId: string, userId: string): Promise<ServiceResult> {
  // Verify membership
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  const isRubataPhase = activeSession?.currentPhase === 'RUBATA'
  const rubataOrder = (activeSession?.rubataOrder as string[]) || []

  // Get active auction if any
  const activeAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession?.id,
      type: 'RUBATA',
      status: { in: ['PENDING', 'ACTIVE'] },
    },
    include: {
      player: true,
      bids: {
        orderBy: { amount: 'desc' },
        take: 5,
        include: {
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
  })

  // Get current turn member
  const currentTurnMemberId = rubataOrder[0]
  const currentTurnMember = currentTurnMemberId
    ? await prisma.leagueMember.findUnique({
        where: { id: currentTurnMemberId },
        include: { user: { select: { username: true } } },
      })
    : null

  return {
    success: true,
    data: {
      isRubataPhase,
      currentPhase: activeSession?.currentPhase,
      rubataOrder,
      currentTurn: currentTurnMember
        ? {
            memberId: currentTurnMember.id,
            username: currentTurnMember.user.username,
            isMe: currentTurnMember.id === member.id,
          }
        : null,
      activeAuction: activeAuction
        ? {
            id: activeAuction.id,
            player: activeAuction.player,
            basePrice: activeAuction.basePrice,
            currentPrice: activeAuction.currentPrice,
            sellerId: activeAuction.sellerId,
            bids: activeAuction.bids.map(b => ({
              amount: b.amount,
              bidder: b.bidder.user.username,
              isWinning: b.isWinning,
            })),
          }
        : null,
      remainingTurns: rubataOrder.length,
    },
  }
}
