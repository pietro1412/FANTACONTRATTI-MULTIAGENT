import type { Position, Prisma } from '@prisma/client';
import { PrismaClient, MemberStatus, AuctionStatus } from '@prisma/client'
import { recordMovement } from './movement.service'
import { calculateDefaultSalary, calculateRescissionClause } from './contract.service'
import { logAction } from './admin.service'
import type { ServiceResult } from '@/shared/types/service-result'

const prisma = new PrismaClient()

// ==================== HEARTBEAT / CONNECTION STATUS ====================

// In-memory storage for heartbeats (leagueId -> memberId -> timestamp)
const svincolatiHeartbeats = new Map<string, Map<string, number>>()

// Heartbeat timeout in milliseconds (45 seconds — 1.5× the 30s client interval)
const SVINCOLATI_HEARTBEAT_TIMEOUT = 45000

export function registerSvincolatiHeartbeat(leagueId: string, memberId: string): void {
  if (!svincolatiHeartbeats.has(leagueId)) {
    svincolatiHeartbeats.set(leagueId, new Map())
  }
  svincolatiHeartbeats.get(leagueId)!.set(memberId, Date.now())
}

export function getSvincolatiConnectionStatus(leagueId: string): Map<string, boolean> {
  const leagueHeartbeats = svincolatiHeartbeats.get(leagueId) || new Map()
  const now = Date.now()
  const status = new Map<string, boolean>()

  leagueHeartbeats.forEach((timestamp, memberId) => {
    status.set(memberId, now - timestamp < SVINCOLATI_HEARTBEAT_TIMEOUT)
  })

  return status
}

export function clearSvincolatiHeartbeats(leagueId: string): void {
  svincolatiHeartbeats.delete(leagueId)
}

// ==================== PHASE CHECK ====================

async function isInSvincolatiPhase(leagueId: string): Promise<boolean> {
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })
  return !!activeSession
}

// ==================== GET FREE AGENTS POOL ====================

interface FreeAgentFilters {
  position?: Position
  team?: string
  search?: string
  minQuotation?: number
  maxQuotation?: number
}

export async function getFreeAgents(
  leagueId: string,
  userId: string,
  filters?: FreeAgentFilters
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

  // Get all active players in rosters for this league
  const rostersInLeague = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId },
      status: 'ACTIVE',
    },
    select: { playerId: true },
  })

  const assignedPlayerIds = rostersInLeague.map(r => r.playerId)

  // Build filter conditions
  const whereConditions: Prisma.SerieAPlayerWhereInput = {
    id: { notIn: assignedPlayerIds },
    isActive: true,
    listStatus: 'IN_LIST', // Exclude players not in current list
  }

  if (filters?.position) {
    whereConditions.position = filters.position
  }

  if (filters?.team) {
    whereConditions.team = filters.team
  }

  if (filters?.search) {
    whereConditions.name = { contains: filters.search, mode: 'insensitive' }
  }

  if (filters?.minQuotation !== undefined || filters?.maxQuotation !== undefined) {
    whereConditions.quotation = {}
    if (filters?.minQuotation !== undefined) {
      whereConditions.quotation.gte = filters.minQuotation
    }
    if (filters?.maxQuotation !== undefined) {
      whereConditions.quotation.lte = filters.maxQuotation
    }
  }

  // Get free agents (players not in any roster in this league)
  const freeAgents = await prisma.serieAPlayer.findMany({
    where: whereConditions,
    orderBy: [{ position: 'asc' }, { quotation: 'desc' }, { name: 'asc' }],
  })

  return {
    success: true,
    data: freeAgents,
  }
}

// ==================== GET TEAMS LIST ====================

export async function getTeams(): Promise<ServiceResult> {
  const teams = await prisma.serieAPlayer.findMany({
    where: { isActive: true, listStatus: 'IN_LIST' },
    select: { team: true },
    distinct: ['team'],
    orderBy: { team: 'asc' },
  })

  return {
    success: true,
    data: teams.map(t => t.team),
  }
}

// ==================== START FREE AGENT AUCTION ====================

export async function startFreeAgentAuction(
  leagueId: string,
  playerId: string,
  adminUserId: string,
  _basePrice?: number // Not used - base price is always 1 per requirements
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

  // Check if in ASTA_SVINCOLATI phase
  const inSvincolatiPhase = await isInSvincolatiPhase(leagueId)
  if (!inSvincolatiPhase) {
    return { success: false, message: 'Puoi avviare aste per svincolati solo in fase ASTA_SVINCOLATI' }
  }

  // Get player
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Verify player is not in any roster
  const existingRoster = await prisma.playerRoster.findFirst({
    where: {
      playerId,
      leagueMember: { leagueId },
      status: 'ACTIVE',
    },
  })

  if (existingRoster) {
    return { success: false, message: 'Questo giocatore è già in una rosa' }
  }

  // Check no active auction
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione di mercato attiva' }
  }

  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'FREE_BID',
      status: { in: ['PENDING', 'ACTIVE'] },
    },
  })

  if (existingAuction) {
    return { success: false, message: 'C\'è già un\'asta in corso' }
  }

  // Base price = SEMPRE 1 (come da requisiti)
  const auctionBasePrice = 1

  // Get timer from session
  const timerSeconds = activeSession.auctionTimerSeconds
  const timerExpires = new Date(Date.now() + timerSeconds * 1000)

  // Create auction
  const auction = await prisma.auction.create({
    data: {
      leagueId,
      marketSessionId: activeSession.id,
      playerId,
      type: 'FREE_BID',
      basePrice: auctionBasePrice,
      currentPrice: auctionBasePrice,
      timerExpiresAt: timerExpires,
      timerSeconds,
      status: AuctionStatus.ACTIVE,
      startsAt: new Date(),
    },
    include: {
      player: true,
    },
  })

  return {
    success: true,
    message: `Asta per ${player.name} avviata a ${auctionBasePrice}`,
    data: {
      auction: {
        id: auction.id,
        player: auction.player,
        basePrice: auction.basePrice,
        currentPrice: auction.currentPrice,
      },
    },
  }
}

// ==================== BID ON FREE AGENT ====================

export async function bidOnFreeAgent(
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
      marketSession: true,
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.type !== 'FREE_BID') {
    return { success: false, message: 'Non è un\'asta per svincolati' }
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

  // Check if member has declared finished (can't bid anymore)
  if (auction.marketSession) {
    const finishedMembers = (auction.marketSession.svincolatiFinishedMembers as string[] | null) || []
    if (finishedMembers.includes(bidder.id)) {
      return { success: false, message: 'Hai dichiarato di aver finito questa fase. Non puoi più fare offerte.' }
    }
  }

  // Check bid amount
  if (amount <= auction.currentPrice) {
    return { success: false, message: `L'offerta deve essere maggiore di ${auction.currentPrice}` }
  }

  // Check budget using bilancio (budget - monteIngaggi), reserve 1 for minimum operations
  const monteIngaggiBid = await prisma.playerContract.aggregate({
    where: { leagueMemberId: bidder.id },
    _sum: { salary: true },
  })
  const bilancioBid = bidder.currentBudget - (monteIngaggiBid._sum.salary || 0)
  const maxBidSvinc = bilancioBid - 1
  if (amount + calculateDefaultSalary(amount) > maxBidSvinc) {
    return { success: false, message: `Budget insufficiente. Offerta massima: ${maxBidSvinc}` }
  }

  // Check if this is a turn-based svincolati auction (no slot limits)
  const isTurnBasedSvincolati = auction.marketSession?.currentPhase === 'ASTA_SVINCOLATI' &&
                                auction.marketSession?.svincolatiState === 'AUCTION'

  // Only check roster slot availability if NOT in turn-based svincolati phase
  if (!isTurnBasedSvincolati) {
    const position = auction.player.position
    const league = await prisma.league.findUnique({
      where: { id: auction.leagueId },
    })

    if (!league) {
      return { success: false, message: 'Lega non trovata' }
    }

    const currentRoster = await prisma.playerRoster.findMany({
      where: {
        leagueMemberId: bidder.id,
        status: 'ACTIVE',
      },
      include: { player: true },
    })

    const slotMap: Record<Position, number> = {
      P: league.goalkeeperSlots,
      D: league.defenderSlots,
      C: league.midfielderSlots,
      A: league.forwardSlots,
    }

    const currentCount = currentRoster.filter(r => r.player.position === position).length
    if (currentCount >= slotMap[position]) {
      return { success: false, message: `Slot ${position} pieni. Non puoi fare offerte per questo ruolo.` }
    }
  }

  // Get timer settings from session
  const timerSeconds = auction.marketSession?.svincolatiTimerSeconds ?? auction.marketSession?.auctionTimerSeconds ?? 30
  const newTimerExpires = new Date(Date.now() + timerSeconds * 1000)

  // Place bid and reset timer
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

    // Update auction current price and RESET TIMER
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        currentPrice: amount,
        timerExpiresAt: newTimerExpires,
        timerSeconds,
      },
    })
  })

  return {
    success: true,
    message: `Offerta di ${amount} registrata`,
    data: {
      currentPrice: amount,
      timerExpiresAt: newTimerExpires,
      timerSeconds,
    },
  }
}

// ==================== CLOSE FREE AGENT AUCTION ====================

export async function closeFreeAgentAuction(
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
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.type !== 'FREE_BID') {
    return { success: false, message: 'Non è un\'asta per svincolati' }
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
    // No bids - auction ends with no winner
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.NO_BIDS,
        endsAt: new Date(),
      },
    })

    return {
      success: true,
      message: 'Nessuna offerta. Il giocatore rimane svincolato.',
      data: { noBids: true },
    }
  }

  // Assign player to winner
  await prisma.$transaction(async (tx) => {
    // Deduct budget from winner
    await tx.leagueMember.update({
      where: { id: winningBid.bidderId },
      data: { currentBudget: { decrement: auction.currentPrice } },
    })

    // Create roster entry
    const rosterEntry = await tx.playerRoster.create({
      data: {
        leagueMemberId: winningBid.bidderId,
        playerId: auction.playerId,
        acquisitionPrice: auction.currentPrice,
        acquisitionType: 'SVINCOLATI',
        status: 'ACTIVE',
      },
    })

    // Create contract automatically: 10% salary (integer, min 1), 3 semesters (svincolati default)
    const salary = calculateDefaultSalary(auction.currentPrice)
    const duration = 3
    const rescissionClause = calculateRescissionClause(salary, duration)

    await tx.playerContract.create({
      data: {
        rosterId: rosterEntry.id,
        leagueMemberId: winningBid.bidderId,
        salary,
        duration,
        initialSalary: salary,
        initialDuration: duration,
        rescissionClause,
      },
    })

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

  // Record movement with contract values
  const movementSalary = calculateDefaultSalary(auction.currentPrice)
  const movementDuration = 3
  const movementClause = calculateRescissionClause(movementSalary, movementDuration)

  await recordMovement({
    leagueId: auction.leagueId,
    playerId: auction.playerId,
    movementType: 'SVINCOLATI',
    toMemberId: winningBid.bidderId,
    price: auction.currentPrice,
    auctionId,
    marketSessionId: auction.marketSessionId ?? undefined,
    newSalary: movementSalary,
    newDuration: movementDuration,
    newClause: movementClause,
  })

  return {
    success: true,
    message: `${auction.player.name} assegnato a ${winningBid.bidder.user.username} per ${auction.currentPrice}`,
    data: {
      player: auction.player,
      winnerId: winningBid.bidderId,
      winnerUsername: winningBid.bidder.user.username,
      finalPrice: auction.currentPrice,
    },
  }
}

// ==================== GET CURRENT FREE AGENT AUCTION ====================

export async function getCurrentFreeAgentAuction(
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  const activeAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'FREE_BID',
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
      isSvincolatiPhase: activeSession.currentPhase === 'ASTA_SVINCOLATI',
      currentPhase: activeSession.currentPhase,
      activeAuction: activeAuction
        ? {
            id: activeAuction.id,
            player: activeAuction.player,
            basePrice: activeAuction.basePrice,
            currentPrice: activeAuction.currentPrice,
            bids: activeAuction.bids.map(b => ({
              amount: b.amount,
              bidder: b.bidder.user.username,
              isWinning: b.isWinning,
            })),
          }
        : null,
      myBudget: member.currentBudget,
    },
  }
}

// ==================== GET FREE AGENTS AUCTION HISTORY ====================

export async function getFreeAgentsHistory(
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

  const completedAuctions = await prisma.auction.findMany({
    where: {
      leagueId,
      type: 'FREE_BID',
      status: AuctionStatus.COMPLETED,
    },
    include: {
      player: true,
      winner: {
        include: { user: { select: { username: true } } },
      },
    },
    orderBy: { endsAt: 'desc' },
    take: 50,
  })

  return {
    success: true,
    data: completedAuctions.map(a => ({
      id: a.id,
      player: a.player,
      winner: a.winner?.user.username,
      finalPrice: a.currentPrice,
      closedAt: a.endsAt,
    })),
  }
}

// ===========================================================================
// ==================== NUOVA LOGICA A TURNI SVINCOLATI ======================
// ===========================================================================

// ==================== SET TURN ORDER ====================

export async function setSvincolatiTurnOrder(
  leagueId: string,
  adminUserId: string,
  memberIds: string[]
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

  // Verify phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione svincolati attiva' }
  }

  // M-4: If no explicit order provided, auto-reverse rubata order
  let finalMemberIds = memberIds
  if (!memberIds || memberIds.length === 0) {
    const rubataOrder = activeSession.rubataOrder as string[] | null
    if (rubataOrder && rubataOrder.length > 0) {
      finalMemberIds = [...rubataOrder].reverse()
    } else {
      // Fallback: use all active members in default order
      const allMembers = await prisma.leagueMember.findMany({
        where: { leagueId, status: MemberStatus.ACTIVE, role: 'MANAGER' },
        orderBy: { joinedAt: 'asc' },
      })
      finalMemberIds = allMembers.map(m => m.id)
    }
  }

  // Verify all memberIds are valid active members
  const validMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      id: { in: finalMemberIds },
      status: MemberStatus.ACTIVE,
    },
  })

  if (validMembers.length !== finalMemberIds.length) {
    return { success: false, message: 'Alcuni membri non sono validi' }
  }

  // Update session with turn order
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiTurnOrder: finalMemberIds,
      svincolatiCurrentTurnIndex: 0,
      svincolatiState: 'READY_CHECK',
      svincolatiReadyMembers: [],
      svincolatiPassedMembers: [],
      svincolatiPendingPlayerId: null,
      svincolatiPendingNominatorId: null,
      svincolatiNominatorConfirmed: false,
      svincolatiPendingAck: null,
    },
  })

  return {
    success: true,
    message: 'Ordine turni impostato',
    data: { turnOrder: finalMemberIds, autoReversed: memberIds.length === 0 },
  }
}

// ==================== GET SVINCOLATI BOARD STATE ====================

export async function getSvincolatiBoard(
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
    include: { user: { select: { username: true } } },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return {
      success: true,
      data: {
        isActive: false,
        currentPhase: null,
        state: 'SETUP',
        isAdmin: member.role === 'ADMIN',
        myMemberId: member.id,
        myBudget: member.currentBudget,
        turnOrder: [],
        readyMembers: [],
        passedMembers: [],
        finishedMembers: [],
        isFinished: false,
      },
    }
  }

  // Get turn order members with usernames
  const turnOrder = (activeSession.svincolatiTurnOrder as string[] | null) || []
  const turnOrderMembers = await prisma.leagueMember.findMany({
    where: { id: { in: turnOrder } },
    include: { user: { select: { username: true } } },
  })

  // Sort by turn order
  const orderedMembers = turnOrder.map(id => turnOrderMembers.find(m => m.id === id)).filter(Boolean)

  // Get pending player if any
  let pendingPlayer = null
  if (activeSession.svincolatiPendingPlayerId) {
    pendingPlayer = await prisma.serieAPlayer.findUnique({
      where: { id: activeSession.svincolatiPendingPlayerId },
    })
  }

  // Get active auction (in AUCTION or AWAITING_RESUME state)
  let activeAuction = null
  let awaitingResumeAuctionId: string | null = null
  if (activeSession.svincolatiState === 'AUCTION' || activeSession.svincolatiState === 'AWAITING_RESUME') {
    const auctionStatus = activeSession.svincolatiState === 'AWAITING_RESUME' ? 'AWAITING_RESUME' : 'ACTIVE'
    const auction = await prisma.auction.findFirst({
      where: {
        marketSessionId: activeSession.id,
        type: 'FREE_BID',
        status: auctionStatus,
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
    if (auction) {
      // Se siamo in AWAITING_RESUME, salva l'ID per il frontend
      if (activeSession.svincolatiState === 'AWAITING_RESUME') {
        awaitingResumeAuctionId = auction.id
      }
      activeAuction = {
        id: auction.id,
        player: auction.player,
        basePrice: auction.basePrice,
        currentPrice: auction.currentPrice,
        timerExpiresAt: auction.timerExpiresAt,
        timerSeconds: auction.timerSeconds,
        nominatorId: auction.nominatorId,
        bids: auction.bids.map(b => ({
          amount: b.amount,
          bidder: b.bidder.user.username,
          bidderId: b.bidderId,
          isWinning: b.isWinning,
        })),
      }
    }
  }

  // Get current turn member
  const currentTurnIndex = activeSession.svincolatiCurrentTurnIndex ?? 0
  const currentTurnMemberId = turnOrder[currentTurnIndex] || null
  const currentTurnMember = orderedMembers.find(m => m?.id === currentTurnMemberId)

  // Get nominator username if pending
  let nominatorUsername = null
  if (activeSession.svincolatiPendingNominatorId) {
    const nominator = turnOrderMembers.find(m => m.id === activeSession.svincolatiPendingNominatorId)
    nominatorUsername = nominator?.user.username || null
  }

  // Parse pending ack
  const pendingAck = activeSession.svincolatiPendingAck as {
    auctionId: string
    playerId: string
    playerName: string
    winnerId: string | null
    winnerUsername: string | null
    price: number
    noBids: boolean
    acknowledgedMembers: string[]
    pendingMembers: string[]
  } | null

  // Get connection status for all managers
  const connectionStatus = getSvincolatiConnectionStatus(leagueId)

  return {
    success: true,
    data: {
      sessionId: activeSession.id,
      isActive: true,
      state: activeSession.svincolatiState || 'SETUP',
      turnOrder: orderedMembers.map(m => ({
        id: m!.id,
        username: m!.user.username,
        budget: m!.currentBudget,
        hasPassed: ((activeSession.svincolatiPassedMembers as string[] | null) || []).includes(m!.id),
        isConnected: connectionStatus.get(m!.id) ?? false,
      })),
      currentTurnIndex,
      currentTurnMemberId,
      currentTurnUsername: currentTurnMember?.user.username || null,
      myMemberId: member.id,
      isMyTurn: currentTurnMemberId === member.id,
      isAdmin: member.role === 'ADMIN',
      readyMembers: (activeSession.svincolatiReadyMembers as string[] | null) || [],
      passedMembers: (activeSession.svincolatiPassedMembers as string[] | null) || [],
      finishedMembers: (activeSession.svincolatiFinishedMembers as string[] | null) || [],
      isFinished: ((activeSession.svincolatiFinishedMembers as string[] | null) || []).includes(member.id),
      pendingPlayer,
      pendingNominatorId: activeSession.svincolatiPendingNominatorId,
      nominatorUsername,
      nominatorConfirmed: activeSession.svincolatiNominatorConfirmed,
      activeAuction,
      awaitingResumeAuctionId,
      timerSeconds: activeSession.svincolatiTimerSeconds,
      timerStartedAt: activeSession.svincolatiTimerStartedAt,
      pendingAck,
      myBudget: member.currentBudget,
    },
  }
}

// ==================== NOMINATE FREE AGENT (BY MANAGER) ====================

export async function nominateFreeAgent(
  leagueId: string,
  userId: string,
  playerId: string
): Promise<ServiceResult> {
  // Get member
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

  // Get session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione svincolati attiva' }
  }

  // Check state
  if (activeSession.svincolatiState !== 'READY_CHECK' && activeSession.svincolatiState !== 'NOMINATION') {
    return { success: false, message: 'Non è il momento di nominare' }
  }

  // Check it's this member's turn
  const turnOrder = (activeSession.svincolatiTurnOrder as string[] | null) || []
  const currentTurnIndex = activeSession.svincolatiCurrentTurnIndex ?? 0
  const currentTurnMemberId = turnOrder[currentTurnIndex]

  if (currentTurnMemberId !== member.id) {
    return { success: false, message: 'Non è il tuo turno' }
  }

  // Verify player is free agent
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  const existingRoster = await prisma.playerRoster.findFirst({
    where: {
      playerId,
      leagueMember: { leagueId },
      status: 'ACTIVE',
    },
  })

  if (existingRoster) {
    return { success: false, message: 'Questo giocatore è già in una rosa' }
  }

  // Check bilancio (budget - monteIngaggi) >= 2 (offerta minima 1 + ingaggio minimo 1)
  const monteIngaggiNom = await prisma.playerContract.aggregate({
    where: { leagueMemberId: member.id },
    _sum: { salary: true },
  })
  const bilancio = member.currentBudget - (monteIngaggiNom._sum.salary || 0)
  if (bilancio < 2) {
    return { success: false, message: `Budget insufficiente. Bilancio disponibile: ${bilancio} (servono almeno 2)` }
  }

  // Set pending nomination
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiState: 'NOMINATION',
      svincolatiPendingPlayerId: playerId,
      svincolatiPendingNominatorId: member.id,
      svincolatiNominatorConfirmed: false,
      svincolatiReadyMembers: [],
    },
  })

  return {
    success: true,
    message: `${player.name} nominato. Conferma la tua scelta.`,
    data: { player },
  }
}

// ==================== CONFIRM NOMINATION ====================

export async function confirmSvincolatiNomination(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  // Verify nominator
  if (activeSession.svincolatiPendingNominatorId !== member.id) {
    return { success: false, message: 'Non sei il nominatore' }
  }

  if (activeSession.svincolatiNominatorConfirmed) {
    return { success: false, message: 'Già confermato' }
  }

  // Confirm and add nominator to ready
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiNominatorConfirmed: true,
      svincolatiReadyMembers: [member.id],
    },
  })

  // In IN_PRESENCE mode, auto-start auction (skip ready-check)
  if (activeSession.auctionMode === 'IN_PRESENCE') {
    const turnOrder = (activeSession.svincolatiTurnOrder as string[] | null) || []
    return await startSvincolatiAuction(activeSession.id, turnOrder)
  }

  return {
    success: true,
    message: 'Nominazione confermata. Attendi che gli altri siano pronti.',
  }
}

// ==================== CANCEL NOMINATION ====================

export async function cancelSvincolatiNomination(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  // Verify nominator (or admin)
  const isNominator = activeSession.svincolatiPendingNominatorId === member.id
  const isAdmin = member.role === 'ADMIN'

  if (!isNominator && !isAdmin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (activeSession.svincolatiNominatorConfirmed && !isAdmin) {
    return { success: false, message: 'Nominazione già confermata' }
  }

  // Reset to ready check
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiState: 'READY_CHECK',
      svincolatiPendingPlayerId: null,
      svincolatiPendingNominatorId: null,
      svincolatiNominatorConfirmed: false,
      svincolatiReadyMembers: [],
    },
  })

  return {
    success: true,
    message: 'Nominazione annullata',
  }
}

// ==================== MARK READY ====================

export async function markReadyForSvincolati(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  if (activeSession.svincolatiState !== 'NOMINATION') {
    return { success: false, message: 'Non è il momento di dichiararsi pronti' }
  }

  if (!activeSession.svincolatiNominatorConfirmed) {
    return { success: false, message: 'Il nominatore non ha ancora confermato' }
  }

  const readyMembers = (activeSession.svincolatiReadyMembers as string[] | null) || []
  if (readyMembers.includes(member.id)) {
    return { success: false, message: 'Sei già pronto' }
  }

  // Check if all members are ready
  const turnOrder = (activeSession.svincolatiTurnOrder as string[] | null) || []

  // In IN_PRESENCE mode, auto-mark all members as ready (skip ready-check)
  const newReadyMembers = activeSession.auctionMode === 'IN_PRESENCE'
    ? [...turnOrder]
    : [...readyMembers, member.id]

  const allReady = turnOrder.every(id => newReadyMembers.includes(id))

  if (allReady) {
    // Start auction
    return await startSvincolatiAuction(activeSession.id, newReadyMembers)
  }

  // Update ready members
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: { svincolatiReadyMembers: newReadyMembers },
  })

  return {
    success: true,
    message: 'Pronto!',
    data: { readyCount: newReadyMembers.length, totalCount: turnOrder.length },
  }
}

// ==================== START SVINCOLATI AUCTION (INTERNAL) ====================

async function startSvincolatiAuction(
  sessionId: string,
  readyMembers: string[]
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session || !session.svincolatiPendingPlayerId || !session.svincolatiPendingNominatorId) {
    return { success: false, message: 'Dati nomination non validi' }
  }

  const player = await prisma.serieAPlayer.findUnique({
    where: { id: session.svincolatiPendingPlayerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Get nominator info for the initial bid
  const nominator = await prisma.leagueMember.findUnique({
    where: { id: session.svincolatiPendingNominatorId },
  })

  if (!nominator) {
    return { success: false, message: 'Nominatore non trovato' }
  }

  const timerSeconds = session.svincolatiTimerSeconds
  const timerExpires = new Date(Date.now() + timerSeconds * 1000)

  // Create auction with initial bid from nominator
  const auction = await prisma.$transaction(async (tx) => {
    // Create the auction
    const newAuction = await tx.auction.create({
      data: {
        leagueId: session.leagueId,
        marketSessionId: session.id,
        playerId: player.id,
        type: 'FREE_BID',
        basePrice: 1,
        currentPrice: 1,
        nominatorId: session.svincolatiPendingNominatorId,
        timerExpiresAt: timerExpires,
        timerSeconds,
        status: AuctionStatus.ACTIVE,
        startsAt: new Date(),
      },
    })

    // Create initial bid from nominator (automatic bid of 1)
    await tx.auctionBid.create({
      data: {
        auctionId: newAuction.id,
        bidderId: nominator.id,
        userId: nominator.userId,
        amount: 1,
        isWinning: true,
      },
    })

    return newAuction
  })

  // Update session state
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      svincolatiState: 'AUCTION',
      svincolatiTimerStartedAt: new Date(),
      svincolatiReadyMembers: readyMembers,
    },
  })

  return {
    success: true,
    message: `Asta per ${player.name} iniziata!`,
    data: { auctionId: auction.id, player },
  }
}

// ==================== PASS TURN ====================

export async function passSvincolatiTurn(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  if (activeSession.svincolatiState !== 'READY_CHECK') {
    return { success: false, message: 'Non puoi passare in questo momento' }
  }

  // Check it's this member's turn
  const turnOrder = (activeSession.svincolatiTurnOrder as string[] | null) || []
  const currentTurnIndex = activeSession.svincolatiCurrentTurnIndex ?? 0
  const currentTurnMemberId = turnOrder[currentTurnIndex]

  if (currentTurnMemberId !== member.id) {
    return { success: false, message: 'Non è il tuo turno' }
  }

  // Add to passed members
  const passedMembers = (activeSession.svincolatiPassedMembers as string[] | null) || []
  const finishedMembers = (activeSession.svincolatiFinishedMembers as string[] | null) || []
  const newPassedMembers = passedMembers.includes(member.id)
    ? passedMembers
    : [...passedMembers, member.id]

  // Check if all active members have passed (exclude finished members)
  const activeMembersAfterPass = turnOrder.filter(id => !newPassedMembers.includes(id) && !finishedMembers.includes(id))
  if (activeMembersAfterPass.length === 0) {
    // All passed or finished - complete svincolati phase
    await prisma.marketSession.update({
      where: { id: activeSession.id },
      data: {
        svincolatiState: 'COMPLETED',
        svincolatiPassedMembers: newPassedMembers,
      },
    })

    return {
      success: true,
      message: 'Tutti i manager hanno passato. Fase svincolati completata!',
      data: { completed: true },
    }
  }

  // Advance to next turn
  const nextTurnIndex = (currentTurnIndex + 1) % turnOrder.length

  // Skip members who have already passed or declared finished
  let searchIndex = nextTurnIndex
  let searchCount = 0
  while ((newPassedMembers.includes(turnOrder[searchIndex]) || finishedMembers.includes(turnOrder[searchIndex])) && searchCount < turnOrder.length) {
    searchIndex = (searchIndex + 1) % turnOrder.length
    searchCount++
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiCurrentTurnIndex: searchIndex,
      svincolatiPassedMembers: newPassedMembers,
    },
  })

  const nextMember = await prisma.leagueMember.findUnique({
    where: { id: turnOrder[searchIndex] },
    include: { user: { select: { username: true } } },
  })

  return {
    success: true,
    message: `Hai passato. Turno di ${nextMember?.user.username || 'prossimo'}`,
    data: {
      nextTurnMemberId: turnOrder[searchIndex],
      nextTurnUsername: nextMember?.user.username,
      passedCount: newPassedMembers.length,
    },
  }
}

// ==================== FORCE ALL READY (ADMIN) ====================

export async function forceAllReadyForSvincolati(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  if (activeSession.svincolatiState !== 'NOMINATION') {
    return { success: false, message: 'Non è il momento di forzare ready' }
  }

  if (!activeSession.svincolatiNominatorConfirmed) {
    return { success: false, message: 'Il nominatore non ha ancora confermato' }
  }

  const turnOrder = (activeSession.svincolatiTurnOrder as string[] | null) || []

  // Start auction with all members ready
  return await startSvincolatiAuction(activeSession.id, turnOrder)
}

// ==================== CLOSE SVINCOLATI AUCTION ====================

export async function closeSvincolatiAuction(
  auctionId: string,
  adminUserId?: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      bids: {
        where: { isWinning: true, isCancelled: false },
        include: {
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
      marketSession: true,
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  // Verify admin if userId provided
  if (adminUserId) {
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
  }

  const winningBid = auction.bids[0]
  const turnOrder = (auction.marketSession?.svincolatiTurnOrder as string[] | null) || []

  if (!winningBid) {
    // No bids - player stays free
    await prisma.$transaction(async (tx) => {
      await tx.auction.update({
        where: { id: auctionId },
        data: {
          status: AuctionStatus.NO_BIDS,
          endsAt: new Date(),
        },
      })

      // Set pending ack
      await tx.marketSession.update({
        where: { id: auction.marketSessionId! },
        data: {
          svincolatiState: 'PENDING_ACK',
          svincolatiPendingAck: {
            auctionId,
            playerId: auction.playerId,
            playerName: auction.player.name,
            winnerId: null,
            winnerUsername: null,
            price: 0,
            noBids: true,
            acknowledgedMembers: [],
            pendingMembers: turnOrder,
          },
        },
      })
    })

    return {
      success: true,
      message: `Nessuna offerta per ${auction.player.name}. Il giocatore rimane svincolato.`,
      data: { noBids: true },
    }
  }

  // Assign player to winner
  await prisma.$transaction(async (tx) => {
    // Deduct budget from winner
    await tx.leagueMember.update({
      where: { id: winningBid.bidderId },
      data: { currentBudget: { decrement: auction.currentPrice } },
    })

    // Create roster entry
    const rosterEntry = await tx.playerRoster.create({
      data: {
        leagueMemberId: winningBid.bidderId,
        playerId: auction.playerId,
        acquisitionPrice: auction.currentPrice,
        acquisitionType: 'SVINCOLATI',
        status: 'ACTIVE',
      },
    })

    // Create contract automatically: 10% salary (integer, min 1), 3 semesters (svincolati default)
    const salary = calculateDefaultSalary(auction.currentPrice)
    const duration = 3
    const rescissionClause = calculateRescissionClause(salary, duration)

    await tx.playerContract.create({
      data: {
        rosterId: rosterEntry.id,
        leagueMemberId: winningBid.bidderId,
        salary,
        duration,
        initialSalary: salary,
        initialDuration: duration,
        rescissionClause,
      },
    })

    // Complete auction
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.COMPLETED,
        winnerId: winningBid.bidderId,
        endsAt: new Date(),
      },
    })

    // Set pending ack
    await tx.marketSession.update({
      where: { id: auction.marketSessionId! },
      data: {
        svincolatiState: 'PENDING_ACK',
        svincolatiPendingAck: {
          auctionId,
          playerId: auction.playerId,
          playerName: auction.player.name,
          winnerId: winningBid.bidderId,
          winnerUsername: winningBid.bidder.user.username,
          price: auction.currentPrice,
          noBids: false,
          acknowledgedMembers: [],
          pendingMembers: turnOrder,
        },
      },
    })
  })

  // Record movement with contract values
  const movementSalary2 = calculateDefaultSalary(auction.currentPrice)
  const movementDuration2 = 3
  const movementClause2 = calculateRescissionClause(movementSalary2, movementDuration2)

  await recordMovement({
    leagueId: auction.leagueId,
    playerId: auction.playerId,
    movementType: 'SVINCOLATI',
    toMemberId: winningBid.bidderId,
    price: auction.currentPrice,
    auctionId,
    marketSessionId: auction.marketSessionId ?? undefined,
    newSalary: movementSalary2,
    newDuration: movementDuration2,
    newClause: movementClause2,
  })

  return {
    success: true,
    message: `${auction.player.name} assegnato a ${winningBid.bidder.user.username} per ${auction.currentPrice}`,
    data: {
      player: auction.player,
      winnerId: winningBid.bidderId,
      winnerUsername: winningBid.bidder.user.username,
      finalPrice: auction.currentPrice,
    },
  }
}

// ==================== ACKNOWLEDGE SVINCOLATI AUCTION ====================

export async function acknowledgeSvincolatiAuction(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  if (activeSession.svincolatiState !== 'PENDING_ACK') {
    return { success: false, message: 'Non ci sono aste da confermare' }
  }

  const pendingAck = activeSession.svincolatiPendingAck as {
    auctionId: string
    playerId: string
    playerName: string
    winnerId: string | null
    winnerUsername: string | null
    price: number
    noBids: boolean
    acknowledgedMembers: string[]
    pendingMembers: string[]
  }

  if (!pendingAck) {
    return { success: false, message: 'Nessun ack pendente' }
  }

  if (pendingAck.acknowledgedMembers.includes(member.id)) {
    return { success: false, message: 'Hai già confermato' }
  }

  const newAcknowledged = [...pendingAck.acknowledgedMembers, member.id]
  const newPending = pendingAck.pendingMembers.filter(id => id !== member.id)

  // Get contract info for winner (for post-acquisition modification)
  let winnerContractInfo = null
  if (pendingAck.winnerId === member.id && !pendingAck.noBids) {
    const roster = await prisma.playerRoster.findFirst({
      where: {
        leagueMemberId: member.id,
        playerId: pendingAck.playerId,
        status: RosterStatus.ACTIVE,
      },
      include: { contract: true, player: true },
    })
    if (roster?.contract) {
      winnerContractInfo = {
        contractId: roster.contract.id,
        rosterId: roster.id,
        playerId: pendingAck.playerId,
        playerName: pendingAck.playerName,
        playerTeam: roster.player.team,
        playerPosition: roster.player.position,
        salary: roster.contract.salary,
        duration: roster.contract.duration,
        initialSalary: roster.contract.initialSalary,
        rescissionClause: roster.contract.rescissionClause,
      }
    }
  }

  // Check if all acknowledged
  if (newPending.length === 0) {
    // All acknowledged - advance to next turn
    const result = await advanceSvincolatiToNextTurn(activeSession.id)
    // Include winner contract info in the result
    return {
      ...result,
      data: {
        ...(result.data as object || {}),
        winnerContractInfo,
      },
    }
  }

  // Update pending ack
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiPendingAck: {
        ...pendingAck,
        acknowledgedMembers: newAcknowledged,
        pendingMembers: newPending,
      },
    },
  })

  return {
    success: true,
    message: 'Conferma registrata',
    data: {
      acknowledgedCount: newAcknowledged.length,
      pendingCount: newPending.length,
      winnerContractInfo, // For contract modification modal
    },
  }
}

// ==================== FORCE ALL ACK (ADMIN) ====================

export async function forceAllSvincolatiAck(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  if (activeSession.svincolatiState !== 'PENDING_ACK') {
    return { success: false, message: 'Non ci sono aste da confermare' }
  }

  // Advance to next turn
  return await advanceSvincolatiToNextTurn(activeSession.id)
}

// ==================== ADVANCE TO NEXT TURN (INTERNAL) ====================

async function advanceSvincolatiToNextTurn(sessionId: string): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // M-6: Check if there are free agents available
  const rostersInLeague = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId: session.leagueId },
      status: 'ACTIVE',
    },
    select: { playerId: true },
  })
  const assignedPlayerIds = rostersInLeague.map(r => r.playerId)
  const freeAgentCount = await prisma.serieAPlayer.count({
    where: {
      id: { notIn: assignedPlayerIds },
      isActive: true,
      listStatus: 'IN_LIST',
    },
  })
  if (freeAgentCount === 0) {
    await prisma.marketSession.update({
      where: { id: sessionId },
      data: {
        svincolatiState: 'COMPLETED',
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        svincolatiReadyMembers: [],
      },
    })
    return {
      success: true,
      message: 'Nessun giocatore svincolato disponibile. Fase completata!',
      data: { completed: true, reason: 'no_free_agents' },
    }
  }

  // M-5: Check if any member has bilancio >= 2
  const allActiveMembers = await prisma.leagueMember.findMany({
    where: { leagueId: session.leagueId, status: MemberStatus.ACTIVE },
  })
  let anyoneCanBuy = false
  for (const m of allActiveMembers) {
    const monteIngaggi = await prisma.playerContract.aggregate({
      where: { leagueMemberId: m.id },
      _sum: { salary: true },
    })
    const bilancio = m.currentBudget - (monteIngaggi._sum.salary || 0)
    if (bilancio >= 2) {
      anyoneCanBuy = true
      break
    }
  }
  if (!anyoneCanBuy) {
    await prisma.marketSession.update({
      where: { id: sessionId },
      data: {
        svincolatiState: 'COMPLETED',
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        svincolatiReadyMembers: [],
      },
    })
    return {
      success: true,
      message: 'Nessun manager ha bilancio sufficiente (>= 2). Fase completata!',
      data: { completed: true, reason: 'no_budget' },
    }
  }

  const turnOrder = (session.svincolatiTurnOrder as string[] | null) || []
  const passedMembers = (session.svincolatiPassedMembers as string[] | null) || []
  const finishedMembers = (session.svincolatiFinishedMembers as string[] | null) || []
  const currentTurnIndex = session.svincolatiCurrentTurnIndex ?? 0

  // Reset the pass state for the member who just called (they didn't pass)
  const previousNominatorId = session.svincolatiPendingNominatorId
  const newPassedMembers = previousNominatorId
    ? passedMembers.filter(id => id !== previousNominatorId)
    : passedMembers

  // M-5 (turn-level): Also skip members with bilancio < 2
  const insufficientBudgetMembers: string[] = []
  for (const memberId of turnOrder) {
    if (newPassedMembers.includes(memberId) || finishedMembers.includes(memberId)) continue
    const memberData = allActiveMembers.find(m => m.id === memberId)
    if (!memberData) continue
    const monteIngaggi = await prisma.playerContract.aggregate({
      where: { leagueMemberId: memberId },
      _sum: { salary: true },
    })
    const bilancio = memberData.currentBudget - (monteIngaggi._sum.salary || 0)
    if (bilancio < 2) {
      insufficientBudgetMembers.push(memberId)
    }
  }

  // Find next member who hasn't passed, hasn't declared finished, AND has bilancio >= 2
  let nextIndex = (currentTurnIndex + 1) % turnOrder.length
  let searchCount = 0
  while (
    (newPassedMembers.includes(turnOrder[nextIndex]) ||
     finishedMembers.includes(turnOrder[nextIndex]) ||
     insufficientBudgetMembers.includes(turnOrder[nextIndex])) &&
    searchCount < turnOrder.length
  ) {
    nextIndex = (nextIndex + 1) % turnOrder.length
    searchCount++
  }

  // Check if all remaining members have passed, finished, or have insufficient budget
  const activeMembers = turnOrder.filter(
    id => !newPassedMembers.includes(id) &&
          !finishedMembers.includes(id) &&
          !insufficientBudgetMembers.includes(id)
  )
  if (activeMembers.length === 0) {
    // All passed - complete phase
    await prisma.marketSession.update({
      where: { id: sessionId },
      data: {
        svincolatiState: 'COMPLETED',
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        svincolatiReadyMembers: [],
      },
    })

    return {
      success: true,
      message: 'Tutti i manager hanno passato. Fase svincolati completata!',
      data: { completed: true },
    }
  }

  // Update to next turn
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      svincolatiState: 'READY_CHECK',
      svincolatiCurrentTurnIndex: nextIndex,
      svincolatiPendingPlayerId: null,
      svincolatiPendingNominatorId: null,
      svincolatiNominatorConfirmed: false,
      svincolatiPendingAck: null,
      svincolatiReadyMembers: [],
      svincolatiPassedMembers: newPassedMembers,
    },
  })

  const nextMember = await prisma.leagueMember.findUnique({
    where: { id: turnOrder[nextIndex] },
    include: { user: { select: { username: true } } },
  })

  return {
    success: true,
    message: `Turno di ${nextMember?.user.username || 'prossimo manager'}`,
    data: {
      nextTurnMemberId: turnOrder[nextIndex],
      nextTurnUsername: nextMember?.user.username,
    },
  }
}

// ==================== SET SVINCOLATI TIMER (ADMIN) ====================

export async function setSvincolatiTimer(
  leagueId: string,
  adminUserId: string,
  timerSeconds: number
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  if (timerSeconds < 10 || timerSeconds > 300) {
    return { success: false, message: 'Timer deve essere tra 10 e 300 secondi' }
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: { svincolatiTimerSeconds: timerSeconds },
  })

  return {
    success: true,
    message: `Timer impostato a ${timerSeconds} secondi`,
  }
}

// ==================== COMPLETE SVINCOLATI PHASE (ADMIN) ====================

export async function completeSvincolatiPhase(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiState: 'COMPLETED',
    },
  })

  return {
    success: true,
    message: 'Fase svincolati completata',
  }
}

// ==================== BOT NOMINATE (ADMIN SIMULATION) ====================

export async function botNominateSvincolati(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  if (activeSession.svincolatiState !== 'READY_CHECK') {
    return { success: false, message: `Non è il momento di nominare (stato: ${activeSession.svincolatiState ?? 'N/A'})` }
  }

  // Get current turn member
  const turnOrder = (activeSession.svincolatiTurnOrder as string[] | null) || []
  const currentTurnIndex = activeSession.svincolatiCurrentTurnIndex ?? 0
  const currentTurnMemberId = turnOrder[currentTurnIndex]

  if (!currentTurnMemberId) {
    return { success: false, message: 'Nessun manager di turno' }
  }

  const currentMember = await prisma.leagueMember.findUnique({
    where: { id: currentTurnMemberId },
    include: { user: { select: { username: true } } },
  })

  if (!currentMember) {
    return { success: false, message: 'Manager di turno non trovato' }
  }

  // Get all players in rosters for this league
  const rostersInLeague = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId },
      status: 'ACTIVE',
    },
    select: { playerId: true },
  })

  const assignedPlayerIds = rostersInLeague.map(r => r.playerId)

  // Get a random free agent
  const freeAgents = await prisma.serieAPlayer.findMany({
    where: {
      id: { notIn: assignedPlayerIds },
      isActive: true,
      listStatus: 'IN_LIST',
    },
    take: 50,
  })

  if (freeAgents.length === 0) {
    return { success: false, message: 'Nessun giocatore svincolato disponibile' }
  }

  // Pick a random player
  const randomPlayer = freeAgents[Math.floor(Math.random() * freeAgents.length)]

  // Set pending nomination
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiState: 'NOMINATION',
      svincolatiPendingPlayerId: randomPlayer.id,
      svincolatiPendingNominatorId: currentTurnMemberId,
      svincolatiNominatorConfirmed: false,
      svincolatiReadyMembers: [],
    },
  })

  return {
    success: true,
    message: `[BOT] ${currentMember.user.username} ha nominato ${randomPlayer.name}`,
    data: { player: randomPlayer, nominator: currentMember.user.username },
  }
}

// ==================== BOT CONFIRM NOMINATION (ADMIN SIMULATION) ====================

export async function botConfirmSvincolatiNomination(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  if (activeSession.svincolatiState !== 'NOMINATION') {
    return { success: false, message: 'Non c\'è una nominazione da confermare' }
  }

  if (activeSession.svincolatiNominatorConfirmed) {
    return { success: false, message: 'Nominazione già confermata' }
  }

  if (!activeSession.svincolatiPendingNominatorId) {
    return { success: false, message: 'Nessun nominatore pendente' }
  }

  const player = activeSession.svincolatiPendingPlayerId
    ? await prisma.serieAPlayer.findUnique({ where: { id: activeSession.svincolatiPendingPlayerId } })
    : null

  // Confirm and add nominator to ready
  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiNominatorConfirmed: true,
      svincolatiReadyMembers: [activeSession.svincolatiPendingNominatorId],
    },
  })

  return {
    success: true,
    message: `[BOT] Nominazione confermata per ${player?.name || 'giocatore'}`,
    data: { player },
  }
}

// ==================== BOT BID SVINCOLATI (ADMIN SIMULATION) ====================

export async function botBidSvincolati(
  auctionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      bids: { orderBy: { amount: 'desc' }, take: 1 },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
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

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  // Get active session to find turn order
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId: auction.leagueId,
      status: 'ACTIVE',
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  const turnOrder = (activeSession.svincolatiTurnOrder as string[] | null) || []

  // Get all members in turn order
  const members = await prisma.leagueMember.findMany({
    where: {
      id: { in: turnOrder },
      status: MemberStatus.ACTIVE,
    },
    include: { user: { select: { username: true } } },
  })

  // Find the current winning bidder (to exclude from random selection)
  const currentWinningBidderId = auction.bids[0]?.bidderId || null

  // Filter out current winner and those without budget
  const potentialBidders = members.filter(m =>
    m.id !== currentWinningBidderId &&
    m.currentBudget > auction.currentPrice
  )

  if (potentialBidders.length === 0) {
    return {
      success: true,
      message: 'Nessun altro manager può rilanciare',
      data: { hasBotBid: false },
    }
  }

  // Pick a random bidder
  const randomBidder = potentialBidders[Math.floor(Math.random() * potentialBidders.length)]

  // Calculate bid amount (+1 to +3)
  const bidIncrement = Math.floor(Math.random() * 3) + 1
  const newBidAmount = Math.min(auction.currentPrice + bidIncrement, randomBidder.currentBudget)

  if (newBidAmount <= auction.currentPrice) {
    return {
      success: true,
      message: 'Budget insufficiente per rilanciare',
      data: { hasBotBid: false },
    }
  }

  // Get timer settings and calculate new expiration
  const timerSeconds = activeSession.svincolatiTimerSeconds ?? activeSession.auctionTimerSeconds ?? 30
  const newTimerExpires = new Date(Date.now() + timerSeconds * 1000)

  // Place the bid and reset timer
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
        bidderId: randomBidder.id,
        userId: randomBidder.userId,
        amount: newBidAmount,
        isWinning: true,
      },
    })

    // Update auction current price and RESET TIMER
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        currentPrice: newBidAmount,
        timerExpiresAt: newTimerExpires,
        timerSeconds,
      },
    })
  })

  return {
    success: true,
    message: `[BOT] ${randomBidder.user.username} ha offerto ${newBidAmount}`,
    data: {
      hasBotBid: true,
      winningBot: randomBidder.user.username,
      newCurrentPrice: newBidAmount,
      timerExpiresAt: newTimerExpires,
      timerSeconds,
    },
  }
}

// ==================== DECLARE FINISHED (MANAGER) ====================

/**
 * Manager dichiara di aver finito la fase svincolati.
 * Non potrà più fare offerte ma potrà continuare a vedere l'asta.
 */
export async function declareSvincolatiFinished(
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione svincolati attiva' }
  }

  const finishedMembers = (activeSession.svincolatiFinishedMembers as string[] | null) || []

  if (finishedMembers.includes(member.id)) {
    return { success: false, message: 'Hai già dichiarato di aver finito' }
  }

  const newFinishedMembers = [...finishedMembers, member.id]

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiFinishedMembers: newFinishedMembers,
    },
  })

  // M-7: Audit log for declare finished
  logAction(userId, leagueId, 'SVINCOLATI_DECLARE_FINISHED', 'MarketSession', activeSession.id, undefined, { memberId: member.id }).catch(() => {})

  // Get total active members to check if all finished
  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId, status: MemberStatus.ACTIVE },
  })

  const allFinished = newFinishedMembers.length >= allMembers.length

  return {
    success: true,
    message: allFinished
      ? 'Tutti i manager hanno finito! L\'admin può chiudere la fase.'
      : 'Hai dichiarato di aver finito. Non potrai più fare offerte.',
    data: {
      finishedCount: newFinishedMembers.length,
      totalMembers: allMembers.length,
      allFinished,
    },
  }
}

// ==================== UNDO DECLARE FINISHED (MANAGER) ====================

/**
 * Manager annulla la dichiarazione di aver finito.
 * Può tornare a fare offerte.
 */
export async function undoSvincolatiFinished(
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione svincolati attiva' }
  }

  const finishedMembers = (activeSession.svincolatiFinishedMembers as string[] | null) || []

  if (!finishedMembers.includes(member.id)) {
    return { success: false, message: 'Non hai ancora dichiarato di aver finito' }
  }

  const newFinishedMembers = finishedMembers.filter(id => id !== member.id)

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiFinishedMembers: newFinishedMembers,
    },
  })

  // M-7: Audit log for undo finished
  logAction(userId, leagueId, 'SVINCOLATI_UNDO_FINISHED', 'MarketSession', activeSession.id, undefined, { memberId: member.id }).catch(() => {})

  return {
    success: true,
    message: 'Puoi tornare a fare offerte.',
  }
}

// ==================== FORCE ALL FINISHED (ADMIN SIMULATION) ====================

/**
 * Admin forza tutti i manager come "finito" per testing.
 */
export async function forceAllSvincolatiFinished(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione svincolati attiva' }
  }

  // Get all active members
  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId, status: MemberStatus.ACTIVE },
  })

  const allMemberIds = allMembers.map(m => m.id)

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiFinishedMembers: allMemberIds,
    },
  })

  return {
    success: true,
    message: `Tutti i ${allMembers.length} manager sono stati marcati come finiti.`,
    data: {
      finishedCount: allMembers.length,
      totalMembers: allMembers.length,
      allFinished: true,
    },
  }
}

// ==================== M-1: PAUSE/RESUME SVINCOLATI TIMER ====================

export async function pauseSvincolati(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione svincolati attiva' }
  }

  // Can only pause during AUCTION state
  if (activeSession.svincolatiState !== 'AUCTION') {
    return { success: false, message: 'Puoi mettere in pausa solo durante l\'asta' }
  }

  // Calculate remaining seconds
  let remainingSeconds = 0
  if (activeSession.svincolatiTimerStartedAt) {
    const elapsedMs = Date.now() - activeSession.svincolatiTimerStartedAt.getTime()
    const elapsedSeconds = Math.floor(elapsedMs / 1000)
    remainingSeconds = Math.max(0, activeSession.svincolatiTimerSeconds - elapsedSeconds)
  }

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiPausedFromState: activeSession.svincolatiState,
      svincolatiPausedRemainingSeconds: remainingSeconds,
      svincolatiState: 'PAUSED',
      svincolatiTimerStartedAt: null,
      svincolatiReadyMembers: [],
    },
  })

  // M-7: Audit log
  logAction(adminUserId, leagueId, 'SVINCOLATI_PAUSE', 'MarketSession', activeSession.id, undefined, { remainingSeconds }).catch(() => {})

  return {
    success: true,
    message: `Svincolati in pausa (${remainingSeconds} secondi rimanenti)`,
    data: { remainingSeconds, pausedFromState: activeSession.svincolatiState },
  }
}

export async function resumeSvincolati(
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
      currentPhase: 'ASTA_SVINCOLATI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione svincolati attiva' }
  }

  if (activeSession.svincolatiState !== 'PAUSED') {
    return { success: false, message: 'La sessione non è in pausa' }
  }

  const resumeState = activeSession.svincolatiPausedFromState || 'AUCTION'
  const remainingSeconds = activeSession.svincolatiPausedRemainingSeconds || 0

  await prisma.marketSession.update({
    where: { id: activeSession.id },
    data: {
      svincolatiState: resumeState,
      svincolatiTimerStartedAt: new Date(),
      svincolatiPausedFromState: null,
      svincolatiPausedRemainingSeconds: null,
    },
  })

  // M-7: Audit log
  logAction(adminUserId, leagueId, 'SVINCOLATI_RESUME', 'MarketSession', activeSession.id, undefined, { remainingSeconds, resumeState }).catch(() => {})

  return {
    success: true,
    message: `Svincolati ripresi (${remainingSeconds} secondi rimanenti)`,
    data: { remainingSeconds, resumedToState: resumeState },
  }
}
