import { PrismaClient, MemberStatus, RosterStatus, AuctionStatus, Position } from '@prisma/client'
import { recordMovement } from './movement.service'
import { triggerRubataBidPlaced, triggerRubataStealDeclared, triggerRubataReadyChanged, triggerAuctionClosed } from './pusher.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== HEARTBEAT / CONNECTION STATUS ====================

// In-memory storage for heartbeats (leagueId -> memberId -> timestamp)
const rubataHeartbeats = new Map<string, Map<string, number>>()

// Heartbeat timeout in milliseconds (10 seconds)
const RUBATA_HEARTBEAT_TIMEOUT = 10000

export function registerRubataHeartbeat(leagueId: string, memberId: string): void {
  if (!rubataHeartbeats.has(leagueId)) {
    rubataHeartbeats.set(leagueId, new Map())
  }
  rubataHeartbeats.get(leagueId)!.set(memberId, Date.now())
}

export function getRubataConnectionStatus(leagueId: string): Map<string, boolean> {
  const leagueHeartbeats = rubataHeartbeats.get(leagueId) || new Map()
  const now = Date.now()
  const status = new Map<string, boolean>()

  leagueHeartbeats.forEach((timestamp, memberId) => {
    status.set(memberId, now - timestamp < RUBATA_HEARTBEAT_TIMEOUT)
  })

  return status
}

export function clearRubataHeartbeats(leagueId: string): void {
  rubataHeartbeats.delete(leagueId)
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

// ==================== GENERATE RUBATA BOARD ====================

// Generates the complete rubata board ordered by:
// 1. Manager (according to rubataOrder)
// 2. Position (P -> D -> C -> A)
// 3. Alphabetically by player name
export async function generateRubataBoard(
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  if (!activeSession.rubataOrder) {
    return { success: false, message: 'Ordine rubata non impostato' }
  }

  const rubataOrder = activeSession.rubataOrder as string[]
  const positionOrder: Record<Position, number> = { P: 1, D: 2, C: 3, A: 4 }

  // Build the board
  const board: Array<{
    rosterId: string
    memberId: string
    playerId: string
    playerName: string
    playerPosition: Position
    playerTeam: string
    playerQuotation: number
    playerAge: number | null
    playerApiFootballId: number | null
    playerApiFootballStats: unknown
    ownerUsername: string
    ownerTeamName: string | null
    rubataPrice: number // clausola + ingaggio
    contractSalary: number
    contractDuration: number
    contractClause: number
  }> = []

  for (const memberId of rubataOrder) {
    const member = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { username: true } },
        roster: {
          where: { status: RosterStatus.ACTIVE },
          include: {
            player: true,
            contract: true,
          },
        },
      },
    })

    if (!member) continue

    // Filter players with active contracts and sort them
    const playersWithContracts = member.roster
      .filter(r => r.contract && r.contract.duration > 0)
      .sort((a, b) => {
        const posA = positionOrder[a.player.position]
        const posB = positionOrder[b.player.position]
        if (posA !== posB) return posA - posB
        return a.player.name.localeCompare(b.player.name)
      })

    for (const rosterEntry of playersWithContracts) {
      const contract = rosterEntry.contract!
      board.push({
        rosterId: rosterEntry.id,
        memberId: member.id,
        playerId: rosterEntry.playerId,
        playerName: rosterEntry.player.name,
        playerPosition: rosterEntry.player.position,
        playerTeam: rosterEntry.player.team,
        playerQuotation: rosterEntry.player.quotation,
        playerAge: rosterEntry.player.age,
        playerApiFootballId: rosterEntry.player.apiFootballId,
        playerApiFootballStats: rosterEntry.player.apiFootballStats,
        ownerUsername: member.user.username,
        ownerTeamName: member.teamName,
        rubataPrice: contract.rescissionClause + contract.salary,
        contractSalary: contract.salary,
        contractDuration: contract.duration,
        contractClause: contract.rescissionClause,
      })
    }
  }

  // Save the board to the session and start ready check
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataBoard: board,
      rubataBoardIndex: 0,
      rubataState: 'READY_CHECK',
      rubataReadyMembers: [],
    },
  })

  return {
    success: true,
    message: `Tabellone rubata generato con ${board.length} giocatori`,
    data: { board, totalPlayers: board.length },
  }
}

// ==================== GET RUBATA BOARD ====================

export async function getRubataBoard(
  leagueId: string,
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

  let activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  // Auto-advance if timer expired during OFFERING phase with no auction
  if (
    activeSession.rubataState === 'OFFERING' &&
    activeSession.rubataTimerStartedAt &&
    activeSession.rubataBoard
  ) {
    const now = new Date()
    const timerStart = new Date(activeSession.rubataTimerStartedAt)
    const elapsed = Math.floor((now.getTime() - timerStart.getTime()) / 1000)

    if (elapsed >= activeSession.rubataOfferTimerSeconds) {
      // Timer expired - check if there's no active auction
      const existingAuction = await prisma.auction.findFirst({
        where: {
          marketSessionId: activeSession.id,
          type: 'RUBATA',
          status: { in: ['PENDING', 'ACTIVE'] },
        },
      })

      if (!existingAuction) {
        // No offers were made - auto advance to next player
        const board = activeSession.rubataBoard as Array<unknown>
        const currentIndex = activeSession.rubataBoardIndex ?? 0
        const nextIndex = currentIndex + 1

        if (nextIndex >= board.length) {
          // Rubata completed
          await prisma.marketSession.update({
            where: { id: activeSession.id },
            data: {
              rubataState: 'COMPLETED',
              rubataTimerStartedAt: null,
            },
          })
        } else {
          // Advance to next player
          await prisma.marketSession.update({
            where: { id: activeSession.id },
            data: {
              rubataBoardIndex: nextIndex,
              rubataState: 'OFFERING',
              rubataTimerStartedAt: new Date(),
            },
          })
        }

        // Re-fetch the session with updated data
        activeSession = await prisma.marketSession.findFirst({
          where: {
            leagueId,
            status: 'ACTIVE',
          },
        })

        if (!activeSession) {
          return { success: false, message: 'Nessuna sessione attiva' }
        }
      }
    }
  }

  // Auto-close auction if timer expired during AUCTION phase
  if (
    activeSession.rubataState === 'AUCTION' &&
    activeSession.rubataTimerStartedAt &&
    activeSession.rubataBoard
  ) {
    const now = new Date()
    const timerStart = new Date(activeSession.rubataTimerStartedAt)
    const elapsed = Math.floor((now.getTime() - timerStart.getTime()) / 1000)

    if (elapsed >= activeSession.rubataAuctionTimerSeconds) {
      // Auction timer expired - auto-close the auction
      const auctionToClose = await prisma.auction.findFirst({
        where: {
          marketSessionId: activeSession.id,
          type: 'RUBATA',
          status: 'ACTIVE',
        },
        include: {
          player: true,
          bids: {
            where: { isWinning: true },
            include: {
              bidder: {
                include: { user: { select: { username: true } } },
              },
            },
          },
        },
      })

      if (auctionToClose) {
        const winningBid = auctionToClose.bids[0]

        if (winningBid) {
          // Execute the rubata transfer
          await prisma.$transaction(async (tx) => {
            const seller = await tx.leagueMember.findUnique({
              where: { id: auctionToClose.sellerId! },
            })

            if (!seller) throw new Error('Seller not found')

            const rosterEntry = await tx.playerRoster.findFirst({
              where: {
                leagueMemberId: auctionToClose.sellerId!,
                playerId: auctionToClose.playerId,
                status: RosterStatus.ACTIVE,
              },
              include: { contract: true },
            })

            if (!rosterEntry) throw new Error('Roster entry not found')

            const payment = auctionToClose.currentPrice

            await tx.leagueMember.update({
              where: { id: winningBid.bidderId },
              data: { currentBudget: { decrement: payment } },
            })

            await tx.leagueMember.update({
              where: { id: auctionToClose.sellerId! },
              data: { currentBudget: { increment: payment } },
            })

            await tx.playerRoster.update({
              where: { id: rosterEntry.id },
              data: {
                leagueMemberId: winningBid.bidderId,
                acquisitionType: 'RUBATA',
                acquisitionPrice: payment,
              },
            })

            if (rosterEntry.contract) {
              await tx.playerContract.update({
                where: { id: rosterEntry.contract.id },
                data: { leagueMemberId: winningBid.bidderId },
              })
            }

            await tx.auction.update({
              where: { id: auctionToClose.id },
              data: {
                status: AuctionStatus.COMPLETED,
                winnerId: winningBid.bidderId,
                endsAt: new Date(),
              },
            })
          })

          // Record movement with contract info
          const transferredRoster = await prisma.playerRoster.findFirst({
            where: {
              leagueMemberId: winningBid.bidderId,
              playerId: auctionToClose.playerId,
              status: RosterStatus.ACTIVE,
            },
            include: { contract: true },
          })

          await recordMovement({
            leagueId,
            playerId: auctionToClose.playerId,
            movementType: 'RUBATA',
            fromMemberId: auctionToClose.sellerId!,
            toMemberId: winningBid.bidderId,
            price: auctionToClose.currentPrice,
            marketSessionId: activeSession.id,
            auctionId: auctionToClose.id,
            oldSalary: transferredRoster?.contract?.salary,
            oldDuration: transferredRoster?.contract?.duration,
            oldClause: transferredRoster?.contract?.rescissionClause,
            newSalary: transferredRoster?.contract?.salary,
            newDuration: transferredRoster?.contract?.duration,
            newClause: transferredRoster?.contract?.rescissionClause,
          })

          // Get seller info for pending ack
          const sellerInfo = await prisma.leagueMember.findUnique({
            where: { id: auctionToClose.sellerId! },
            include: { user: { select: { username: true } } },
          })

          // Create pending acknowledgment
          const boardForAutoClose = activeSession.rubataBoard as Array<{
            rosterId: string
            memberId: string
            playerId: string
            stolenById?: string | null
            stolenByUsername?: string | null
            stolenPrice?: number | null
          }>
          const currentIndex = activeSession.rubataBoardIndex ?? 0
          const nextIndex = currentIndex + 1

          // Update board entry with winner info
          const updatedBoardAutoClose = boardForAutoClose.map((entry, idx) => {
            if (idx === currentIndex) {
              return {
                ...entry,
                stolenById: winningBid.bidderId,
                stolenByUsername: winningBid.bidder.user.username,
                stolenPrice: auctionToClose.currentPrice,
              }
            }
            return entry
          })

          const pendingAck = {
            auctionId: auctionToClose.id,
            playerId: auctionToClose.playerId,
            playerName: auctionToClose.player.name,
            playerTeam: auctionToClose.player.team,
            playerPosition: auctionToClose.player.position,
            winnerId: winningBid.bidderId,
            winnerUsername: winningBid.bidder.user.username,
            sellerId: auctionToClose.sellerId!,
            sellerUsername: sellerInfo?.user.username || 'Unknown',
            finalPrice: auctionToClose.currentPrice,
            acknowledgedMembers: [],
          }

          await prisma.marketSession.update({
            where: { id: activeSession.id },
            data: {
              rubataBoard: updatedBoardAutoClose,
              rubataBoardIndex: nextIndex,
              rubataState: 'PENDING_ACK',
              rubataTimerStartedAt: null,
              rubataPendingAck: pendingAck,
              rubataReadyMembers: [],
            },
          })

          // Trigger Pusher event for auction closed (non-blocking)
          triggerAuctionClosed(activeSession.id, {
            auctionId: auctionToClose.id,
            playerId: auctionToClose.playerId,
            playerName: auctionToClose.player.name,
            winnerId: winningBid.bidderId,
            winnerName: winningBid.bidder.user.username,
            finalPrice: auctionToClose.currentPrice,
            wasUnsold: false,
            timestamp: new Date().toISOString(),
          }).catch(err => console.error('[Pusher] Failed to trigger auction closed:', err))
        }

        // Re-fetch the session with updated data
        activeSession = await prisma.marketSession.findFirst({
          where: {
            leagueId,
            status: 'ACTIVE',
          },
        })

        if (!activeSession) {
          return { success: false, message: 'Nessuna sessione attiva' }
        }
      }
    }
  }

  // Auto-advance if in PENDING_ACK but auction is already COMPLETED (appeal was handled)
  if (
    activeSession.rubataState === 'PENDING_ACK' &&
    activeSession.rubataPendingAck
  ) {
    const pendingAck = activeSession.rubataPendingAck as { auctionId: string }
    const referencedAuction = await prisma.auction.findUnique({
      where: { id: pendingAck.auctionId },
    })

    // If auction is COMPLETED, the appeal was rejected and everyone confirmed
    // Clear pendingAck and move to READY_CHECK for next player
    if (referencedAuction && referencedAuction.status === 'COMPLETED') {
      await prisma.marketSession.update({
        where: { id: activeSession.id },
        data: {
          rubataPendingAck: null,
          rubataReadyMembers: [],
          rubataState: 'READY_CHECK',
        },
      })

      // Re-fetch the session
      activeSession = await prisma.marketSession.findFirst({
        where: {
          leagueId,
          status: 'ACTIVE',
        },
      })

      if (!activeSession) {
        return { success: false, message: 'Nessuna sessione attiva' }
      }
    }
  }

  const isRubataPhase = activeSession.currentPhase === 'RUBATA'
  const board = activeSession.rubataBoard as Array<{
    rosterId: string
    memberId: string
    playerId: string
    playerName: string
    playerPosition: Position
    playerTeam: string
    ownerUsername: string
    ownerTeamName: string | null
    rubataPrice: number
    contractSalary: number
    contractDuration: number
    contractClause: number
  }> | null

  // Calculate remaining time if timer is active
  let remainingSeconds: number | null = null
  if (activeSession.rubataTimerStartedAt && activeSession.rubataState) {
    const now = new Date()
    const timerStart = new Date(activeSession.rubataTimerStartedAt)
    const timerDuration = activeSession.rubataState === 'OFFERING'
      ? activeSession.rubataOfferTimerSeconds
      : activeSession.rubataState === 'AUCTION'
        ? activeSession.rubataAuctionTimerSeconds
        : 0

    const elapsed = Math.floor((now.getTime() - timerStart.getTime()) / 1000)
    remainingSeconds = Math.max(0, timerDuration - elapsed)
  }

  // Get current player if board exists
  const currentPlayer = board && activeSession.rubataBoardIndex !== null
    ? board[activeSession.rubataBoardIndex]
    : null

  // Get active auction if any
  const activeAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'RUBATA',
      status: { in: ['PENDING', 'ACTIVE'] },
    },
    include: {
      player: true,
      bids: {
        orderBy: { amount: 'desc' },
        take: 10,
        include: {
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
  })

  return {
    success: true,
    data: {
      isRubataPhase,
      board,
      currentIndex: activeSession.rubataBoardIndex,
      currentPlayer,
      totalPlayers: board?.length ?? 0,
      rubataState: activeSession.rubataState,
      remainingSeconds,
      offerTimerSeconds: activeSession.rubataOfferTimerSeconds,
      auctionTimerSeconds: activeSession.rubataAuctionTimerSeconds,
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
              bidderId: b.bidderId,
              isWinning: b.isWinning,
            })),
          }
        : null,
      auctionReadyInfo: activeSession.rubataAuctionReadyInfo as {
        bidderUsername: string
        playerName: string
        playerTeam: string
        playerPosition: string
        ownerUsername: string
        basePrice: number
      } | null,
      // Pause info for resume ready check
      pausedRemainingSeconds: activeSession.rubataPausedRemainingSeconds,
      pausedFromState: activeSession.rubataPausedFromState,
      sessionId: activeSession.id,
      myMemberId: member.id,
      isAdmin: member.role === 'ADMIN',
    },
  }
}

// ==================== START RUBATA ====================

export async function startRubata(
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  if (!activeSession.rubataBoard) {
    return { success: false, message: 'Tabellone rubata non generato' }
  }

  const board = activeSession.rubataBoard as Array<unknown>
  if (board.length === 0) {
    return { success: false, message: 'Tabellone vuoto' }
  }

  // Start the offering phase for first player
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataBoardIndex: 0,
      rubataState: 'OFFERING',
      rubataTimerStartedAt: new Date(),
    },
  })

  return {
    success: true,
    message: 'Rubata avviata',
    data: { currentIndex: 0 },
  }
}

// ==================== UPDATE RUBATA TIMERS ====================

export async function updateRubataTimers(
  leagueId: string,
  adminUserId: string,
  offerTimerSeconds?: number,
  auctionTimerSeconds?: number
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  const updateData: { rubataOfferTimerSeconds?: number; rubataAuctionTimerSeconds?: number } = {}
  if (offerTimerSeconds !== undefined) {
    updateData.rubataOfferTimerSeconds = offerTimerSeconds
  }
  if (auctionTimerSeconds !== undefined) {
    updateData.rubataAuctionTimerSeconds = auctionTimerSeconds
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: updateData,
  })

  return {
    success: true,
    message: 'Timer aggiornati',
    data: {
      offerTimerSeconds: offerTimerSeconds ?? activeSession.rubataOfferTimerSeconds,
      auctionTimerSeconds: auctionTimerSeconds ?? activeSession.rubataAuctionTimerSeconds,
    },
  }
}

// ==================== MAKE RUBATA OFFER ====================

// Called when someone wants to ruba the current player within the offer timer
export async function makeRubataOffer(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  if (activeSession.rubataState !== 'OFFERING') {
    return { success: false, message: 'Non è il momento di fare offerte' }
  }

  // Check timer
  if (activeSession.rubataTimerStartedAt) {
    const now = new Date()
    const timerStart = new Date(activeSession.rubataTimerStartedAt)
    const elapsed = Math.floor((now.getTime() - timerStart.getTime()) / 1000)
    if (elapsed >= activeSession.rubataOfferTimerSeconds) {
      return { success: false, message: 'Timer scaduto' }
    }
  }

  const board = activeSession.rubataBoard as Array<{
    rosterId: string
    memberId: string
    playerId: string
    rubataPrice: number
    contractSalary: number
    contractDuration: number
    contractClause: number
  }>

  if (!board || activeSession.rubataBoardIndex === null) {
    return { success: false, message: 'Tabellone non disponibile' }
  }

  const currentPlayer = board[activeSession.rubataBoardIndex]
  if (!currentPlayer) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Cannot offer for own player
  if (currentPlayer.memberId === member.id) {
    return { success: false, message: 'Non puoi rubare un tuo giocatore' }
  }

  // Check budget
  if (currentPlayer.rubataPrice > member.currentBudget) {
    return { success: false, message: `Budget insufficiente. Necessario: ${currentPlayer.rubataPrice}, Disponibile: ${member.currentBudget}` }
  }

  // Check if there's already an active auction for this player
  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'RUBATA',
      status: { in: ['PENDING', 'ACTIVE'] },
    },
  })

  if (existingAuction) {
    return { success: false, message: 'C\'è già un\'asta in corso' }
  }

  // Get member username for announcement
  const memberWithUser = await prisma.leagueMember.findUnique({
    where: { id: member.id },
    include: { user: { select: { username: true } } },
  })

  // Create the rubata auction and place the initial bid
  const auction = await prisma.$transaction(async (tx) => {
    const newAuction = await tx.auction.create({
      data: {
        leagueId,
        marketSessionId: activeSession.id,
        playerId: currentPlayer.playerId,
        type: 'RUBATA',
        basePrice: currentPlayer.rubataPrice,
        currentPrice: currentPlayer.rubataPrice,
        sellerId: currentPlayer.memberId,
        status: AuctionStatus.ACTIVE,
        startsAt: new Date(),
      },
    })

    // Place initial bid
    await tx.auctionBid.create({
      data: {
        auctionId: newAuction.id,
        bidderId: member.id,
        userId,
        amount: currentPlayer.rubataPrice,
        isWinning: true,
      },
    })

    // Update session to AUCTION_READY_CHECK state (wait for all managers to be ready)
    await tx.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataState: 'AUCTION_READY_CHECK',
        rubataTimerStartedAt: null, // Timer will start when all ready
        rubataReadyMembers: [],
        rubataAuctionReadyInfo: {
          bidderUsername: memberWithUser?.user.username || 'Unknown',
          playerName: currentPlayer.playerName || 'Unknown',
          playerTeam: currentPlayer.playerTeam || '',
          playerPosition: currentPlayer.playerPosition || '',
          ownerUsername: currentPlayer.ownerUsername || 'Unknown',
          basePrice: currentPlayer.rubataPrice,
        },
      },
    })

    return newAuction
  })

  // Trigger Pusher event for real-time steal announcement (non-blocking)
  triggerRubataStealDeclared(activeSession.id, {
    sessionId: activeSession.id,
    bidderId: member.id,
    bidderUsername: memberWithUser?.user.username || 'Unknown',
    playerId: currentPlayer.playerId,
    playerName: currentPlayer.playerName || 'Unknown',
    playerTeam: currentPlayer.playerTeam || '',
    playerPosition: currentPlayer.playerPosition || '',
    ownerUsername: currentPlayer.ownerUsername || 'Unknown',
    basePrice: currentPlayer.rubataPrice,
    timestamp: new Date().toISOString(),
  }).catch(err => console.error('[Pusher] Failed to trigger steal declared:', err))

  return {
    success: true,
    message: `Offerta di ${currentPlayer.rubataPrice} registrata. Attendere che tutti siano pronti!`,
    data: { auctionId: auction.id, price: currentPlayer.rubataPrice },
  }
}

// ==================== BID ON RUBATA AUCTION (with timer reset) ====================

export async function bidOnRubataAuction(
  leagueId: string,
  userId: string,
  amount: number
): Promise<ServiceResult> {
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
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  if (activeSession.rubataState !== 'AUCTION') {
    return { success: false, message: 'Nessuna asta in corso' }
  }

  const activeAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'RUBATA',
      status: 'ACTIVE',
    },
  })

  if (!activeAuction) {
    return { success: false, message: 'Asta non trovata' }
  }

  // Cannot bid on own player
  if (activeAuction.sellerId === member.id) {
    return { success: false, message: 'Non puoi fare offerte per un tuo giocatore' }
  }

  // Check bid is higher
  if (amount <= activeAuction.currentPrice) {
    return { success: false, message: `L'offerta deve essere maggiore di ${activeAuction.currentPrice}` }
  }

  // Check budget
  if (amount > member.currentBudget) {
    return { success: false, message: `Budget insufficiente. Disponibile: ${member.currentBudget}` }
  }

  // Get member username and player info for Pusher notification
  const memberWithUser = await prisma.leagueMember.findUnique({
    where: { id: member.id },
    include: { user: { select: { username: true } } },
  })

  const playerInfo = await prisma.serieAPlayer.findUnique({
    where: { id: activeAuction.playerId },
  })

  // Place bid and reset timer
  await prisma.$transaction(async (tx) => {
    // Mark previous bids as not winning
    await tx.auctionBid.updateMany({
      where: { auctionId: activeAuction.id },
      data: { isWinning: false },
    })

    // Create new bid
    await tx.auctionBid.create({
      data: {
        auctionId: activeAuction.id,
        bidderId: member.id,
        userId,
        amount,
        isWinning: true,
      },
    })

    // Update auction current price
    await tx.auction.update({
      where: { id: activeAuction.id },
      data: { currentPrice: amount },
    })

    // Reset auction timer
    await tx.marketSession.update({
      where: { id: activeSession.id },
      data: { rubataTimerStartedAt: new Date() },
    })
  })

  // Trigger Pusher event for real-time update (non-blocking)
  triggerRubataBidPlaced(activeSession.id, {
    sessionId: activeSession.id,
    auctionId: activeAuction.id,
    bidderId: member.id,
    bidderUsername: memberWithUser?.user.username || 'Unknown',
    amount,
    playerName: playerInfo?.name || 'Unknown',
    timestamp: new Date().toISOString(),
  }).catch(err => console.error('[Pusher] Failed to trigger rubata bid:', err))

  return {
    success: true,
    message: `Offerta di ${amount} registrata`,
    data: { currentPrice: amount },
  }
}

// ==================== ADVANCE TO NEXT PLAYER ====================

export async function advanceRubataPlayer(
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  const board = activeSession.rubataBoard as Array<unknown>
  if (!board) {
    return { success: false, message: 'Tabellone non disponibile' }
  }

  const currentIndex = activeSession.rubataBoardIndex ?? 0
  const nextIndex = currentIndex + 1

  if (nextIndex >= board.length) {
    // Rubata completed
    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataState: 'COMPLETED',
        rubataTimerStartedAt: null,
      },
    })

    return {
      success: true,
      message: 'Rubata completata!',
      data: { completed: true },
    }
  }

  // Advance to next player
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataBoardIndex: nextIndex,
      rubataState: 'OFFERING',
      rubataTimerStartedAt: new Date(),
    },
  })

  return {
    success: true,
    message: `Passaggio al giocatore ${nextIndex + 1}/${board.length}`,
    data: { currentIndex: nextIndex, totalPlayers: board.length },
  }
}

// ==================== GO BACK TO PREVIOUS PLAYER ====================

export async function goBackRubataPlayer(
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  const currentIndex = activeSession.rubataBoardIndex ?? 0
  if (currentIndex <= 0) {
    return { success: false, message: 'Sei già al primo giocatore' }
  }

  const previousIndex = currentIndex - 1

  // Go back and reset timer
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataBoardIndex: previousIndex,
      rubataState: 'OFFERING',
      rubataTimerStartedAt: new Date(),
    },
  })

  return {
    success: true,
    message: `Tornato al giocatore ${previousIndex + 1}`,
    data: { currentIndex: previousIndex },
  }
}

// ==================== CLOSE CURRENT RUBATA AUCTION ====================

// Called when timer expires or auction needs to be closed
export async function closeCurrentRubataAuction(
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  // Find active auction
  const activeAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'RUBATA',
      status: 'ACTIVE',
    },
    include: {
      player: true,
      bids: {
        where: { isWinning: true },
        include: {
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
  })

  if (!activeAuction) {
    // No auction = no offers, just advance
    return advanceRubataPlayer(leagueId, adminUserId)
  }

  const winningBid = activeAuction.bids[0]

  if (!winningBid) {
    // No bids - shouldn't happen if auction exists, but handle it
    await prisma.auction.update({
      where: { id: activeAuction.id },
      data: {
        status: AuctionStatus.NO_BIDS,
        endsAt: new Date(),
      },
    })

    return advanceRubataPlayer(leagueId, adminUserId)
  }

  // Execute the rubata transfer
  await prisma.$transaction(async (tx) => {
    // Get seller
    const seller = await tx.leagueMember.findUnique({
      where: { id: activeAuction.sellerId! },
    })

    if (!seller) throw new Error('Seller not found')

    // Get the roster entry
    const rosterEntry = await tx.playerRoster.findFirst({
      where: {
        leagueMemberId: activeAuction.sellerId!,
        playerId: activeAuction.playerId,
        status: RosterStatus.ACTIVE,
      },
      include: { contract: true },
    })

    if (!rosterEntry) throw new Error('Roster entry not found')

    const payment = activeAuction.currentPrice

    // Update winner budget (decrease)
    await tx.leagueMember.update({
      where: { id: winningBid.bidderId },
      data: { currentBudget: { decrement: payment } },
    })

    // Update seller budget (increase)
    await tx.leagueMember.update({
      where: { id: activeAuction.sellerId! },
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
      where: { id: activeAuction.id },
      data: {
        status: AuctionStatus.COMPLETED,
        winnerId: winningBid.bidderId,
        endsAt: new Date(),
      },
    })
  })

  // Record movement with contract info
  const transferredRoster2 = await prisma.playerRoster.findFirst({
    where: {
      leagueMemberId: winningBid.bidderId,
      playerId: activeAuction.playerId,
      status: RosterStatus.ACTIVE,
    },
    include: { contract: true },
  })

  await recordMovement({
    leagueId,
    playerId: activeAuction.playerId,
    movementType: 'RUBATA',
    fromMemberId: activeAuction.sellerId!,
    toMemberId: winningBid.bidderId,
    price: activeAuction.currentPrice,
    marketSessionId: activeSession.id,
    auctionId: activeAuction.id,
    oldSalary: transferredRoster2?.contract?.salary,
    oldDuration: transferredRoster2?.contract?.duration,
    oldClause: transferredRoster2?.contract?.rescissionClause,
    newSalary: transferredRoster2?.contract?.salary,
    newDuration: transferredRoster2?.contract?.duration,
    newClause: transferredRoster2?.contract?.rescissionClause,
  })

  // Get seller info for pending ack
  const seller = await prisma.leagueMember.findUnique({
    where: { id: activeAuction.sellerId! },
    include: { user: { select: { username: true } } },
  })

  // Create pending acknowledgment and advance board index
  const board = activeSession.rubataBoard as Array<{
    rosterId: string
    memberId: string
    playerId: string
    playerName: string
    playerPosition: Position
    playerTeam: string
    ownerUsername: string
    ownerTeamName: string | null
    rubataPrice: number
    contractSalary: number
    contractDuration: number
    contractClause: number
    stolenById?: string | null
    stolenByUsername?: string | null
    stolenPrice?: number | null
  }>
  const currentIndex = activeSession.rubataBoardIndex ?? 0
  const nextIndex = currentIndex + 1
  const isCompleted = nextIndex >= board.length

  // Update board entry with winner info
  const updatedBoard = board.map((entry, idx) => {
    if (idx === currentIndex) {
      return {
        ...entry,
        stolenById: winningBid.bidderId,
        stolenByUsername: winningBid.bidder.user.username,
        stolenPrice: activeAuction.currentPrice,
      }
    }
    return entry
  })

  // Create pending acknowledgment
  const pendingAck = {
    auctionId: activeAuction.id,
    playerId: activeAuction.playerId,
    playerName: activeAuction.player.name,
    playerTeam: activeAuction.player.team,
    playerPosition: activeAuction.player.position,
    winnerId: winningBid.bidderId,
    winnerUsername: winningBid.bidder.user.username,
    sellerId: activeAuction.sellerId!,
    sellerUsername: seller?.user.username || 'Unknown',
    finalPrice: activeAuction.currentPrice,
    acknowledgedMembers: [],
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataBoard: updatedBoard,
      rubataBoardIndex: nextIndex,
      rubataState: 'PENDING_ACK',
      rubataTimerStartedAt: null,
      rubataPendingAck: pendingAck,
      rubataReadyMembers: [],
    },
  })

  // Trigger Pusher event for auction closed (non-blocking)
  triggerAuctionClosed(activeSession.id, {
    auctionId: activeAuction.id,
    playerId: activeAuction.playerId,
    playerName: activeAuction.player.name,
    winnerId: winningBid.bidderId,
    winnerName: winningBid.bidder.user.username,
    finalPrice: activeAuction.currentPrice,
    wasUnsold: false,
    timestamp: new Date().toISOString(),
  }).catch(err => console.error('[Pusher] Failed to trigger auction closed:', err))

  return {
    success: true,
    message: `${activeAuction.player.name} rubato da ${winningBid.bidder.user.username} per ${activeAuction.currentPrice}M`,
    data: {
      player: activeAuction.player,
      winnerId: winningBid.bidderId,
      winnerUsername: winningBid.bidder.user.username,
      finalPrice: activeAuction.currentPrice,
      isCompleted,
      pendingAck: true,
    },
  }
}

// ==================== PAUSE/RESUME RUBATA ====================

export async function pauseRubata(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  // Can only pause during OFFERING or AUCTION states
  if (activeSession.rubataState !== 'OFFERING' && activeSession.rubataState !== 'AUCTION') {
    return { success: false, message: 'Puoi mettere in pausa solo durante OFFERTA o ASTA' }
  }

  // Calculate remaining seconds
  let remainingSeconds = 0
  if (activeSession.rubataTimerStartedAt) {
    const elapsedMs = Date.now() - activeSession.rubataTimerStartedAt.getTime()
    const elapsedSeconds = Math.floor(elapsedMs / 1000)

    const totalSeconds = activeSession.rubataState === 'OFFERING'
      ? activeSession.rubataOfferTimerSeconds
      : activeSession.rubataAuctionTimerSeconds

    remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataPausedFromState: activeSession.rubataState,
      rubataPausedRemainingSeconds: remainingSeconds,
      rubataState: 'PAUSED',
      rubataTimerStartedAt: null,
      rubataReadyMembers: [], // Clear ready members for resume check
    },
  })

  return {
    success: true,
    message: `Rubata in pausa (${remainingSeconds} secondi rimanenti)`,
    data: { remainingSeconds, pausedFromState: activeSession.rubataState },
  }
}

export async function resumeRubata(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  if (activeSession.rubataState !== 'PAUSED') {
    return { success: false, message: 'La rubata non è in pausa' }
  }

  // Instead of immediately resuming, wait for all managers to be ready
  // The actual resume will happen when all members are ready (via setRubataReady or forceAllRubataReady)
  // For now, just clear the ready members and keep PAUSED state - frontend will show ready check UI
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataReadyMembers: [],
    },
  })

  return {
    success: true,
    message: 'Attendere che tutti i manager siano pronti per riprendere',
    data: {
      pausedRemainingSeconds: activeSession.rubataPausedRemainingSeconds,
      pausedFromState: activeSession.rubataPausedFromState,
      requiresReadyCheck: true,
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

// ==================== READY CHECK SYSTEM ====================

export async function getRubataReadyStatus(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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
    include: {
      league: {
        include: {
          members: {
            where: { status: MemberStatus.ACTIVE },
            include: { user: { select: { id: true, username: true } } },
          },
        },
      },
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  const allMembers = activeSession.league.members
  const rubataReadyMembers = (activeSession.rubataReadyMembers as string[]) || []

  // Get connection status for all managers
  const connectionStatus = getRubataConnectionStatus(leagueId)

  const readyMembers = allMembers
    .filter(m => rubataReadyMembers.includes(m.id))
    .map(m => ({ id: m.id, username: m.user.username, isConnected: connectionStatus.get(m.id) ?? false }))

  const pendingMembers = allMembers
    .filter(m => !rubataReadyMembers.includes(m.id))
    .map(m => ({ id: m.id, username: m.user.username, isConnected: connectionStatus.get(m.id) ?? false }))

  return {
    success: true,
    data: {
      rubataState: activeSession.rubataState,
      readyMembers,
      pendingMembers,
      totalMembers: allMembers.length,
      readyCount: readyMembers.length,
      allReady: pendingMembers.length === 0,
      userIsReady: rubataReadyMembers.includes(member.id),
      myMemberId: member.id,
      isAdmin: member.role === 'ADMIN',
    },
  }
}

export async function setRubataReady(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  // Only allow ready check in READY_CHECK, PENDING_ACK, AUCTION_READY_CHECK, or PAUSED state
  const allowedReadyStates = ['READY_CHECK', 'PENDING_ACK', 'AUCTION_READY_CHECK', 'PAUSED']
  if (!allowedReadyStates.includes(activeSession.rubataState || '')) {
    return { success: false, message: 'Non è il momento di dichiararsi pronti' }
  }

  const rubataReadyMembers = (activeSession.rubataReadyMembers as string[]) || []

  if (rubataReadyMembers.includes(member.id)) {
    return { success: true, message: 'Già pronto' }
  }

  const updatedReadyMembers = [...rubataReadyMembers, member.id]

  // Get member username for Pusher notification
  const memberWithUser = await prisma.leagueMember.findUnique({
    where: { id: member.id },
    include: { user: { select: { username: true } } },
  })

  // Check if all members are ready
  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId, status: MemberStatus.ACTIVE },
  })

  const allReady = allMembers.every(m => updatedReadyMembers.includes(m.id))

  // Trigger Pusher event for real-time ready update (non-blocking)
  triggerRubataReadyChanged(activeSession.id, {
    sessionId: activeSession.id,
    memberId: member.id,
    memberUsername: memberWithUser?.user.username || 'Unknown',
    isReady: true,
    readyCount: updatedReadyMembers.length,
    totalMembers: allMembers.length,
    timestamp: new Date().toISOString(),
  }).catch(err => console.error('[Pusher] Failed to trigger ready changed:', err))

  // If in AUCTION_READY_CHECK state and all ready, start the auction
  if (activeSession.rubataState === 'AUCTION_READY_CHECK' && allReady) {
    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataReadyMembers: [],
        rubataAuctionReadyInfo: null,
        rubataState: 'AUCTION',
        rubataTimerStartedAt: new Date(),
      },
    })

    return {
      success: true,
      message: 'Tutti pronti! Asta avviata.',
      data: { allReady: true, auctionStarted: true },
    }
  }

  // If in PENDING_ACK state and all ready, clear pending ack and advance
  if (activeSession.rubataState === 'PENDING_ACK' && allReady) {
    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataReadyMembers: [],
        rubataPendingAck: null,
        rubataState: 'OFFERING',
        rubataTimerStartedAt: new Date(),
      },
    })

    return {
      success: true,
      message: 'Tutti pronti! Si riparte.',
      data: { allReady: true },
    }
  }

  // If in PAUSED state and all ready, resume with saved remaining time
  if (activeSession.rubataState === 'PAUSED' && allReady) {
    const resumeState = activeSession.rubataPausedFromState || 'OFFERING'
    const remainingSeconds = activeSession.rubataPausedRemainingSeconds || 0

    // Calculate the start time to make the timer show the remaining seconds
    // If we have 10 seconds remaining and the timer is 30 seconds total,
    // we set timerStartedAt to (now - (30 - 10) seconds) = (now - 20 seconds)
    const totalSeconds = resumeState === 'AUCTION'
      ? activeSession.rubataAuctionTimerSeconds
      : activeSession.rubataOfferTimerSeconds
    const offsetSeconds = totalSeconds - remainingSeconds
    const adjustedStartTime = new Date(Date.now() - offsetSeconds * 1000)

    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataReadyMembers: [],
        rubataState: resumeState,
        rubataTimerStartedAt: adjustedStartTime,
        rubataPausedFromState: null,
        rubataPausedRemainingSeconds: null,
      },
    })

    return {
      success: true,
      message: `Tutti pronti! Rubata ripresa (${remainingSeconds} secondi rimanenti).`,
      data: { allReady: true, resumed: true, remainingSeconds },
    }
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: { rubataReadyMembers: updatedReadyMembers },
  })

  return {
    success: true,
    message: 'Pronto!',
    data: {
      allReady,
      readyCount: updatedReadyMembers.length,
      totalMembers: allMembers.length,
    },
  }
}

export async function forceAllRubataReady(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId, status: MemberStatus.ACTIVE },
  })

  const allMemberIds = allMembers.map(m => m.id)

  // If in AUCTION_READY_CHECK state, start the auction
  if (activeSession.rubataState === 'AUCTION_READY_CHECK') {
    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataReadyMembers: [],
        rubataAuctionReadyInfo: null,
        rubataState: 'AUCTION',
        rubataTimerStartedAt: new Date(),
      },
    })

    return {
      success: true,
      message: 'Tutti pronti forzati! Asta avviata.',
    }
  }

  // If in PENDING_ACK state, clear and advance
  if (activeSession.rubataState === 'PENDING_ACK') {
    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataReadyMembers: [],
        rubataPendingAck: null,
        rubataState: 'OFFERING',
        rubataTimerStartedAt: new Date(),
      },
    })

    return {
      success: true,
      message: 'Tutti pronti forzati! Si riparte.',
    }
  }

  // If in READY_CHECK state, mark all ready and start
  if (activeSession.rubataState === 'READY_CHECK') {
    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataReadyMembers: allMemberIds,
        rubataState: 'OFFERING',
        rubataTimerStartedAt: new Date(),
      },
    })

    return {
      success: true,
      message: 'Tutti pronti! Rubata avviata.',
    }
  }

  // If in PAUSED state, force resume with saved remaining time
  if (activeSession.rubataState === 'PAUSED') {
    const resumeState = activeSession.rubataPausedFromState || 'OFFERING'
    const remainingSeconds = activeSession.rubataPausedRemainingSeconds || 0

    // Calculate the start time to make the timer show the remaining seconds
    const totalSeconds = resumeState === 'AUCTION'
      ? activeSession.rubataAuctionTimerSeconds
      : activeSession.rubataOfferTimerSeconds
    const offsetSeconds = totalSeconds - remainingSeconds
    const adjustedStartTime = new Date(Date.now() - offsetSeconds * 1000)

    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataReadyMembers: [],
        rubataState: resumeState,
        rubataTimerStartedAt: adjustedStartTime,
        rubataPausedFromState: null,
        rubataPausedRemainingSeconds: null,
      },
    })

    return {
      success: true,
      message: `Tutti pronti forzati! Rubata ripresa (${remainingSeconds} secondi rimanenti).`,
    }
  }

  return { success: false, message: 'Stato non valido per forzare pronti' }
}

// ==================== TRANSACTION ACKNOWLEDGMENT ====================

export async function getRubataPendingAck(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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
    include: {
      league: {
        include: {
          members: {
            where: { status: MemberStatus.ACTIVE },
            include: { user: { select: { id: true, username: true } } },
          },
        },
      },
    },
  })

  if (!activeSession || !activeSession.rubataPendingAck) {
    return { success: true, data: null }
  }

  const pendingAck = activeSession.rubataPendingAck as {
    auctionId: string
    playerId: string
    playerName: string
    playerTeam: string
    playerPosition: string
    winnerId: string | null
    winnerUsername: string | null
    sellerId: string
    sellerUsername: string
    finalPrice: number
    acknowledgedMembers: string[]
    prophecies?: Array<{ memberId: string; username: string; content: string; createdAt: string }>
  }

  const allMembers = activeSession.league.members
  const acknowledgedMembers = allMembers
    .filter(m => pendingAck.acknowledgedMembers.includes(m.id))
    .map(m => ({ id: m.id, username: m.user.username }))

  const pendingMembers = allMembers
    .filter(m => !pendingAck.acknowledgedMembers.includes(m.id))
    .map(m => ({ id: m.id, username: m.user.username }))

  // Get contract info for the winner (for post-acquisition modification)
  let contractInfo = null
  if (pendingAck.winnerId === member.id) {
    const roster = await prisma.playerRoster.findFirst({
      where: {
        leagueMemberId: member.id,
        playerId: pendingAck.playerId,
        status: RosterStatus.ACTIVE,
      },
      include: { contract: true },
    })
    if (roster?.contract) {
      contractInfo = {
        contractId: roster.contract.id,
        rosterId: roster.id,
        salary: roster.contract.salary,
        duration: roster.contract.duration,
        initialSalary: roster.contract.initialSalary,
        rescissionClause: roster.contract.rescissionClause,
      }
    }
  }

  return {
    success: true,
    data: {
      auctionId: pendingAck.auctionId,
      player: {
        id: pendingAck.playerId,
        name: pendingAck.playerName,
        team: pendingAck.playerTeam,
        position: pendingAck.playerPosition,
      },
      winner: pendingAck.winnerId ? {
        id: pendingAck.winnerId,
        username: pendingAck.winnerUsername,
      } : null,
      seller: {
        id: pendingAck.sellerId,
        username: pendingAck.sellerUsername,
      },
      finalPrice: pendingAck.finalPrice,
      acknowledgedMembers,
      pendingMembers,
      totalMembers: allMembers.length,
      totalAcknowledged: acknowledgedMembers.length,
      userAcknowledged: pendingAck.acknowledgedMembers.includes(member.id),
      allAcknowledged: pendingMembers.length === 0,
      prophecies: pendingAck.prophecies || [],
      // Contract info for the winner to modify after acknowledging
      winnerContractInfo: contractInfo,
    },
  }
}

export async function acknowledgeRubataTransaction(
  leagueId: string,
  userId: string,
  prophecy?: string
): Promise<ServiceResult> {
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
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession || activeSession.rubataState !== 'PENDING_ACK') {
    return { success: false, message: 'Nessuna transazione da confermare' }
  }

  if (!activeSession.rubataPendingAck) {
    return { success: false, message: 'Nessuna transazione pendente' }
  }

  const pendingAck = activeSession.rubataPendingAck as {
    auctionId: string
    playerId: string
    playerName: string
    winnerId: string | null
    finalPrice: number
    acknowledgedMembers: string[]
    prophecies?: Array<{ memberId: string; username: string; content: string; createdAt: string }>
  }

  if (pendingAck.acknowledgedMembers.includes(member.id)) {
    return { success: true, message: 'Già confermato' }
  }

  // Get member username for prophecy
  const memberWithUser = await prisma.leagueMember.findUnique({
    where: { id: member.id },
    include: { user: { select: { username: true } } },
  })

  // Add prophecy if provided
  const existingProphecies = pendingAck.prophecies || []
  const newProphecies = prophecy?.trim()
    ? [...existingProphecies, {
        memberId: member.id,
        username: memberWithUser?.user.username || 'Unknown',
        content: prophecy.trim(),
        createdAt: new Date().toISOString(),
      }]
    : existingProphecies

  const updatedAck = {
    ...pendingAck,
    acknowledgedMembers: [...pendingAck.acknowledgedMembers, member.id],
    prophecies: newProphecies,
  }

  // Check if all members have acknowledged
  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId, status: MemberStatus.ACTIVE },
  })

  const allAcknowledged = allMembers.every(m => updatedAck.acknowledgedMembers.includes(m.id))

  // Get contract info for winner (for post-rubata contract modification)
  let winnerContractInfo = null
  if (pendingAck.winnerId === member.id) {
    const roster = await prisma.playerRoster.findFirst({
      where: {
        leagueMemberId: member.id,
        playerId: pendingAck.playerId,
        status: RosterStatus.ACTIVE,
      },
      include: { contract: true },
    })
    if (roster?.contract) {
      winnerContractInfo = {
        contractId: roster.contract.id,
        rosterId: roster.id,
        playerId: pendingAck.playerId,
        playerName: pendingAck.playerName,
        salary: roster.contract.salary,
        duration: roster.contract.duration,
        initialSalary: roster.contract.initialSalary,
        rescissionClause: roster.contract.rescissionClause,
      }
    }
  }

  if (allAcknowledged) {
    // Clear pending ack and move to ready check for next player
    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataPendingAck: null,
        rubataReadyMembers: [],
        rubataState: 'READY_CHECK',
      },
    })

    return {
      success: true,
      message: 'Tutti hanno confermato! Dichiararsi pronti per il prossimo giocatore.',
      data: {
        allAcknowledged: true,
        winnerContractInfo, // For contract modification modal
      },
    }
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: { rubataPendingAck: updatedAck },
  })

  return {
    success: true,
    message: 'Confermato!',
    data: {
      allAcknowledged: false,
      acknowledgedCount: updatedAck.acknowledgedMembers.length,
      totalMembers: allMembers.length,
      winnerContractInfo, // For contract modification modal
    },
  }
}

export async function forceAllRubataAcknowledge(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession || activeSession.rubataState !== 'PENDING_ACK') {
    return { success: false, message: 'Nessuna transazione pendente' }
  }

  // Clear pending ack and move to ready check
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataPendingAck: null,
      rubataReadyMembers: [],
      rubataState: 'READY_CHECK',
    },
  })

  return {
    success: true,
    message: 'Conferme forzate! Pronti per il prossimo giocatore.',
  }
}

// ==================== ADMIN SIMULATION ====================

export async function simulateRubataOffer(
  leagueId: string,
  adminUserId: string,
  targetMemberId: string
): Promise<ServiceResult> {
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

  // Get the target member
  const targetMember = await prisma.leagueMember.findFirst({
    where: {
      id: targetMemberId,
      leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!targetMember) {
    return { success: false, message: 'Manager non trovato' }
  }

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  if (activeSession.rubataState !== 'OFFERING') {
    return { success: false, message: 'Non è il momento di fare offerte' }
  }

  const board = activeSession.rubataBoard as Array<{
    rosterId: string
    memberId: string
    playerId: string
    rubataPrice: number
    contractSalary: number
    contractDuration: number
    contractClause: number
  }>

  if (!board || activeSession.rubataBoardIndex === null) {
    return { success: false, message: 'Tabellone non disponibile' }
  }

  const currentPlayer = board[activeSession.rubataBoardIndex]
  if (!currentPlayer) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Cannot offer for own player
  if (currentPlayer.memberId === targetMember.id) {
    return { success: false, message: 'Non può rubare un proprio giocatore' }
  }

  // Check budget
  if (currentPlayer.rubataPrice > targetMember.currentBudget) {
    return { success: false, message: `Budget insufficiente per ${targetMember.id}` }
  }

  // Check if there's already an active auction
  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'RUBATA',
      status: { in: ['PENDING', 'ACTIVE'] },
    },
  })

  if (existingAuction) {
    return { success: false, message: 'C\'è già un\'asta in corso' }
  }

  // Get target member username
  const targetMemberWithUser = await prisma.leagueMember.findUnique({
    where: { id: targetMember.id },
    include: { user: { select: { username: true } } },
  })

  // Get current player owner username
  const ownerMember = await prisma.leagueMember.findFirst({
    where: { id: currentPlayer.memberId },
    include: { user: { select: { username: true } } },
  })

  // Get player info for announcement
  const playerInfo = await prisma.serieAPlayer.findUnique({
    where: { id: currentPlayer.playerId },
  })

  // Create the rubata auction with simulated bid
  const auction = await prisma.$transaction(async (tx) => {
    const newAuction = await tx.auction.create({
      data: {
        leagueId,
        marketSessionId: activeSession.id,
        playerId: currentPlayer.playerId,
        type: 'RUBATA',
        basePrice: currentPlayer.rubataPrice,
        currentPrice: currentPlayer.rubataPrice,
        sellerId: currentPlayer.memberId,
        status: AuctionStatus.ACTIVE,
        startsAt: new Date(),
      },
    })

    // Place simulated initial bid
    await tx.auctionBid.create({
      data: {
        auctionId: newAuction.id,
        bidderId: targetMember.id,
        userId: targetMember.userId,
        amount: currentPlayer.rubataPrice,
        isWinning: true,
      },
    })

    // Update session to AUCTION_READY_CHECK state
    await tx.marketSession.update({
      where: { id: activeSession.id },
      data: {
        rubataState: 'AUCTION_READY_CHECK',
        rubataTimerStartedAt: null,
        rubataReadyMembers: [],
        rubataAuctionReadyInfo: {
          bidderUsername: targetMemberWithUser?.user.username || 'Unknown',
          playerName: playerInfo?.name || 'Unknown',
          playerTeam: playerInfo?.team || '',
          playerPosition: playerInfo?.position || '',
          ownerUsername: ownerMember?.user.username || 'Unknown',
          basePrice: currentPlayer.rubataPrice,
        },
      },
    })

    return newAuction
  })

  return {
    success: true,
    message: `Offerta simulata per ${targetMemberId} di ${currentPlayer.rubataPrice}M. Attendere che tutti siano pronti!`,
    data: { auctionId: auction.id, price: currentPlayer.rubataPrice },
  }
}

export async function simulateRubataBid(
  leagueId: string,
  adminUserId: string,
  targetMemberId: string,
  amount: number
): Promise<ServiceResult> {
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

  const targetMember = await prisma.leagueMember.findFirst({
    where: {
      id: targetMemberId,
      leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!targetMember) {
    return { success: false, message: 'Manager non trovato' }
  }

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  if (activeSession.rubataState !== 'AUCTION') {
    return { success: false, message: 'Nessuna asta in corso' }
  }

  const activeAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'RUBATA',
      status: 'ACTIVE',
    },
  })

  if (!activeAuction) {
    return { success: false, message: 'Asta non trovata' }
  }

  // Cannot bid on own player
  if (activeAuction.sellerId === targetMember.id) {
    return { success: false, message: 'Non può fare offerte per un proprio giocatore' }
  }

  // Check bid is higher
  if (amount <= activeAuction.currentPrice) {
    return { success: false, message: `L'offerta deve essere maggiore di ${activeAuction.currentPrice}` }
  }

  // Check budget
  if (amount > targetMember.currentBudget) {
    return { success: false, message: `Budget insufficiente. Disponibile: ${targetMember.currentBudget}` }
  }

  // Place simulated bid
  await prisma.$transaction(async (tx) => {
    await tx.auctionBid.updateMany({
      where: { auctionId: activeAuction.id },
      data: { isWinning: false },
    })

    await tx.auctionBid.create({
      data: {
        auctionId: activeAuction.id,
        bidderId: targetMember.id,
        userId: targetMember.userId,
        amount,
        isWinning: true,
      },
    })

    await tx.auction.update({
      where: { id: activeAuction.id },
      data: { currentPrice: amount },
    })

    // Reset auction timer
    await tx.marketSession.update({
      where: { id: activeSession.id },
      data: { rubataTimerStartedAt: new Date() },
    })
  })

  return {
    success: true,
    message: `Offerta simulata di ${amount}M per ${targetMemberId}`,
    data: { currentPrice: amount },
  }
}

/**
 * Complete remaining rubata with random transactions (for testing)
 * Some players will be stolen, some will not
 */
export async function completeRubataWithTransactions(
  leagueId: string,
  adminUserId: string,
  stealProbability: number = 0.3 // 30% chance of steal per player
): Promise<ServiceResult> {
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession || !activeSession.rubataBoard) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  const board = activeSession.rubataBoard as Array<{
    rosterId: string
    memberId: string
    playerId: string
    playerName: string
    playerPosition: string
    playerTeam: string
    ownerUsername: string
    rubataPrice: number
    contractSalary: number
    stolenById?: string | null
    stolenByUsername?: string | null
    stolenPrice?: number | null
  }>

  const currentIndex = activeSession.rubataBoardIndex ?? 0
  const remainingPlayers = board.length - currentIndex

  if (remainingPlayers <= 0) {
    return { success: false, message: 'Rubata già completata' }
  }

  // Get all members for random stealing (refresh budgets)
  let allMembers = await prisma.leagueMember.findMany({
    where: { leagueId, status: MemberStatus.ACTIVE },
    include: { user: { select: { username: true } } },
  })

  let steals = 0

  for (let i = currentIndex; i < board.length; i++) {
    const player = board[i]
    const shouldSteal = Math.random() < stealProbability

    if (shouldSteal) {
      // Refresh member budgets
      allMembers = await prisma.leagueMember.findMany({
        where: { leagueId, status: MemberStatus.ACTIVE },
        include: { user: { select: { username: true } } },
      })

      // Find a member who can afford the rubata (not the owner)
      const eligibleBuyers = allMembers.filter(
        m => m.id !== player.memberId && m.currentBudget >= player.rubataPrice + 1
      )

      if (eligibleBuyers.length > 0) {
        const buyer = eligibleBuyers[Math.floor(Math.random() * eligibleBuyers.length)]
        const bidAmount = player.rubataPrice + Math.floor(Math.random() * 5) + 1

        // Get the roster entry
        const rosterEntry = await prisma.playerRoster.findFirst({
          where: {
            id: player.rosterId,
            status: RosterStatus.ACTIVE,
          },
          include: { contract: true },
        })

        if (rosterEntry) {
          // Create completed auction
          const auction = await prisma.auction.create({
            data: {
              leagueId,
              playerId: player.playerId,
              marketSessionId: activeSession.id,
              type: 'RUBATA',
              status: 'COMPLETED',
              basePrice: player.rubataPrice,
              currentPrice: bidAmount,
              sellerId: player.memberId,
              winnerId: buyer.id,
              endsAt: new Date(),
            },
          })

          // Create winning bid
          await prisma.auctionBid.create({
            data: {
              auctionId: auction.id,
              bidderId: buyer.id,
              userId: buyer.userId,
              amount: bidAmount,
              isWinning: true,
            },
          })

          // Update budgets
          await prisma.leagueMember.update({
            where: { id: buyer.id },
            data: { currentBudget: { decrement: bidAmount } },
          })

          await prisma.leagueMember.update({
            where: { id: player.memberId },
            data: { currentBudget: { increment: bidAmount } },
          })

          // Transfer roster to winner
          await prisma.playerRoster.update({
            where: { id: rosterEntry.id },
            data: {
              leagueMemberId: buyer.id,
              acquisitionType: 'RUBATA',
              acquisitionPrice: bidAmount,
            },
          })

          // Transfer contract to winner
          if (rosterEntry.contract) {
            await prisma.playerContract.update({
              where: { id: rosterEntry.contract.id },
              data: { leagueMemberId: buyer.id },
            })
          }

          // Record movement with contract info
          await recordMovement({
            leagueId,
            playerId: player.playerId,
            movementType: 'RUBATA',
            fromMemberId: player.memberId,
            toMemberId: buyer.id,
            price: bidAmount,
            marketSessionId: activeSession.id,
            auctionId: auction.id,
            oldSalary: rosterEntry.contract?.salary,
            oldDuration: rosterEntry.contract?.duration,
            oldClause: rosterEntry.contract?.rescissionClause,
            newSalary: rosterEntry.contract?.salary,
            newDuration: rosterEntry.contract?.duration,
            newClause: rosterEntry.contract?.rescissionClause,
          })

          // Update board with stolen info
          board[i] = {
            ...player,
            stolenById: buyer.id,
            stolenByUsername: buyer.user.username,
            stolenPrice: bidAmount,
          }

          steals++
        }
      }
    }
  }

  // Mark rubata as completed
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataBoard: board,
      rubataBoardIndex: board.length,
      rubataState: 'COMPLETED',
      rubataTimerStartedAt: null,
      rubataPendingAck: null,
      rubataReadyMembers: [],
    },
  })

  return {
    success: true,
    message: `Rubata completata! ${steals} rubate effettuate su ${remainingPlayers} giocatori rimasti.`,
    data: {
      totalPlayers: board.length,
      processedPlayers: remainingPlayers,
      steals,
      skips: remainingPlayers - steals,
    },
  }
}

// ==================== RUBATA PREFERENCES ====================

export async function getRubataPreferences(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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

  // Find a session to load preferences from (prefer active RUBATA, then any active, then most recent)
  let session = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  // If no active RUBATA session, try to find any active session
  if (!session) {
    session = await prisma.marketSession.findFirst({
      where: {
        leagueId,
        status: 'ACTIVE',
      },
    })
  }

  // If still no session, find the most recent session for the league
  if (!session) {
    session = await prisma.marketSession.findFirst({
      where: { leagueId },
      orderBy: { createdAt: 'desc' },
    })
  }

  if (!session) {
    return { success: false, message: 'Nessuna sessione trovata per questa lega' }
  }

  const preferences = await prisma.rubataPreference.findMany({
    where: {
      sessionId: session.id,
      memberId: member.id,
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          team: true,
          position: true,
          quotation: true,
        },
      },
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  return {
    success: true,
    data: {
      preferences,
      sessionId: session.id,
      memberId: member.id,
    },
  }
}

export async function setRubataPreference(
  leagueId: string,
  userId: string,
  playerId: string,
  preference: {
    isWatchlist?: boolean
    isAutoPass?: boolean
    maxBid?: number | null
    priority?: number | null
    notes?: string | null
  }
): Promise<ServiceResult> {
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

  // Find a session to attach preferences to (prefer active RUBATA, then any active, then most recent)
  let session = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  // If in active RUBATA phase, check if auction is running (block modifications during auction)
  if (session) {
    const blockedStates = ['OFFERING', 'AUCTION']
    if (blockedStates.includes(session.rubataState || '')) {
      return { success: false, message: 'Non puoi modificare le preferenze durante l\'asta attiva' }
    }
  }

  // If no active RUBATA session, try to find any active session
  if (!session) {
    session = await prisma.marketSession.findFirst({
      where: {
        leagueId,
        status: 'ACTIVE',
      },
    })
  }

  // If still no session, find the most recent session for the league
  if (!session) {
    session = await prisma.marketSession.findFirst({
      where: { leagueId },
      orderBy: { createdAt: 'desc' },
    })
  }

  if (!session) {
    return { success: false, message: 'Nessuna sessione trovata per questa lega' }
  }

  // Verify player exists
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Upsert preference
  const result = await prisma.rubataPreference.upsert({
    where: {
      sessionId_memberId_playerId: {
        sessionId: session.id,
        memberId: member.id,
        playerId,
      },
    },
    create: {
      sessionId: session.id,
      memberId: member.id,
      playerId,
      isWatchlist: preference.isWatchlist ?? false,
      isAutoPass: preference.isAutoPass ?? false,
      maxBid: preference.maxBid,
      priority: preference.priority,
      notes: preference.notes,
    },
    update: {
      isWatchlist: preference.isWatchlist,
      isAutoPass: preference.isAutoPass,
      maxBid: preference.maxBid,
      priority: preference.priority,
      notes: preference.notes,
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          team: true,
          position: true,
        },
      },
    },
  })

  return {
    success: true,
    message: 'Preferenza salvata',
    data: result,
  }
}

export async function deleteRubataPreference(
  leagueId: string,
  userId: string,
  playerId: string
): Promise<ServiceResult> {
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

  // Find a session to delete preferences from (prefer active RUBATA, then any active, then most recent)
  let session = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  // If in active RUBATA phase, block deletion during auction
  if (session) {
    const blockedStates = ['OFFERING', 'AUCTION']
    if (blockedStates.includes(session.rubataState || '')) {
      return { success: false, message: 'Non puoi modificare le preferenze durante l\'asta attiva' }
    }
  }

  // If no active RUBATA session, try to find any active session
  if (!session) {
    session = await prisma.marketSession.findFirst({
      where: {
        leagueId,
        status: 'ACTIVE',
      },
    })
  }

  // If still no session, find the most recent session for the league
  if (!session) {
    session = await prisma.marketSession.findFirst({
      where: { leagueId },
      orderBy: { createdAt: 'desc' },
    })
  }

  if (!session) {
    return { success: false, message: 'Nessuna sessione trovata per questa lega' }
  }

  await prisma.rubataPreference.deleteMany({
    where: {
      sessionId: session.id,
      memberId: member.id,
      playerId,
    },
  })

  return {
    success: true,
    message: 'Preferenza rimossa',
  }
}

// ==================== ALL PLAYERS FOR STRATEGIES (Year-Round) ====================

export async function getAllPlayersForStrategies(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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

  // Check if there's an active session (any phase)
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  // Check if active session is in RUBATA phase with a board
  const isRubataPhase = activeSession?.currentPhase === 'RUBATA'
  const hasRubataBoard = isRubataPhase && !!(activeSession?.rubataBoard)

  // Check if rubata order is set on the active session (admin has prepared rubata)
  const rubataOrderArray = activeSession?.rubataOrder as string[] | null
  const hasRubataOrder = !!(rubataOrderArray && rubataOrderArray.length > 0)

  // Find the most relevant session for preferences
  let preferenceSession = activeSession
  if (!preferenceSession) {
    preferenceSession = await prisma.marketSession.findFirst({
      where: { leagueId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // Get user's preferences
  let preferencesMap = new Map<string, {
    id: string
    playerId: string
    memberId: string
    maxBid: number | null
    priority: number | null
    notes: string | null
    isWatchlist: boolean
    isAutoPass: boolean
  }>()

  if (preferenceSession) {
    const preferences = await prisma.rubataPreference.findMany({
      where: {
        sessionId: preferenceSession.id,
        memberId: member.id,
      },
    })
    preferencesMap = new Map(preferences.map(p => [p.playerId, p]))
  }

  // Get all rosters with contract info
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: {
        select: { username: true },
      },
      roster: {
        where: { status: 'ACTIVE' },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              team: true,
              position: true,
              quotation: true,
              age: true,  // #190: include age for financial dashboard
              apiFootballId: true,
              apiFootballStats: true,
              seasonalStatsCache: true,  // Seasonality data for sparkbar
            },
          },
          contract: {
            select: {
              id: true,
              salary: true,
              duration: true,
              rescissionClause: true,
            },
          },
        },
      },
    },
  })

  // Build the players list with all info
  const players: Array<{
    rosterId: string
    memberId: string
    playerId: string
    playerName: string
    playerPosition: string
    playerTeam: string
    playerQuotation: number
    playerAge: number | null  // #190: player age
    playerApiFootballId: number | null
    playerApiFootballStats: unknown
    playerSeasonalStatsCache: unknown  // Seasonality data
    ownerUsername: string
    ownerTeamName: string | null
    ownerRubataOrder: number | null
    contractSalary: number
    contractDuration: number
    contractClause: number
    rubataPrice: number
    preference: typeof preferencesMap extends Map<string, infer V> ? V | null : never
  }> = []

  for (const memberData of allMembers) {
    for (const rosterEntry of memberData.roster) {
      if (!rosterEntry.contract) continue // Skip players without contract

      // Prezzo rubata = clausola rescissione + ingaggio (come nel rubata reale)
      const rubataPrice = (rosterEntry.contract.rescissionClause ?? 0) + rosterEntry.contract.salary

      players.push({
        rosterId: rosterEntry.id,
        memberId: memberData.id,
        playerId: rosterEntry.playerId,
        playerName: rosterEntry.player.name,
        playerPosition: rosterEntry.player.position,
        playerTeam: rosterEntry.player.team,
        playerQuotation: rosterEntry.player.quotation,
        playerAge: rosterEntry.player.age,  // #190: player age
        playerApiFootballId: rosterEntry.player.apiFootballId,
        playerApiFootballStats: rosterEntry.player.apiFootballStats,
        playerSeasonalStatsCache: rosterEntry.player.seasonalStatsCache,  // Seasonality data
        ownerUsername: memberData.user.username,
        ownerTeamName: memberData.teamName,
        ownerRubataOrder: memberData.rubataOrder,
        contractSalary: rosterEntry.contract.salary,
        contractDuration: rosterEntry.contract.duration,
        contractClause: rosterEntry.contract.rescissionClause ?? 0,
        rubataPrice,
        preference: preferencesMap.get(rosterEntry.playerId) || null,
      })
    }
  }

  // Sort by position order (P, D, C, A) then by name
  const positionOrder: Record<string, number> = { P: 1, D: 2, C: 3, A: 4 }
  players.sort((a, b) => {
    const posA = positionOrder[a.playerPosition] || 99
    const posB = positionOrder[b.playerPosition] || 99
    if (posA !== posB) return posA - posB
    return a.playerName.localeCompare(b.playerName)
  })

  return {
    success: true,
    data: {
      players,
      myMemberId: member.id,
      hasRubataBoard,
      hasRubataOrder,
      rubataState: activeSession?.rubataState || null,
      sessionId: preferenceSession?.id || null,
      totalPlayers: players.length,
    },
  }
}

/**
 * Get all svincolati (free agents) for year-round strategy planning.
 * These are SerieAPlayer records that are NOT in any active roster within the league.
 */
export async function getAllSvincolatiForStrategies(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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

  // Get all active members in the league
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    select: { id: true },
  })
  const memberIds = allMembers.map(m => m.id)

  // Get all playerIds that are in active rosters in this league
  const ownedPlayers = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: { in: memberIds },
      status: RosterStatus.ACTIVE,
    },
    select: { playerId: true },
  })
  const ownedPlayerIds = ownedPlayers.map(r => r.playerId)

  // Check if there's an active session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  // Find the most relevant session for preferences
  let preferenceSession = activeSession
  if (!preferenceSession) {
    preferenceSession = await prisma.marketSession.findFirst({
      where: { leagueId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // Get user's preferences
  let preferencesMap = new Map<string, {
    id: string
    playerId: string
    memberId: string
    maxBid: number | null
    priority: number | null
    notes: string | null
    isWatchlist: boolean
    isAutoPass: boolean
  }>()

  if (preferenceSession) {
    const preferences = await prisma.rubataPreference.findMany({
      where: {
        sessionId: preferenceSession.id,
        memberId: member.id,
      },
    })
    preferencesMap = new Map(preferences.map(p => [p.playerId, p]))
  }

  // Get all svincolati (players not in any roster)
  const svincolati = await prisma.serieAPlayer.findMany({
    where: {
      isActive: true,
      listStatus: 'IN_LIST',
      id: { notIn: ownedPlayerIds.length > 0 ? ownedPlayerIds : ['__none__'] },
    },
    select: {
      id: true,
      name: true,
      team: true,
      position: true,
      quotation: true,
      age: true,  // #190: include age
      apiFootballId: true,
      apiFootballStats: true,
      seasonalStatsCache: true,  // Seasonality data
    },
    orderBy: [
      { position: 'asc' },
      { name: 'asc' },
    ],
  })

  // Build the players list
  const players = svincolati.map(player => ({
    playerId: player.id,
    playerName: player.name,
    playerPosition: player.position,
    playerTeam: player.team,
    playerAge: player.age,  // #190: include age
    playerApiFootballId: player.apiFootballId,
    playerApiFootballStats: player.apiFootballStats,
    playerSeasonalStatsCache: player.seasonalStatsCache,  // Seasonality data
    preference: preferencesMap.get(player.id) || null,
  }))

  // Sort by position order (P, D, C, A) then by name
  const positionOrder: Record<string, number> = { P: 1, D: 2, C: 3, A: 4 }
  players.sort((a, b) => {
    const posA = positionOrder[a.playerPosition] || 99
    const posB = positionOrder[b.playerPosition] || 99
    if (posA !== posB) return posA - posB
    return a.playerName.localeCompare(b.playerName)
  })

  return {
    success: true,
    data: {
      players,
      myMemberId: member.id,
      sessionId: preferenceSession?.id || null,
      totalPlayers: players.length,
    },
  }
}

export async function getRubataPreviewBoard(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
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
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  const board = activeSession.rubataBoard as Array<{
    rosterId: string
    memberId: string
    playerId: string
    playerName: string
    playerPosition: Position
    playerTeam: string
    ownerUsername: string
    ownerTeamName: string | null
    rubataPrice: number
    contractSalary: number
    contractDuration: number
    contractClause: number
  }> | null

  if (!board) {
    return { success: false, message: 'Tabellone non ancora generato' }
  }

  // Get this member's preferences
  const preferences = await prisma.rubataPreference.findMany({
    where: {
      sessionId: activeSession.id,
      memberId: member.id,
    },
  })

  const preferencesMap = new Map(preferences.map(p => [p.playerId, p]))

  // Enrich board with preferences
  const enrichedBoard = board.map(player => ({
    ...player,
    preference: preferencesMap.get(player.playerId) || null,
  }))

  return {
    success: true,
    data: {
      board: enrichedBoard,
      totalPlayers: board.length,
      rubataState: activeSession.rubataState,
      isPreview: activeSession.rubataState === 'PREVIEW' || activeSession.rubataState === 'WAITING',
      myMemberId: member.id,
      watchlistCount: preferences.filter(p => p.isWatchlist).length,
      autoPassCount: preferences.filter(p => p.isAutoPass).length,
    },
  }
}

export async function setRubataToPreview(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'RUBATA',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione rubata attiva' }
  }

  if (!activeSession.rubataBoard) {
    return { success: false, message: 'Genera prima il tabellone rubata' }
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      rubataState: 'PREVIEW',
    },
  })

  return {
    success: true,
    message: 'Tabellone rubata in anteprima - i manager possono ora studiare le strategie',
  }
}
