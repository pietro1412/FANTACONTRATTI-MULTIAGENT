import { PrismaClient, AuctionStatus, AuctionType, MemberRole, MemberStatus, AcquisitionType, RosterStatus, Position, SessionStatus, Prisma } from '@prisma/client'
import { calculateRescissionClause, canAdvanceFromContratti } from './contract.service'
import { recordMovement } from './movement.service'
import {
  triggerBidPlaced,
  triggerNominationPending,
  triggerNominationConfirmed,
  triggerMemberReady,
  triggerAuctionStarted,
  triggerAuctionClosed,
} from './pusher.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== HEARTBEAT / CONNECTION STATUS ====================

// In-memory storage for heartbeats (sessionId -> memberId -> timestamp)
const heartbeats = new Map<string, Map<string, number>>()

// Heartbeat timeout in milliseconds (10 seconds)
const HEARTBEAT_TIMEOUT = 10000

export function registerHeartbeat(sessionId: string, memberId: string): void {
  if (!heartbeats.has(sessionId)) {
    heartbeats.set(sessionId, new Map())
  }
  heartbeats.get(sessionId)!.set(memberId, Date.now())
}

export function getConnectionStatus(sessionId: string): Map<string, boolean> {
  const sessionHeartbeats = heartbeats.get(sessionId) || new Map()
  const now = Date.now()
  const status = new Map<string, boolean>()

  sessionHeartbeats.forEach((timestamp, memberId) => {
    status.set(memberId, now - timestamp < HEARTBEAT_TIMEOUT)
  })

  return status
}

export function isAllConnected(sessionId: string, memberIds: string[]): boolean {
  const status = getConnectionStatus(sessionId)
  return memberIds.every(id => status.get(id) === true)
}

export function clearSessionHeartbeats(sessionId: string): void {
  heartbeats.delete(sessionId)
}

// ==================== CONTRACT DURATION MANAGEMENT ====================

/**
 * Decrementa la durata di tutti i contratti di una lega di 1 semestre
 * Chiamato all'apertura di un nuovo mercato (non PRIMO_MERCATO)
 * Se la durata diventa 0, il giocatore viene svincolato automaticamente
 */
async function decrementContractDurations(leagueId: string): Promise<{
  decremented: number
  released: string[]
}> {
  // Get all active contracts in the league
  const contracts = await prisma.playerContract.findMany({
    where: {
      roster: {
        leagueMember: {
          leagueId,
        },
        status: RosterStatus.ACTIVE,
      },
    },
    include: {
      roster: {
        include: {
          player: true,
          leagueMember: true,
        },
      },
    },
  })

  const released: string[] = []
  let decremented = 0

  for (const contract of contracts) {
    const newDuration = contract.duration - 1

    if (newDuration <= 0) {
      // Contract expired - release player automatically (NO clause payment)
      await prisma.playerContract.delete({
        where: { id: contract.id },
      })

      await prisma.playerRoster.update({
        where: { id: contract.rosterId },
        data: {
          status: RosterStatus.RELEASED,
          releasedAt: new Date(),
        },
      })

      released.push(contract.roster.player.name)
    } else {
      // Decrement duration and recalculate rescission clause
      const newRescissionClause = calculateRescissionClause(contract.salary, newDuration)

      await prisma.playerContract.update({
        where: { id: contract.id },
        data: {
          duration: newDuration,
          rescissionClause: newRescissionClause,
        },
      })

      decremented++
    }
  }

  return { decremented, released }
}

// ==================== AUCTION SESSIONS ====================

export async function createAuctionSession(
  leagueId: string,
  adminUserId: string,
  isRegularMarket: boolean = false
): Promise<ServiceResult> {
  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Check for existing active session
  const existingSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (existingSession) {
    return { success: false, message: 'Esiste già una sessione attiva' }
  }

  // Check if PRIMO_MERCATO already exists (can only have one ever)
  if (!isRegularMarket) {
    const existingPrimoMercato = await prisma.marketSession.findFirst({
      where: {
        leagueId,
        type: 'PRIMO_MERCATO',
      },
    })

    if (existingPrimoMercato) {
      return { success: false, message: 'Il Primo Mercato è già stato effettuato. Usa "Mercato Ricorrente" per le sessioni successive.' }
    }
  }

  // Get league info
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  })

  if (!league) {
    return { success: false, message: 'Lega non trovata' }
  }

  // Check if league is started (status = ACTIVE)
  if (league.status !== 'ACTIVE') {
    return { success: false, message: 'La lega deve essere avviata prima di poter creare sessioni di mercato' }
  }

  // Count active members
  const activeMembersCount = await prisma.leagueMember.count({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  // Check minimum participants
  if (activeMembersCount < league.minParticipants) {
    return {
      success: false,
      message: `Servono almeno ${league.minParticipants} partecipanti. Attualmente: ${activeMembersCount}`
    }
  }

  // Check even number if required
  if (league.requireEvenNumber && activeMembersCount % 2 !== 0) {
    return {
      success: false,
      message: `Il numero di partecipanti deve essere pari. Attualmente: ${activeMembersCount}`
    }
  }

  // Count existing market sessions to determine semester
  const sessionCount = await prisma.marketSession.count({
    where: { leagueId },
  })

  // Determine market type and semester
  const marketType = isRegularMarket ? 'MERCATO_RICORRENTE' : 'PRIMO_MERCATO'
  const semester = sessionCount + 1

  // For regular markets, decrement all contract durations
  let decrementResult = { decremented: 0, released: [] as string[] }
  if (isRegularMarket) {
    decrementResult = await decrementContractDurations(leagueId)
  }

  // Create market session
  const session = await prisma.marketSession.create({
    data: {
      leagueId,
      type: marketType as 'PRIMO_MERCATO' | 'MERCATO_RICORRENTE',
      season: league.currentSeason,
      semester,
      status: 'ACTIVE',
      currentPhase: isRegularMarket ? 'SCAMBI_OFFERTE_1' : 'ASTA_LIBERA',
      startsAt: new Date(),
    },
  })

  const message = isRegularMarket
    ? `Mercato regolare aperto. Contratti decrementati: ${decrementResult.decremented}, Giocatori svincolati: ${decrementResult.released.length}`
    : 'Sessione PRIMO MERCATO creata'

  return {
    success: true,
    message,
    data: {
      session,
      ...(isRegularMarket && {
        contractsDecremented: decrementResult.decremented,
        playersReleased: decrementResult.released,
      }),
    },
  }
}

export async function getAuctionSessions(leagueId: string, userId: string): Promise<ServiceResult> {
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

  const sessions = await prisma.marketSession.findMany({
    where: { leagueId },
    orderBy: { createdAt: 'desc' },
    include: {
      auctions: {
        where: { status: 'ACTIVE' },
        take: 1,
      },
    },
  })

  return {
    success: true,
    data: sessions,
  }
}

export async function setMarketPhase(
  sessionId: string,
  adminUserId: string,
  phase: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (session.status !== 'ACTIVE') {
    return { success: false, message: 'Sessione non attiva' }
  }

  // Validate phase
  const validPhases = ['ASTA_LIBERA', 'SCAMBI_OFFERTE_1', 'CONTRATTI', 'RUBATA', 'SVINCOLATI', 'SCAMBI_OFFERTE_2']
  if (!validPhases.includes(phase)) {
    return { success: false, message: `Fase non valida. Fasi disponibili: ${validPhases.join(', ')}` }
  }

  // Check consolidation when leaving CONTRATTI phase
  if (session.currentPhase === 'CONTRATTI' && phase !== 'CONTRATTI') {
    const consolidationCheck = await canAdvanceFromContratti(sessionId)
    if (!consolidationCheck.canAdvance) {
      return { success: false, message: consolidationCheck.reason || 'Non tutti i manager hanno consolidato i contratti' }
    }
  }

  // Update session phase
  const updatedSession = await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      currentPhase: phase as 'ASTA_LIBERA' | 'SCAMBI_OFFERTE_1' | 'CONTRATTI' | 'RUBATA' | 'SVINCOLATI' | 'SCAMBI_OFFERTE_2',
    },
  })

  return {
    success: true,
    message: `Fase cambiata a ${phase}`,
    data: updatedSession,
  }
}

export async function updateSessionTimer(
  sessionId: string,
  adminUserId: string,
  timerSeconds: number
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Validate timer range
  if (timerSeconds < 5 || timerSeconds > 120) {
    return { success: false, message: 'Il timer deve essere tra 5 e 120 secondi' }
  }

  // Update session timer
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: { auctionTimerSeconds: timerSeconds },
  })

  return {
    success: true,
    message: `Timer aggiornato a ${timerSeconds} secondi`,
    data: { timerSeconds },
  }
}

export async function closeAuctionSession(
  sessionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Close any active auctions
  await prisma.auction.updateMany({
    where: {
      marketSessionId: sessionId,
      status: 'ACTIVE',
    },
    data: {
      status: 'CANCELLED',
    },
  })

  // For PRIMO_MERCATO: create automatic contracts for all acquired players
  let contractsCreated = 0
  if (session.type === 'PRIMO_MERCATO') {
    // Get all roster entries without contracts in this league
    const rostersWithoutContracts = await prisma.playerRoster.findMany({
      where: {
        leagueMember: {
          leagueId: session.leagueId,
          status: MemberStatus.ACTIVE,
        },
        status: RosterStatus.ACTIVE,
        contract: null,
      },
      include: {
        leagueMember: true,
      },
    })

    // Create contracts: 10% of acquisition price, 2 semesters
    for (const roster of rostersWithoutContracts) {
      const salary = Math.max(1, Math.round(roster.acquisitionPrice * 0.1))
      const duration = 2
      const rescissionClause = calculateRescissionClause(salary, duration)

      await prisma.playerContract.create({
        data: {
          rosterId: roster.id,
          leagueMemberId: roster.leagueMemberId,
          salary,
          duration,
          initialSalary: salary,
          initialDuration: duration,
          rescissionClause,
        },
      })
      contractsCreated++
    }
  }

  // Close session
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endsAt: new Date(),
    },
  })

  return {
    success: true,
    message: session.type === 'PRIMO_MERCATO'
      ? `Sessione chiusa. Creati ${contractsCreated} contratti automatici (10% prezzo acquisto, 2 semestri)`
      : 'Sessione chiusa',
  }
}

// ==================== AUCTION ITEMS (PLAYERS) ====================

export async function nominatePlayer(
  sessionId: string,
  playerId: string,
  adminUserId: string,
  basePrice?: number
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (session.status !== 'ACTIVE') {
    return { success: false, message: 'Sessione non attiva' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Check for existing active auction
  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: 'ACTIVE',
    },
  })

  if (existingAuction) {
    return { success: false, message: 'C\'è già un\'asta attiva. Chiudila prima di nominarne un\'altra.' }
  }

  // Check for pending acknowledgments from last auction
  const lastCompletedAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: { in: ['COMPLETED', 'NO_BIDS'] },
    },
    orderBy: { endsAt: 'desc' },
    include: {
      acknowledgments: true,
    },
  })

  if (lastCompletedAuction) {
    const totalMembers = await prisma.leagueMember.count({
      where: {
        leagueId: session.leagueId,
        status: MemberStatus.ACTIVE,
      },
    })

    if (lastCompletedAuction.acknowledgments.length < totalMembers) {
      const pending = totalMembers - lastCompletedAuction.acknowledgments.length
      return {
        success: false,
        message: `Attendere che tutti i manager confermino la transazione precedente (${pending} mancanti)`
      }
    }
  }

  // Check player exists and is not already owned
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // ===== PRIMO MERCATO: Enforce role sequence =====
  if (session.type === 'PRIMO_MERCATO') {
    // Initialize currentRole if not set
    if (!session.currentRole) {
      await prisma.marketSession.update({
        where: { id: sessionId },
        data: { currentRole: 'P' },
      })
      session.currentRole = 'P'
    }

    const currentRole = session.currentRole

    // Check if player matches current role
    if (player.position !== currentRole) {
      const roleNames: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
      return {
        success: false,
        message: `Fase ${roleNames[currentRole]}: puoi nominare solo giocatori di ruolo ${currentRole}`
      }
    }

    // Check if all managers have filled this role's slots
    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId: session.leagueId,
        status: MemberStatus.ACTIVE,
      },
      include: {
        roster: {
          where: { status: 'ACTIVE' },
          include: { player: true },
        },
      },
    })

    const slotLimits: Record<string, number> = {
      P: session.league.goalkeeperSlots,
      D: session.league.defenderSlots,
      C: session.league.midfielderSlots,
      A: session.league.forwardSlots,
    }

    const allCompletedCurrentRole = members.every(m => {
      const count = m.roster.filter(r => r.player.position === currentRole).length
      return count >= (slotLimits[currentRole] ?? 0)
    })

    if (allCompletedCurrentRole) {
      // Auto-advance to next role
      const roleSequence: ('P' | 'D' | 'C' | 'A')[] = ['P', 'D', 'C', 'A']
      const currentIndex = roleSequence.indexOf(currentRole as 'P' | 'D' | 'C' | 'A')
      if (currentIndex < roleSequence.length - 1) {
        const nextRole = roleSequence[currentIndex + 1]
        if (nextRole) {
          await prisma.marketSession.update({
            where: { id: sessionId },
            data: { currentRole: nextRole },
          })
          const roleNames: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
          return {
            success: false,
            message: `Fase ${roleNames[currentRole] ?? currentRole} completata! Ora si passa ai ${roleNames[nextRole] ?? nextRole}. Nomina un ${nextRole}.`,
          }
        }
      } else {
        return {
          success: false,
          message: 'Tutti i ruoli sono stati completati! Il Primo Mercato è terminato.',
        }
      }
    }
  }

  // Check if player is already in a roster in this league
  const existingRoster = await prisma.playerRoster.findFirst({
    where: {
      playerId,
      status: 'ACTIVE',
      leagueMember: {
        leagueId: session.leagueId,
      },
    },
  })

  if (existingRoster) {
    return { success: false, message: 'Giocatore già in una rosa' }
  }

  // Create auction
  // For PRIMO_MERCATO: base price is ALWAYS 1
  const price = session.type === 'PRIMO_MERCATO' ? 1 : (basePrice ?? player.quotation)

  // Set timer
  const timerSeconds = session.auctionTimerSeconds
  const timerExpiresAt = new Date(Date.now() + timerSeconds * 1000)

  const auction = await prisma.auction.create({
    data: {
      leagueId: session.leagueId,
      marketSessionId: sessionId,
      playerId,
      type: AuctionType.FREE_BID,
      basePrice: price,
      currentPrice: price,
      status: AuctionStatus.ACTIVE,
      timerSeconds,
      timerExpiresAt,
      startsAt: new Date(),
    },
    include: {
      player: true,
    },
  })

  return {
    success: true,
    message: `Asta aperta per ${player.name}`,
    data: auction,
  }
}

export async function getCurrentAuction(sessionId: string, userId: string): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  let auction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: 'ACTIVE',
    },
    include: {
      player: true,
      league: true,
      bids: {
        where: { isCancelled: false },
        orderBy: { placedAt: 'desc' },
        take: 10,
        include: {
          bidder: {
            include: {
              user: {
                select: { username: true },
              },
            },
          },
        },
      },
      winner: {
        include: {
          user: {
            select: { username: true },
          },
        },
      },
    },
  })

  // Check if timer expired and auto-close the auction
  let justCompleted: { playerId: string; playerName: string; winnerId: string; winnerName: string; amount: number; movementId: string | null } | null = null

  if (auction && auction.timerExpiresAt && new Date() > auction.timerExpiresAt) {
    // Timer expired! Auto-close the auction
    const winningBid = auction.bids.find(b => b.isWinning)

    if (winningBid) {
      // Assign player to winner
      await prisma.playerRoster.create({
        data: {
          leagueMemberId: winningBid.bidderId,
          playerId: auction.playerId,
          acquisitionPrice: winningBid.amount,
          acquisitionType: AcquisitionType.FIRST_MARKET,
          status: RosterStatus.ACTIVE,
        },
      })

      // Deduct budget
      await prisma.leagueMember.update({
        where: { id: winningBid.bidderId },
        data: {
          currentBudget: { decrement: winningBid.amount },
        },
      })

      // Update auction status
      await prisma.auction.update({
        where: { id: auction.id },
        data: {
          status: AuctionStatus.COMPLETED,
          winnerId: winningBid.bidderId,
          endsAt: new Date(),
        },
      })

      // Record movement and get movementId for prophecy
      const movementId = await recordMovement({
        leagueId: auction.leagueId,
        playerId: auction.playerId,
        movementType: 'FIRST_MARKET',
        toMemberId: winningBid.bidderId,
        price: winningBid.amount,
        auctionId: auction.id,
        marketSessionId: sessionId,
      })

      justCompleted = {
        playerId: auction.playerId,
        playerName: auction.player.name,
        winnerId: winningBid.bidderId,
        winnerName: winningBid.bidder.user.username,
        amount: winningBid.amount,
        movementId,
      }

      // Set auction to null since it's now closed
      auction = null
    } else {
      // No bids - close as NO_BIDS
      await prisma.auction.update({
        where: { id: auction.id },
        data: {
          status: AuctionStatus.NO_BIDS,
          endsAt: new Date(),
        },
      })

      justCompleted = {
        playerId: auction.playerId,
        playerName: auction.player.name,
        winnerId: '',
        winnerName: '',
        amount: 0,
        movementId: null,
      }

      auction = null
    }
  }

  // For PRIMO_MERCATO, calculate progress
  let marketProgress = null
  if (session.type === 'PRIMO_MERCATO') {
    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId: session.leagueId,
        status: MemberStatus.ACTIVE,
      },
      include: {
        roster: {
          where: { status: 'ACTIVE' },
          include: { player: true },
        },
      },
    })

    const slotLimits = {
      P: session.league.goalkeeperSlots,
      D: session.league.defenderSlots,
      C: session.league.midfielderSlots,
      A: session.league.forwardSlots,
    }

    const currentRole = session.currentRole || 'P'
    const roleNames: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }

    // Calculate how many slots filled vs needed for current role
    let filledSlots = 0
    let totalSlots = 0
    for (const m of members) {
      const count = m.roster.filter(r => r.player.position === currentRole).length
      filledSlots += count
      totalSlots += slotLimits[currentRole as keyof typeof slotLimits]
    }

    marketProgress = {
      currentRole,
      currentRoleName: roleNames[currentRole],
      filledSlots,
      totalSlots,
      roleSequence: ['P', 'D', 'C', 'A'],
      slotLimits,
    }
  }

  // Get all members with their budgets and current bids
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: {
        select: { username: true },
      },
    },
    orderBy: { currentBudget: 'desc' },
  })

  // Get current bids for this auction (if active)
  const currentBids: Record<string, number> = {}
  if (auction) {
    for (const bid of auction.bids) {
      // Only track the highest bid per member
      const existingBid = currentBids[bid.bidderId] ?? 0
      if (bid.amount > existingBid) {
        currentBids[bid.bidderId] = bid.amount
      }
    }
  }

  const participants = allMembers.map(m => ({
    id: m.id,
    username: m.user.username,
    role: m.role,
    currentBudget: m.currentBudget,
    currentBid: currentBids[m.id] || null,
    isWinning: auction?.bids[0]?.bidderId === m.id,
  }))

  return {
    success: true,
    data: {
      auction,
      userMembership: member,
      session: {
        id: session.id,
        type: session.type,
        currentRole: session.currentRole,
        currentPhase: session.currentPhase,
        auctionTimerSeconds: session.auctionTimerSeconds,
      },
      marketProgress,
      justCompleted, // Info about just-completed auction for prophecy modal
      participants, // All members with budgets and current bids
    },
  }
}

// ==================== BIDDING ====================

export async function placeBid(
  auctionId: string,
  userId: string,
  amount: number
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      league: true,
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  // Get member
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check budget
  if (amount > member.currentBudget) {
    return { success: false, message: 'Budget insufficiente' }
  }

  // Check minimum bid
  if (amount <= auction.currentPrice) {
    return { success: false, message: `Offerta minima: ${auction.currentPrice + 1}` }
  }

  // Check roster slots
  const position = auction.player.position
  const rosterCount = await prisma.playerRoster.count({
    where: {
      leagueMemberId: member.id,
      status: 'ACTIVE',
      player: {
        position,
      },
    },
  })

  const slotLimits: Record<string, number> = {
    P: auction.league.goalkeeperSlots,
    D: auction.league.defenderSlots,
    C: auction.league.midfielderSlots,
    A: auction.league.forwardSlots,
  }

  const maxSlots = slotLimits[position] ?? 0
  if (rosterCount >= maxSlots) {
    return { success: false, message: `Hai già raggiunto il limite di ${maxSlots} giocatori in questo ruolo` }
  }

  // Remove previous winning status
  await prisma.auctionBid.updateMany({
    where: {
      auctionId,
      isWinning: true,
    },
    data: {
      isWinning: false,
    },
  })

  // Create bid
  const bid = await prisma.auctionBid.create({
    data: {
      auctionId,
      bidderId: member.id,
      userId,
      amount,
      isWinning: true,
    },
    include: {
      bidder: {
        include: {
          user: {
            select: { username: true },
          },
        },
      },
    },
  })

  // Update auction current price and RESET TIMER
  const session = await prisma.marketSession.findFirst({
    where: {
      auctions: { some: { id: auctionId } },
    },
  })

  const timerSeconds = session?.auctionTimerSeconds ?? 30
  const newTimerExpires = new Date(Date.now() + timerSeconds * 1000)

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      currentPrice: amount,
      timerExpiresAt: newTimerExpires,
      timerSeconds,
    },
  })

  // Trigger Pusher event for bid placed (fire and forget)
  if (auction.marketSessionId) {
    triggerBidPlaced(auction.marketSessionId, {
      auctionId: auction.id,
      memberId: member.id,
      memberName: bid.bidder.user.username,
      amount: amount,
      playerId: auction.playerId,
      playerName: auction.player.name,
      timestamp: new Date().toISOString(),
    })
  }

  return {
    success: true,
    message: `Offerta di ${amount} registrata`,
    data: {
      ...bid,
      timerExpiresAt: newTimerExpires,
      timerSeconds,
    },
  }
}

export async function closeAuction(
  auctionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      league: true,
      bids: {
        where: { isWinning: true },
        include: {
          bidder: {
            include: {
              user: {
                select: { username: true },
              },
            },
          },
        },
      },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  const winningBid = auction.bids[0]

  if (!winningBid) {
    // No bids - close as NO_BIDS
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.NO_BIDS,
        endsAt: new Date(),
      },
    })

    // Trigger Pusher event for auction closed (fire and forget)
    if (auction.marketSessionId) {
      triggerAuctionClosed(auction.marketSessionId, {
        auctionId: auction.id,
        playerId: auction.playerId,
        playerName: auction.player.name,
        winnerId: null,
        winnerName: null,
        finalPrice: null,
        wasUnsold: true,
        timestamp: new Date().toISOString(),
      })
    }

    return {
      success: true,
      message: 'Asta chiusa senza offerte',
      data: { winner: null },
    }
  }

  // Assign player to winner
  const winner = winningBid.bidder

  // Create roster entry (contract will be set during CONTRATTI phase)
  await prisma.playerRoster.create({
    data: {
      leagueMemberId: winner.id,
      playerId: auction.playerId,
      acquisitionPrice: winningBid.amount,
      acquisitionType: AcquisitionType.FIRST_MARKET,
      status: RosterStatus.ACTIVE,
    },
  })

  // Deduct budget from winner
  await prisma.leagueMember.update({
    where: { id: winner.id },
    data: {
      currentBudget: {
        decrement: winningBid.amount,
      },
    },
  })

  // Update auction
  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: AuctionStatus.COMPLETED,
      winnerId: winner.id,
      endsAt: new Date(),
    },
  })

  // Record movement
  const session = await prisma.marketSession.findFirst({
    where: { auctions: { some: { id: auctionId } } },
  })

  await recordMovement({
    leagueId: auction.leagueId,
    playerId: auction.playerId,
    movementType: 'FIRST_MARKET',
    toMemberId: winner.id,
    price: winningBid.amount,
    auctionId,
    marketSessionId: session?.id,
  })

  // Trigger Pusher event for auction closed (fire and forget)
  if (auction.marketSessionId) {
    triggerAuctionClosed(auction.marketSessionId, {
      auctionId: auction.id,
      playerId: auction.playerId,
      playerName: auction.player.name,
      winnerId: winner.id,
      winnerName: winner.user.username,
      finalPrice: auction.currentPrice,
      wasUnsold: false,
      timestamp: new Date().toISOString(),
    })
  }

  return {
    success: true,
    message: `${auction.player.name} assegnato per ${winningBid.amount} crediti`,
    data: {
      winner: {
        memberId: winner.id,
        username: winner.teamName || 'Manager',
        amount: winningBid.amount,
      },
      player: auction.player,
    },
  }
}

// ==================== ROSTER ====================

export async function getRoster(leagueId: string, userId: string, targetMemberId?: string): Promise<ServiceResult> {
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

  const memberId = targetMemberId || member.id

  const roster = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: memberId,
      status: 'ACTIVE',
    },
    include: {
      player: true,
      contract: true,
    },
    orderBy: [
      { player: { position: 'asc' } },
      { player: { name: 'asc' } },
    ],
  })

  const targetMember = await prisma.leagueMember.findUnique({
    where: { id: memberId },
    include: {
      user: {
        select: { username: true },
      },
      league: true,
    },
  })

  // Group by position
  const grouped = {
    P: roster.filter(r => r.player.position === 'P'),
    D: roster.filter(r => r.player.position === 'D'),
    C: roster.filter(r => r.player.position === 'C'),
    A: roster.filter(r => r.player.position === 'A'),
  }

  return {
    success: true,
    data: {
      member: targetMember,
      roster: grouped,
      totals: {
        P: grouped.P.length,
        D: grouped.D.length,
        C: grouped.C.length,
        A: grouped.A.length,
        total: roster.length,
      },
      slots: {
        P: targetMember?.league.goalkeeperSlots || 3,
        D: targetMember?.league.defenderSlots || 8,
        C: targetMember?.league.midfielderSlots || 8,
        A: targetMember?.league.forwardSlots || 6,
      },
    },
  }
}

export async function getLeagueRosters(leagueId: string, userId: string): Promise<ServiceResult> {
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
      user: {
        select: { username: true },
      },
      roster: {
        where: { status: 'ACTIVE' },
        include: {
          player: true,
          contract: true,
        },
      },
    },
  })

  const rosters = members.map(m => ({
    memberId: m.id,
    username: m.user.username,
    teamName: m.teamName,
    role: m.role,
    budget: m.currentBudget,
    playerCount: m.roster.length,
    players: m.roster.map(r => ({
      id: r.player.id,
      rosterId: r.id,
      name: r.player.name,
      position: r.player.position,
      team: r.player.team,
      contract: r.contract ? {
        salary: r.contract.salary,
        duration: r.contract.duration,
        rescissionClause: r.contract.rescissionClause,
      } : null,
    })),
  }))

  return {
    success: true,
    data: rosters,
  }
}

// ==================== PRIMO MERCATO: ORDINE TURNI ====================

const ROLE_SEQUENCE = ['P', 'D', 'C', 'A'] as const

export async function setFirstMarketTurnOrder(
  sessionId: string,
  adminUserId: string,
  memberOrder: string[]
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (session.type !== 'PRIMO_MERCATO') {
    return { success: false, message: 'Questa funzione è solo per il PRIMO MERCATO' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Verify all members exist
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  const memberIds = members.map(m => m.id)
  const invalidIds = memberOrder.filter(id => !memberIds.includes(id))

  if (invalidIds.length > 0) {
    return { success: false, message: `ID membri non validi: ${invalidIds.join(', ')}` }
  }

  if (memberOrder.length !== memberIds.length) {
    return { success: false, message: 'L\'ordine deve includere tutti i membri attivi' }
  }

  // Update session and members
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      turnOrder: memberOrder,
      currentTurnIndex: 0,
      currentRole: 'P', // Inizia dai portieri
    },
  })

  // Update firstMarketOrder for each member
  for (let i = 0; i < memberOrder.length; i++) {
    await prisma.leagueMember.update({
      where: { id: memberOrder[i] },
      data: { firstMarketOrder: i },
    })
  }

  return {
    success: true,
    message: 'Ordine turni impostato',
    data: { turnOrder: memberOrder, currentRole: 'P' },
  }
}

export async function getFirstMarketStatus(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: true },
      },
    },
    orderBy: { firstMarketOrder: 'asc' },
  })

  const turnOrder = session.turnOrder as string[] | null
  const currentTurnIndex = session.currentTurnIndex ?? 0
  const currentRole = session.currentRole ?? 'P'

  // Calculate slots per role for each member
  const memberStatus = members.map(m => {
    const rosterByRole = {
      P: m.roster.filter(r => r.player.position === 'P').length,
      D: m.roster.filter(r => r.player.position === 'D').length,
      C: m.roster.filter(r => r.player.position === 'C').length,
      A: m.roster.filter(r => r.player.position === 'A').length,
    }

    const slotsNeeded = {
      P: session.league.goalkeeperSlots - rosterByRole.P,
      D: session.league.defenderSlots - rosterByRole.D,
      C: session.league.midfielderSlots - rosterByRole.C,
      A: session.league.forwardSlots - rosterByRole.A,
    }

    return {
      memberId: m.id,
      username: m.user.username,
      teamName: m.teamName,
      rosterByRole,
      slotsNeeded,
      isComplete: Object.values(slotsNeeded).every(s => s <= 0),
      isCurrentRoleComplete: slotsNeeded[currentRole as keyof typeof slotsNeeded] <= 0,
    }
  })

  // Find current nominator (skip those with complete current role)
  let currentNominator = null
  if (turnOrder && turnOrder.length > 0) {
    let searchIndex = currentTurnIndex
    for (let i = 0; i < turnOrder.length; i++) {
      const idx = (searchIndex + i) % turnOrder.length
      const memberId = turnOrder[idx]
      const status = memberStatus.find(m => m.memberId === memberId)
      if (status && !status.isCurrentRoleComplete) {
        currentNominator = {
          memberId,
          username: status.username,
          index: idx,
        }
        break
      }
    }
  }

  // Check if all members completed current role
  const allCompletedCurrentRole = memberStatus.every(m => m.isCurrentRoleComplete)

  return {
    success: true,
    data: {
      currentRole,
      currentTurnIndex,
      currentNominator,
      allCompletedCurrentRole,
      memberStatus,
      turnOrder,
      roleSequence: ROLE_SEQUENCE,
      isUserTurn: currentNominator?.memberId === member.id,
    },
  }
}

export async function advanceToNextRole(
  sessionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const currentRole = session.currentRole ?? 'P'
  const currentIndex = ROLE_SEQUENCE.indexOf(currentRole as 'P' | 'D' | 'C' | 'A')

  if (currentIndex >= ROLE_SEQUENCE.length - 1) {
    return { success: false, message: 'Tutti i ruoli sono stati completati' }
  }

  const nextRole = ROLE_SEQUENCE[currentIndex + 1]

  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      currentRole: nextRole,
      currentTurnIndex: 0,
    },
  })

  return {
    success: true,
    message: `Passato al ruolo ${nextRole}`,
    data: { previousRole: currentRole, currentRole: nextRole },
  }
}

export async function advanceToNextTurn(
  sessionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const turnOrder = session.turnOrder as string[] | null
  if (!turnOrder || turnOrder.length === 0) {
    return { success: false, message: 'Ordine turni non impostato' }
  }

  const currentIndex = session.currentTurnIndex ?? 0
  const nextIndex = (currentIndex + 1) % turnOrder.length

  await prisma.marketSession.update({
    where: { id: sessionId },
    data: { currentTurnIndex: nextIndex },
  })

  return {
    success: true,
    message: 'Turno avanzato',
    data: { previousIndex: currentIndex, currentIndex: nextIndex },
  }
}

// ==================== PRIMO MERCATO: ANNULLA OFFERTA ====================

export async function cancelLastBid(
  auctionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      bids: {
        where: { isCancelled: false },
        orderBy: { placedAt: 'desc' },
        take: 2,
      },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  const lastBid = auction.bids[0]
  if (!lastBid) {
    return { success: false, message: 'Nessuna offerta da annullare' }
  }

  const previousBid = auction.bids[1]

  // Cancel the last bid
  await prisma.auctionBid.update({
    where: { id: lastBid.id },
    data: {
      isCancelled: true,
      cancelledAt: new Date(),
      cancelledBy: adminUserId,
      isWinning: false,
    },
  })

  // Restore previous bid as winning (if exists)
  if (previousBid) {
    await prisma.auctionBid.update({
      where: { id: previousBid.id },
      data: { isWinning: true },
    })

    await prisma.auction.update({
      where: { id: auctionId },
      data: { currentPrice: previousBid.amount },
    })

    return {
      success: true,
      message: `Offerta di ${lastBid.amount} annullata. Offerta corrente: ${previousBid.amount}`,
      data: {
        cancelledBid: lastBid,
        currentBid: previousBid,
        currentPrice: previousBid.amount,
      },
    }
  } else {
    // No previous bid - reset to base price
    await prisma.auction.update({
      where: { id: auctionId },
      data: { currentPrice: auction.basePrice },
    })

    return {
      success: true,
      message: `Offerta di ${lastBid.amount} annullata. Nessuna offerta precedente.`,
      data: {
        cancelledBid: lastBid,
        currentBid: null,
        currentPrice: auction.basePrice,
      },
    }
  }
}

// ==================== PRIMO MERCATO: NOMINA GIOCATORE (Manager) ====================

export async function nominatePlayerByManager(
  sessionId: string,
  playerId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (session.status !== 'ACTIVE') {
    return { success: false, message: 'Sessione non attiva' }
  }

  if (session.type !== 'PRIMO_MERCATO') {
    return { success: false, message: 'Questa funzione è solo per il PRIMO MERCATO' }
  }

  // Get member
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: true },
      },
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check if it's this member's turn
  const turnOrder = session.turnOrder as string[] | null
  if (!turnOrder || turnOrder.length === 0) {
    return { success: false, message: 'Ordine turni non impostato' }
  }

  const currentTurnIndex = session.currentTurnIndex ?? 0
  const currentRole = session.currentRole ?? 'P'

  // Check slots for current role
  const rosterByRole = {
    P: member.roster.filter(r => r.player.position === 'P').length,
    D: member.roster.filter(r => r.player.position === 'D').length,
    C: member.roster.filter(r => r.player.position === 'C').length,
    A: member.roster.filter(r => r.player.position === 'A').length,
  }

  const slotLimits: Record<string, number> = {
    P: session.league.goalkeeperSlots,
    D: session.league.defenderSlots,
    C: session.league.midfielderSlots,
    A: session.league.forwardSlots,
  }

  // Check if member already completed current role
  if ((rosterByRole[currentRole as keyof typeof rosterByRole] ?? 0) >= (slotLimits[currentRole] ?? 0)) {
    return { success: false, message: `Hai già completato gli slot per il ruolo ${currentRole}. Aspetta il prossimo ruolo.` }
  }

  // Find current nominator (skip those with complete current role)
  let currentNominatorId: string | null = null
  for (let i = 0; i < turnOrder.length; i++) {
    const idx = (currentTurnIndex + i) % turnOrder.length
    const memberId = turnOrder[idx]

    // Get this member's roster
    const m = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      include: {
        roster: {
          where: { status: 'ACTIVE' },
          include: { player: true },
        },
      },
    })

    if (m) {
      const mRoster = {
        P: m.roster.filter(r => r.player.position === 'P').length,
        D: m.roster.filter(r => r.player.position === 'D').length,
        C: m.roster.filter(r => r.player.position === 'C').length,
        A: m.roster.filter(r => r.player.position === 'A').length,
      }

      if ((mRoster[currentRole as keyof typeof mRoster] ?? 0) < (slotLimits[currentRole] ?? 0)) {
        currentNominatorId = memberId ?? null
        break
      }
    }
  }

  if (currentNominatorId !== member.id) {
    return { success: false, message: 'Non è il tuo turno di nominare' }
  }

  // Check for existing active auction
  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: 'ACTIVE',
    },
  })

  if (existingAuction) {
    return { success: false, message: 'C\'è già un\'asta attiva. Attendere la chiusura.' }
  }

  // Check player exists
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Check player position matches current role
  if (player.position !== currentRole) {
    return { success: false, message: `Puoi nominare solo giocatori del ruolo ${currentRole}` }
  }

  // Check if player is already in a roster in this league
  const existingRoster = await prisma.playerRoster.findFirst({
    where: {
      playerId,
      status: 'ACTIVE',
      leagueMember: {
        leagueId: session.leagueId,
      },
    },
  })

  if (existingRoster) {
    return { success: false, message: 'Giocatore già in una rosa' }
  }

  // Create auction with BASE PRICE = 1 (always)
  const timerSeconds = session.auctionTimerSeconds
  const timerExpires = new Date(Date.now() + timerSeconds * 1000)

  const auction = await prisma.auction.create({
    data: {
      leagueId: session.leagueId,
      marketSessionId: sessionId,
      playerId,
      type: AuctionType.FREE_BID,
      basePrice: 1, // SEMPRE 1
      currentPrice: 1,
      nominatorId: member.id,
      status: AuctionStatus.ACTIVE,
      timerExpiresAt: timerExpires,
      timerSeconds,
      startsAt: new Date(),
    },
    include: {
      player: true,
    },
  })

  // The nominator MUST place the first bid (at least 1)
  await prisma.auctionBid.create({
    data: {
      auctionId: auction.id,
      bidderId: member.id,
      userId,
      amount: 1,
      isWinning: true,
    },
  })

  return {
    success: true,
    message: `Asta aperta per ${player.name} - Offerta iniziale: 1`,
    data: {
      auction,
      timerExpiresAt: timerExpires,
      timerSeconds,
    },
  }
}

// ==================== AUCTION ACKNOWLEDGMENT ====================

/**
 * Acknowledge auction completion - all managers must confirm before next auction
 */
export async function acknowledgeAuction(
  auctionId: string,
  userId: string,
  prophecy?: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { league: true },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.status !== 'COMPLETED' && auction.status !== 'NO_BIDS') {
    return { success: false, message: 'L\'asta non è ancora conclusa' }
  }

  // Get member
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check if already acknowledged
  const existing = await prisma.auctionAcknowledgment.findUnique({
    where: {
      auctionId_memberId: {
        auctionId,
        memberId: member.id,
      },
    },
  })

  if (existing) {
    return { success: false, message: 'Hai già confermato questa transazione' }
  }

  // Create acknowledgment
  await prisma.auctionAcknowledgment.create({
    data: {
      auctionId,
      memberId: member.id,
      prophecy: prophecy?.trim() || null,
    },
  })

  // If prophecy is provided, also save it in the Prophecy model for the Movements page
  if (prophecy?.trim() && auction.status === 'COMPLETED' && auction.winnerId) {
    // Find the movement associated with this auction
    const movement = await prisma.playerMovement.findFirst({
      where: {
        auctionId: auction.id,
      },
    })

    if (movement) {
      // Determine if user is buyer or seller
      const isBuyer = movement.toMemberId === member.id
      const isSeller = movement.fromMemberId === member.id

      if (isBuyer || isSeller) {
        // Check if prophecy already exists
        const existingProphecy = await prisma.prophecy.findUnique({
          where: {
            movementId_authorId: {
              movementId: movement.id,
              authorId: member.id,
            },
          },
        })

        if (!existingProphecy) {
          await prisma.prophecy.create({
            data: {
              leagueId: auction.leagueId,
              playerId: auction.playerId,
              authorId: member.id,
              movementId: movement.id,
              authorRole: isBuyer ? 'BUYER' : 'SELLER',
              content: prophecy.trim(),
            },
          })
        }
      }
    }
  }

  // Check how many have acknowledged
  const totalMembers = await prisma.leagueMember.count({
    where: {
      leagueId: auction.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  const totalAcknowledged = await prisma.auctionAcknowledgment.count({
    where: { auctionId },
  })

  const allAcknowledged = totalAcknowledged >= totalMembers

  // If all acknowledged, advance to next turn
  if (allAcknowledged) {
    const session = await prisma.marketSession.findFirst({
      where: { auctions: { some: { id: auctionId } } },
    })

    if (session && session.type === 'PRIMO_MERCATO') {
      const turnOrder = session.turnOrder as string[] | null
      if (turnOrder && turnOrder.length > 0) {
        const currentIndex = session.currentTurnIndex ?? 0
        const nextIndex = (currentIndex + 1) % turnOrder.length

        await prisma.marketSession.update({
          where: { id: session.id },
          data: { currentTurnIndex: nextIndex },
        })
      }
    }
  }

  return {
    success: true,
    message: 'Conferma registrata',
    data: {
      acknowledged: totalAcknowledged,
      total: totalMembers,
      allAcknowledged,
    },
  }
}

/**
 * Get pending acknowledgment info for a session
 */
export async function getPendingAcknowledgment(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Get member
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Find the most recent completed auction in this session that needs acknowledgment
  // Include auctions in appeal-related states too
  const recentCompletedAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: { in: ['COMPLETED', 'NO_BIDS', 'APPEAL_REVIEW', 'AWAITING_APPEAL_ACK', 'AWAITING_RESUME'] },
    },
    orderBy: { endsAt: 'desc' },
    include: {
      player: true,
      winner: {
        include: {
          user: { select: { username: true } },
        },
      },
      acknowledgments: {
        select: {
          memberId: true,
          member: {
            include: {
              user: { select: { username: true } },
            },
          },
        },
      },
    },
  })

  if (!recentCompletedAuction) {
    return {
      success: true,
      data: { pendingAuction: null },
    }
  }

  // Get all members
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
    },
  })

  const acknowledgedIds = new Set(recentCompletedAuction.acknowledgments.map(a => a.memberId))
  const allAcknowledged = allMembers.every(m => acknowledgedIds.has(m.id))
  const userAcknowledged = acknowledgedIds.has(member.id)

  // For appeal-related states, always return the auction (don't check normal acknowledgments)
  const isAppealState = ['APPEAL_REVIEW', 'AWAITING_APPEAL_ACK', 'AWAITING_RESUME'].includes(recentCompletedAuction.status)

  // If all acknowledged and NOT in appeal state, no pending
  if (allAcknowledged && !isAppealState) {
    return {
      success: true,
      data: { pendingAuction: null },
    }
  }

  return {
    success: true,
    data: {
      pendingAuction: {
        id: recentCompletedAuction.id,
        player: recentCompletedAuction.player,
        winner: recentCompletedAuction.winner ? {
          id: recentCompletedAuction.winnerId,
          username: recentCompletedAuction.winner.user.username,
        } : null,
        finalPrice: recentCompletedAuction.currentPrice,
        status: recentCompletedAuction.status,
        userAcknowledged: isAppealState ? true : userAcknowledged, // In appeal states, treat as acknowledged to show appeal modals
        acknowledgedMembers: recentCompletedAuction.acknowledgments.map(a => ({
          id: a.memberId,
          username: a.member.user.username,
        })),
        pendingMembers: allMembers
          .filter(m => !acknowledgedIds.has(m.id))
          .map(m => ({
            id: m.id,
            username: m.user.username,
          })),
        totalMembers: allMembers.length,
        totalAcknowledged: acknowledgedIds.size,
      },
    },
  }
}

// ==================== TEST UTILITIES (ADMIN ONLY) ====================

/**
 * Force acknowledge auction for all pending members (TEST ONLY)
 */
export async function forceAcknowledgeAll(
  sessionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Find pending auction
  const pendingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: { in: ['COMPLETED', 'NO_BIDS'] },
    },
    orderBy: { endsAt: 'desc' },
  })

  if (!pendingAuction) {
    return { success: false, message: 'Nessuna asta da confermare' }
  }

  // Get all members
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  // Get existing acknowledgments
  const existingAcks = await prisma.auctionAcknowledgment.findMany({
    where: { auctionId: pendingAuction.id },
  })

  const acknowledgedIds = new Set(existingAcks.map(a => a.memberId))

  // Create acknowledgments for all pending members
  let created = 0
  for (const member of allMembers) {
    if (!acknowledgedIds.has(member.id)) {
      await prisma.auctionAcknowledgment.create({
        data: {
          auctionId: pendingAuction.id,
          memberId: member.id,
          prophecy: null,
        },
      })
      created++
    }
  }

  // Advance to next turn
  if (session.type === 'PRIMO_MERCATO') {
    const turnOrder = session.turnOrder as string[] | null
    if (turnOrder && turnOrder.length > 0) {
      const currentIndex = session.currentTurnIndex ?? 0
      const nextIndex = (currentIndex + 1) % turnOrder.length

      await prisma.marketSession.update({
        where: { id: sessionId },
        data: { currentTurnIndex: nextIndex },
      })
    }
  }

  return {
    success: true,
    message: `Conferme forzate per ${created} manager`,
    data: { created, total: allMembers.length },
  }
}

/**
 * Force all managers ready for pending nomination (TEST ONLY)
 */
export async function forceAllReady(
  sessionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId: adminUserId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (!session.pendingNominationPlayerId) {
    return { success: false, message: 'Nessuna nomination in attesa' }
  }

  // Get all member IDs
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  const allMemberIds = allMembers.map(m => m.id)

  // Set all as ready
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      readyMembers: allMemberIds,
    },
  })

  // Now start the auction
  return await startPendingAuction(sessionId)
}

// ==================== READY CHECK SYSTEM ====================

/**
 * Store a pending nomination (player nominated but waiting for ready check)
 */
export async function setPendingNomination(
  sessionId: string,
  playerId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (session.status !== 'ACTIVE') {
    return { success: false, message: 'Sessione non attiva' }
  }

  if (session.type !== 'PRIMO_MERCATO') {
    return { success: false, message: 'Ready check solo per PRIMO MERCATO' }
  }

  // Check if there's already an active auction
  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: 'ACTIVE',
    },
  })

  if (existingAuction) {
    return { success: false, message: 'C\'è già un\'asta attiva' }
  }

  // Check if there's already a pending nomination
  if (session.pendingNominationPlayerId) {
    return { success: false, message: 'C\'è già una nomination in attesa' }
  }

  // Get member (include user for Pusher events)
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: {
        select: { username: true },
      },
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: true },
      },
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check if it's this member's turn
  const turnOrder = session.turnOrder as string[] | null
  if (!turnOrder || turnOrder.length === 0) {
    return { success: false, message: 'Ordine turni non impostato' }
  }

  const currentRole = session.currentRole ?? 'P'

  const slotLimits: Record<string, number> = {
    P: session.league.goalkeeperSlots,
    D: session.league.defenderSlots,
    C: session.league.midfielderSlots,
    A: session.league.forwardSlots,
  }

  // Check if member already completed current role
  const rosterByRole = {
    P: member.roster.filter(r => r.player.position === 'P').length,
    D: member.roster.filter(r => r.player.position === 'D').length,
    C: member.roster.filter(r => r.player.position === 'C').length,
    A: member.roster.filter(r => r.player.position === 'A').length,
  }

  if ((rosterByRole[currentRole as keyof typeof rosterByRole] ?? 0) >= (slotLimits[currentRole] ?? 0)) {
    return { success: false, message: `Hai già completato gli slot per il ruolo ${currentRole}` }
  }

  // Find current nominator (who should call)
  let currentNominatorId: string | null = null
  const currentTurnIndex = session.currentTurnIndex ?? 0

  for (let i = 0; i < turnOrder.length; i++) {
    const idx = (currentTurnIndex + i) % turnOrder.length
    const memberId = turnOrder[idx]

    const m = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      include: {
        roster: {
          where: { status: 'ACTIVE' },
          include: { player: true },
        },
      },
    })

    if (m) {
      const mRoster = {
        P: m.roster.filter(r => r.player.position === 'P').length,
        D: m.roster.filter(r => r.player.position === 'D').length,
        C: m.roster.filter(r => r.player.position === 'C').length,
        A: m.roster.filter(r => r.player.position === 'A').length,
      }

      if ((mRoster[currentRole as keyof typeof mRoster] ?? 0) < (slotLimits[currentRole] ?? 0)) {
        currentNominatorId = memberId ?? null
        break
      }
    }
  }

  if (currentNominatorId !== member.id) {
    return { success: false, message: 'Non è il tuo turno di nominare' }
  }

  // Check player exists
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Check player position matches current role
  if (player.position !== currentRole) {
    return { success: false, message: `Puoi nominare solo giocatori del ruolo ${currentRole}` }
  }

  // Check if player is already in a roster
  const existingRoster = await prisma.playerRoster.findFirst({
    where: {
      playerId,
      status: 'ACTIVE',
      leagueMember: {
        leagueId: session.leagueId,
      },
    },
  })

  if (existingRoster) {
    return { success: false, message: 'Giocatore già in una rosa' }
  }

  // Store pending nomination
  // The nominator must CONFIRM before others can declare ready
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      pendingNominationPlayerId: playerId,
      pendingNominatorId: member.id,
      nominatorConfirmed: false, // Nominator must confirm first
      readyMembers: [], // Reset ready members
    },
  })

  // Trigger Pusher event for nomination pending (fire and forget)
  triggerNominationPending(sessionId, {
    auctionId: '', // no auction yet
    nominatorId: member.id,
    nominatorName: member.user.username,
    playerId: player.id,
    playerName: player.name,
    playerRole: player.position,
    startingPrice: 1,
    timestamp: new Date().toISOString(),
  })

  return {
    success: true,
    message: `Hai selezionato ${player.name}. Conferma o cambia scelta.`,
    data: { player },
  }
}

/**
 * Confirm the nomination (nominator confirms their choice)
 */
export async function confirmNomination(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: {
      league: true,
      pendingNominationPlayer: true,
    },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (!session.pendingNominationPlayerId) {
    return { success: false, message: 'Nessuna nomination in attesa' }
  }

  // Get member (include user for Pusher events)
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: {
        select: { username: true },
      },
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Only the nominator can confirm
  if (session.pendingNominatorId !== member.id) {
    return { success: false, message: 'Solo chi ha nominato può confermare' }
  }

  // Already confirmed?
  if (session.nominatorConfirmed) {
    return { success: false, message: 'Già confermato' }
  }

  // Confirm and add nominator to ready members
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      nominatorConfirmed: true,
      readyMembers: [member.id], // Nominator is now ready
    },
  })

  // Trigger Pusher event for nomination confirmed (fire and forget)
  triggerNominationConfirmed(sessionId, {
    auctionId: '',
    playerId: session.pendingNominationPlayer!.id,
    playerName: session.pendingNominationPlayer!.name,
    playerRole: session.pendingNominationPlayer!.position,
    startingPrice: 1,
    nominatorId: session.pendingNominatorId!,
    nominatorName: member.user.username,
    timerDuration: session.auctionTimerSeconds,
    timestamp: new Date().toISOString(),
  })

  // Check if we're the only member (auto-start)
  const totalMembers = await prisma.leagueMember.count({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (totalMembers === 1) {
    // Solo member, start auction immediately
    return await startPendingAuction(sessionId)
  }

  return {
    success: true,
    message: `Scelta confermata! In attesa che gli altri siano pronti.`,
    data: { player: session.pendingNominationPlayer },
  }
}

/**
 * Cancel the pending nomination (nominator can change their choice)
 */
export async function cancelNomination(
  sessionId: string,
  userId: string
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

  // Get member
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Only the nominator can cancel (before confirmation)
  // Or admin can cancel anytime
  const isAdmin = member.role === 'ADMIN'
  const isNominator = session.pendingNominatorId === member.id

  if (!isNominator && !isAdmin) {
    return { success: false, message: 'Solo chi ha nominato può annullare' }
  }

  // If already confirmed and nominator (not admin), cannot cancel
  if (session.nominatorConfirmed && isNominator && !isAdmin) {
    return { success: false, message: 'Scelta già confermata, non puoi annullare' }
  }

  // Clear the nomination
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      pendingNominationPlayerId: null,
      pendingNominatorId: null,
      nominatorConfirmed: false,
      readyMembers: [],
    },
  })

  return {
    success: true,
    message: 'Nomination annullata',
  }
}

/**
 * Mark current user as ready for the pending auction
 */
export async function markReady(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: {
      league: true,
      pendingNominationPlayer: true,
    },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  if (!session.pendingNominationPlayerId) {
    return { success: false, message: 'Nessuna nomination in attesa' }
  }

  // Get member (include user for Pusher events)
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: {
        select: { username: true },
      },
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Non-nominators can only mark ready after nominator confirms
  const isNominator = session.pendingNominatorId === member.id
  if (!isNominator && !session.nominatorConfirmed) {
    return { success: false, message: 'Attendi che il nominatore confermi la scelta' }
  }

  // Get current ready members
  const readyMembers = (session.readyMembers as string[]) || []

  // Check if already ready
  if (readyMembers.includes(member.id)) {
    return { success: false, message: 'Sei già pronto' }
  }

  // Add to ready list
  const newReadyMembers = [...readyMembers, member.id]

  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      readyMembers: newReadyMembers,
    },
  })

  // Get all members count for Pusher event
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  // Trigger Pusher event for member ready (fire and forget)
  triggerMemberReady(sessionId, {
    memberId: member.id,
    memberName: member.user.username,
    isReady: true,
    readyCount: newReadyMembers.length,
    totalMembers: allMembers.length,
    timestamp: new Date().toISOString(),
  })

  if (newReadyMembers.length >= allMembers.length) {
    // All ready! Start the auction
    return await startPendingAuction(sessionId)
  }

  return {
    success: true,
    message: 'Sei pronto!',
    data: {
      readyCount: newReadyMembers.length,
      totalMembers: allMembers.length,
      allReady: false,
    },
  }
}

/**
 * Start the auction after all managers are ready
 */
async function startPendingAuction(sessionId: string): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: {
      league: true,
      pendingNominationPlayer: true,
    },
  })

  if (!session || !session.pendingNominationPlayerId || !session.pendingNominatorId) {
    return { success: false, message: 'Nessuna nomination pending' }
  }

  const playerId = session.pendingNominationPlayerId
  const nominatorId = session.pendingNominatorId
  const player = session.pendingNominationPlayer!

  // Create auction
  const timerSeconds = session.auctionTimerSeconds
  const timerExpires = new Date(Date.now() + timerSeconds * 1000)

  const auction = await prisma.auction.create({
    data: {
      leagueId: session.leagueId,
      marketSessionId: sessionId,
      playerId,
      type: AuctionType.FREE_BID,
      basePrice: 1,
      currentPrice: 1,
      nominatorId,
      status: AuctionStatus.ACTIVE,
      timerExpiresAt: timerExpires,
      timerSeconds,
      startsAt: new Date(),
    },
    include: {
      player: true,
    },
  })

  // Nominator places first bid
  const nominator = await prisma.leagueMember.findUnique({
    where: { id: nominatorId },
    include: { user: true },
  })

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
      readyMembers: Prisma.JsonNull,
    },
  })

  // Trigger Pusher event for auction started (fire and forget)
  triggerAuctionStarted(sessionId, {
    sessionId,
    auctionType: session.type,
    nominatorId: nominator!.id,
    nominatorName: nominator!.user.username,
    timestamp: new Date().toISOString(),
  })

  return {
    success: true,
    message: `Tutti pronti! Asta per ${player.name} iniziata.`,
    data: {
      auction,
      timerExpiresAt: timerExpires,
      timerSeconds,
      allReady: true,
    },
  }
}

/**
 * Get ready check status for a session
 */
export async function getReadyStatus(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: {
      league: true,
      pendingNominationPlayer: true,
    },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Get member
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // If no pending nomination
  if (!session.pendingNominationPlayerId) {
    return {
      success: true,
      data: {
        hasPendingNomination: false,
        nominatorConfirmed: false,
        player: null,
        nominatorId: null,
        readyMembers: [],
        totalMembers: 0,
        userIsReady: false,
        userIsNominator: false,
      },
    }
  }

  const userIsNominator = session.pendingNominatorId === member.id

  // If nomination exists but NOT confirmed and user is NOT the nominator,
  // hide the nomination from them (they shouldn't see it yet)
  if (!session.nominatorConfirmed && !userIsNominator) {
    return {
      success: true,
      data: {
        hasPendingNomination: false,
        nominatorConfirmed: false,
        player: null,
        nominatorId: null,
        readyMembers: [],
        totalMembers: 0,
        userIsReady: false,
        userIsNominator: false,
      },
    }
  }

  // Get all members
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
    },
  })

  const readyMemberIds = (session.readyMembers as string[]) || []
  const nominator = allMembers.find(m => m.id === session.pendingNominatorId)

  return {
    success: true,
    data: {
      hasPendingNomination: true,
      nominatorConfirmed: session.nominatorConfirmed,
      player: session.pendingNominationPlayer,
      nominatorId: session.pendingNominatorId,
      nominatorUsername: nominator?.user.username || 'Unknown',
      readyMembers: allMembers
        .filter(m => readyMemberIds.includes(m.id))
        .map(m => ({
          id: m.id,
          username: m.user.username,
        })),
      pendingMembers: allMembers
        .filter(m => !readyMemberIds.includes(m.id))
        .map(m => ({
          id: m.id,
          username: m.user.username,
        })),
      totalMembers: allMembers.length,
      readyCount: readyMemberIds.length,
      userIsReady: readyMemberIds.includes(member.id),
      userIsNominator,
    },
  }
}

/**
 * Cancel pending nomination (admin only)
 */
export async function cancelPendingNomination(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      role: MemberRole.ADMIN,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (!session.pendingNominationPlayerId) {
    return { success: false, message: 'Nessuna nomination in attesa' }
  }

  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      pendingNominationPlayerId: null,
      pendingNominatorId: null,
      readyMembers: Prisma.JsonNull,
    },
  })

  return {
    success: true,
    message: 'Nomination annullata',
  }
}

// ==================== ROSTER & MANAGERS STATUS ====================

/**
 * Get my roster slots (filled and empty) for the current role phase
 */
export async function getMyRosterSlots(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: true },
      },
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const slotLimits = {
    P: session.league.goalkeeperSlots,
    D: session.league.defenderSlots,
    C: session.league.midfielderSlots,
    A: session.league.forwardSlots,
  }

  const rosterByPosition: {
    P: Array<{ id: string; playerId: string; playerName: string; playerTeam: string; acquisitionPrice: number }>
    D: Array<{ id: string; playerId: string; playerName: string; playerTeam: string; acquisitionPrice: number }>
    C: Array<{ id: string; playerId: string; playerName: string; playerTeam: string; acquisitionPrice: number }>
    A: Array<{ id: string; playerId: string; playerName: string; playerTeam: string; acquisitionPrice: number }>
  } = {
    P: [],
    D: [],
    C: [],
    A: [],
  }

  for (const r of member.roster) {
    const pos = r.player.position as 'P' | 'D' | 'C' | 'A'
    if (pos === 'P' || pos === 'D' || pos === 'C' || pos === 'A') {
      rosterByPosition[pos].push({
        id: r.id,
        playerId: r.playerId,
        playerName: r.player.name,
        playerTeam: r.player.team,
        acquisitionPrice: r.acquisitionPrice,
      })
    }
  }

  const slots = {
    P: {
      filled: rosterByPosition.P.length,
      total: slotLimits.P,
      players: rosterByPosition.P,
    },
    D: {
      filled: rosterByPosition.D.length,
      total: slotLimits.D,
      players: rosterByPosition.D,
    },
    C: {
      filled: rosterByPosition.C.length,
      total: slotLimits.C,
      players: rosterByPosition.C,
    },
    A: {
      filled: rosterByPosition.A.length,
      total: slotLimits.A,
      players: rosterByPosition.A,
    },
  }

  return {
    success: true,
    data: {
      slots,
      currentRole: session.currentRole,
      budget: member.currentBudget,
    },
  }
}

/**
 * Get all managers with their status (slots filled, budget)
 */
export async function getManagersStatus(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: { league: true },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Verify membership
  const me = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!me) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: 'ACTIVE' },
        include: { player: true },
      },
    },
    orderBy: { firstMarketOrder: 'asc' },
  })

  const slotLimits = {
    P: session.league.goalkeeperSlots,
    D: session.league.defenderSlots,
    C: session.league.midfielderSlots,
    A: session.league.forwardSlots,
  }

  const totalSlots = slotLimits.P + slotLimits.D + slotLimits.C + slotLimits.A

  // Find current turn manager
  const turnOrder = session.turnOrder as string[] | null
  const currentTurnIndex = session.currentTurnIndex ?? 0
  const currentRole = session.currentRole ?? 'P'

  let currentTurnMemberId: string | null = null
  if (turnOrder && turnOrder.length > 0) {
    for (let i = 0; i < turnOrder.length; i++) {
      const idx = (currentTurnIndex + i) % turnOrder.length
      const memberId = turnOrder[idx]
      if (!memberId) continue
      const m = members.find(x => x.id === memberId)
      if (m) {
        const roleCount = m.roster.filter(r => r.player.position === currentRole).length
        if (roleCount < slotLimits[currentRole as keyof typeof slotLimits]) {
          currentTurnMemberId = memberId
          break
        }
      }
    }
  }

  // Get connection status for all managers
  const connectionStatus = getConnectionStatus(sessionId)

  const managersData = members.map(m => {
    const rosterByPosition = {
      P: m.roster.filter(r => r.player.position === 'P'),
      D: m.roster.filter(r => r.player.position === 'D'),
      C: m.roster.filter(r => r.player.position === 'C'),
      A: m.roster.filter(r => r.player.position === 'A'),
    }

    return {
      id: m.id,
      username: m.user.username,
      teamName: m.teamName,
      role: m.role,
      currentBudget: m.currentBudget,
      slotsFilled: m.roster.length,
      totalSlots,
      slotsByPosition: {
        P: { filled: rosterByPosition.P.length, total: slotLimits.P },
        D: { filled: rosterByPosition.D.length, total: slotLimits.D },
        C: { filled: rosterByPosition.C.length, total: slotLimits.C },
        A: { filled: rosterByPosition.A.length, total: slotLimits.A },
      },
      isCurrentTurn: m.id === currentTurnMemberId,
      isConnected: connectionStatus.get(m.id) ?? false,
      roster: m.roster.map(r => ({
        id: r.id,
        playerId: r.playerId,
        playerName: r.player.name,
        playerTeam: r.player.team,
        position: r.player.position,
        acquisitionPrice: r.acquisitionPrice,
      })),
    }
  })

  // Find current turn manager data
  const currentTurnManager = managersData.find(m => m.isCurrentTurn) || null

  // Check if all managers are connected
  const memberIds = members.map(m => m.id)
  const allConnected = isAllConnected(sessionId, memberIds)

  return {
    success: true,
    data: {
      managers: managersData,
      currentTurnManager,
      currentRole,
      slotLimits,
      myId: me.id,
      allConnected,
    },
  }
}

// ==================== APPEALS / RICORSI ====================

/**
 * Submit an appeal for an auction
 */
export async function submitAppeal(
  auctionId: string,
  userId: string,
  content: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { league: true },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check auction is completed
  if (auction.status !== 'COMPLETED') {
    return { success: false, message: 'Puoi fare ricorso solo su aste completate' }
  }

  // Check if user already submitted an appeal for this auction
  const existingAppeal = await prisma.auctionAppeal.findFirst({
    where: {
      auctionId,
      memberId: member.id,
    },
  })

  if (existingAppeal) {
    return { success: false, message: 'Hai già fatto ricorso per questa asta' }
  }

  // Create the appeal
  const appeal = await prisma.auctionAppeal.create({
    data: {
      auctionId,
      memberId: member.id,
      content,
    },
  })

  // Metti l'asta in stato APPEAL_REVIEW - blocca il proseguimento
  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: AuctionStatus.APPEAL_REVIEW,
      appealDecisionAcks: [], // Reset acknowledgments
    },
  })

  return {
    success: true,
    message: 'Ricorso inviato. L\'asta è bloccata fino alla risoluzione.',
    data: { appeal },
  }
}

/**
 * Get pending appeals for a league (Admin only)
 */
export async function getAppeals(
  leagueId: string,
  userId: string,
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED'
): Promise<ServiceResult> {
  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
      role: MemberRole.ADMIN,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  const appeals = await prisma.auctionAppeal.findMany({
    where: {
      auction: { leagueId },
      ...(status ? { status } : {}),
    },
    include: {
      auction: {
        include: {
          player: true,
          winner: {
            include: { user: { select: { username: true } } },
          },
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
      },
      member: {
        include: { user: { select: { username: true } } },
      },
      resolvedBy: {
        include: { user: { select: { username: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: { appeals },
  }
}

/**
 * Resolve an appeal (Admin only)
 * - ACCEPTED: re-opens the auction
 * - REJECTED: confirms the result
 */
export async function resolveAppeal(
  appealId: string,
  userId: string,
  decision: 'ACCEPTED' | 'REJECTED',
  resolutionNote?: string
): Promise<ServiceResult> {
  const appeal = await prisma.auctionAppeal.findUnique({
    where: { id: appealId },
    include: {
      auction: {
        include: {
          league: true,
          player: true,
          winner: true,
          marketSession: true,
        },
      },
    },
  })

  if (!appeal) {
    return { success: false, message: 'Ricorso non trovato' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: appeal.auction.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
      role: MemberRole.ADMIN,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (appeal.status !== 'PENDING') {
    return { success: false, message: 'Ricorso già risolto' }
  }

  if (decision === 'ACCEPTED') {
    // Annulla la transazione
    // 1. Remove the player from winner's roster
    if (appeal.auction.winnerId) {
      await prisma.playerRoster.updateMany({
        where: {
          leagueMemberId: appeal.auction.winnerId,
          playerId: appeal.auction.playerId,
          status: 'ACTIVE',
        },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      })

      // 2. Delete any contract for this roster
      const roster = await prisma.playerRoster.findFirst({
        where: {
          leagueMemberId: appeal.auction.winnerId,
          playerId: appeal.auction.playerId,
          status: 'RELEASED',
          releasedAt: { not: null },
        },
        orderBy: { releasedAt: 'desc' },
      })

      if (roster) {
        await prisma.playerContract.deleteMany({
          where: { rosterId: roster.id },
        })
      }

      // 3. Restore winner's budget
      await prisma.leagueMember.update({
        where: { id: appeal.auction.winnerId },
        data: {
          currentBudget: { increment: appeal.auction.currentPrice },
        },
      })
    }

    // 4. Delete related movement
    await prisma.playerMovement.deleteMany({
      where: { auctionId: appeal.auction.id },
    })

    // 5. Delete acknowledgments
    await prisma.auctionAcknowledgment.deleteMany({
      where: { auctionId: appeal.auction.id },
    })

    // 6. NON far partire il timer - metti in AWAITING_APPEAL_ACK
    // Dopo che tutti hanno confermato, passerà a AWAITING_RESUME
    // L'asta riprende dall'ultima offerta (NON si resetta il prezzo)
    await prisma.auction.update({
      where: { id: appeal.auctionId },
      data: {
        status: AuctionStatus.AWAITING_APPEAL_ACK,
        winnerId: null,
        // currentPrice rimane invariato - l'asta riprende dall'ultima offerta
        timerExpiresAt: null, // Timer non parte ancora
        endsAt: null,
        appealDecisionAcks: [], // Reset - tutti devono confermare
        resumeReadyMembers: [], // Reset ready members
      },
    })

    // 7. Le offerte NON vengono cancellate - l'asta riprende da dove era

    // 8. Mark appeal as accepted
    await prisma.auctionAppeal.update({
      where: { id: appealId },
      data: {
        status: 'ACCEPTED',
        resolvedById: admin.id,
        resolutionNote,
        resolvedAt: new Date(),
      },
    })

    // Also reject all other pending appeals for this auction
    await prisma.auctionAppeal.updateMany({
      where: {
        auctionId: appeal.auctionId,
        id: { not: appealId },
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        resolvedById: admin.id,
        resolutionNote: 'Asta riaperta per altro ricorso accettato',
        resolvedAt: new Date(),
      },
    })

    return {
      success: true,
      message: 'Ricorso accettato. Tutti i manager devono confermare la decisione.',
      data: {
        sessionId: appeal.auction.marketSessionId,
        auctionId: appeal.auctionId,
      },
    }
  } else {
    // REJECTED - conferma l'esito, ma tutti devono prendere visione
    await prisma.auctionAppeal.update({
      where: { id: appealId },
      data: {
        status: 'REJECTED',
        resolvedById: admin.id,
        resolutionNote,
        resolvedAt: new Date(),
      },
    })

    // Metti l'asta in attesa che tutti confermino la decisione
    await prisma.auction.update({
      where: { id: appeal.auctionId },
      data: {
        status: AuctionStatus.AWAITING_APPEAL_ACK,
        appealDecisionAcks: [], // Reset - tutti devono confermare
      },
    })

    return {
      success: true,
      message: 'Ricorso respinto. Tutti i manager devono confermare la decisione.',
    }
  }
}

/**
 * Acknowledge appeal decision - tutti i manager devono confermare la decisione
 */
export async function acknowledgeAppealDecision(
  auctionId: string,
  userId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      appeals: { where: { status: { in: ['ACCEPTED', 'REJECTED'] } }, orderBy: { resolvedAt: 'desc' }, take: 1 },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.status !== AuctionStatus.AWAITING_APPEAL_ACK) {
    return { success: false, message: 'L\'asta non è in attesa di conferma decisione' }
  }

  // Get member
  const member = await prisma.leagueMember.findFirst({
    where: { leagueId: auction.leagueId, userId, status: MemberStatus.ACTIVE },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Add to appealDecisionAcks
  const currentAcks = (auction.appealDecisionAcks as string[]) || []
  if (currentAcks.includes(member.id)) {
    return { success: false, message: 'Hai già confermato la decisione' }
  }

  const newAcks = [...currentAcks, member.id]

  // Get all members count
  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId: auction.leagueId, status: MemberStatus.ACTIVE },
  })

  const allConfirmed = newAcks.length >= allMembers.length

  // Get the resolved appeal to check if it was ACCEPTED or REJECTED
  const resolvedAppeal = auction.appeals[0]
  const wasAccepted = resolvedAppeal?.status === 'ACCEPTED'

  if (allConfirmed) {
    if (wasAccepted) {
      // Ricorso accettato - passa a AWAITING_RESUME per ready check
      await prisma.auction.update({
        where: { id: auctionId },
        data: {
          status: AuctionStatus.AWAITING_RESUME,
          appealDecisionAcks: newAcks,
          resumeReadyMembers: [], // Reset ready members
        },
      })
      return {
        success: true,
        message: 'Tutti hanno confermato. Ora tutti devono dichiararsi pronti per riprendere l\'asta.',
        data: { allConfirmed: true, nextStep: 'ready_check' },
      }
    } else {
      // Ricorso respinto - torna a COMPLETED e si prosegue
      await prisma.auction.update({
        where: { id: auctionId },
        data: {
          status: AuctionStatus.COMPLETED,
          appealDecisionAcks: newAcks,
        },
      })
      return {
        success: true,
        message: 'Tutti hanno confermato. L\'esito dell\'asta è confermato, si prosegue.',
        data: { allConfirmed: true, nextStep: 'continue' },
      }
    }
  } else {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { appealDecisionAcks: newAcks },
    })
    return {
      success: true,
      message: 'Conferma registrata. In attesa degli altri manager.',
      data: { allConfirmed: false, confirmed: newAcks.length, total: allMembers.length },
    }
  }
}

/**
 * Mark ready to resume auction (dopo ricorso ACCEPTED)
 */
export async function markReadyToResume(
  auctionId: string,
  userId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.status !== AuctionStatus.AWAITING_RESUME) {
    return { success: false, message: 'L\'asta non è in attesa di ripresa' }
  }

  // Get member
  const member = await prisma.leagueMember.findFirst({
    where: { leagueId: auction.leagueId, userId, status: MemberStatus.ACTIVE },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Add to resumeReadyMembers
  const currentReady = (auction.resumeReadyMembers as string[]) || []
  if (currentReady.includes(member.id)) {
    return { success: false, message: 'Hai già confermato di essere pronto' }
  }

  const newReady = [...currentReady, member.id]

  // Get all members count
  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId: auction.leagueId, status: MemberStatus.ACTIVE },
  })

  const allReady = newReady.length >= allMembers.length

  if (allReady) {
    // Tutti pronti - riprendi l'asta con timer
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.ACTIVE,
        resumeReadyMembers: newReady,
        timerExpiresAt: new Date(Date.now() + (auction.timerSeconds || 30) * 1000),
      },
    })
    return {
      success: true,
      message: 'Tutti pronti! L\'asta riprende.',
      data: { allReady: true },
    }
  } else {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { resumeReadyMembers: newReady },
    })
    return {
      success: true,
      message: 'Pronto registrato. In attesa degli altri manager.',
      data: { allReady: false, ready: newReady.length, total: allMembers.length },
    }
  }
}

/**
 * Force all ready to resume (TEST/ADMIN)
 */
export async function forceAllReadyToResume(
  auctionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId: adminUserId,
      status: MemberStatus.ACTIVE,
      role: MemberRole.ADMIN,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (auction.status !== AuctionStatus.AWAITING_RESUME) {
    return { success: false, message: 'L\'asta non è in attesa di ripresa' }
  }

  // Get all members and mark all as ready
  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId: auction.leagueId, status: MemberStatus.ACTIVE },
  })

  const allMemberIds = allMembers.map(m => m.id)

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: AuctionStatus.ACTIVE,
      resumeReadyMembers: allMemberIds,
      timerExpiresAt: new Date(Date.now() + (auction.timerSeconds || 30) * 1000),
    },
  })

  return {
    success: true,
    message: 'Tutti i manager sono stati segnati come pronti. L\'asta riprende.',
  }
}

/**
 * Force all appeal decision acks (TEST/ADMIN)
 */
export async function forceAllAppealDecisionAcks(
  auctionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      appeals: { where: { status: { in: ['ACCEPTED', 'REJECTED'] } }, orderBy: { resolvedAt: 'desc' }, take: 1 },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId: adminUserId,
      status: MemberStatus.ACTIVE,
      role: MemberRole.ADMIN,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  if (auction.status !== AuctionStatus.AWAITING_APPEAL_ACK) {
    return { success: false, message: 'L\'asta non è in attesa di conferma decisione' }
  }

  // Get all members
  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId: auction.leagueId, status: MemberStatus.ACTIVE },
  })

  const allMemberIds = allMembers.map(m => m.id)
  const resolvedAppeal = auction.appeals[0]
  const wasAccepted = resolvedAppeal?.status === 'ACCEPTED'

  if (wasAccepted) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.AWAITING_RESUME,
        appealDecisionAcks: allMemberIds,
        resumeReadyMembers: [],
      },
    })
    return {
      success: true,
      message: 'Tutti confermati. Ora in attesa che tutti siano pronti per riprendere.',
    }
  } else {
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.COMPLETED,
        appealDecisionAcks: allMemberIds,
      },
    })
    return {
      success: true,
      message: 'Tutti confermati. L\'esito è confermato, si prosegue.',
    }
  }
}

/**
 * Get appeal status for an auction
 */
export async function getAppealStatus(
  auctionId: string,
  userId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      winner: { include: { user: { select: { username: true } } } },
      appeals: {
        orderBy: { createdAt: 'desc' },
        include: {
          member: { include: { user: { select: { username: true } } } },
          resolvedBy: { include: { user: { select: { username: true } } } },
        },
      },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  const member = await prisma.leagueMember.findFirst({
    where: { leagueId: auction.leagueId, userId, status: MemberStatus.ACTIVE },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const allMembers = await prisma.leagueMember.findMany({
    where: { leagueId: auction.leagueId, status: MemberStatus.ACTIVE },
    include: { user: { select: { username: true } } },
  })

  const appealDecisionAcks = (auction.appealDecisionAcks as string[]) || []
  const resumeReadyMembers = (auction.resumeReadyMembers as string[]) || []

  // Find the most recent appeal (PENDING or resolved)
  const latestAppeal = auction.appeals[0]
  const hasActiveAppeal = !!latestAppeal && (
    latestAppeal.status === 'PENDING' ||
    auction.status === 'APPEAL_REVIEW' ||
    auction.status === 'AWAITING_APPEAL_ACK' ||
    auction.status === 'AWAITING_RESUME'
  )

  return {
    success: true,
    data: {
      auctionId: auction.id,
      auctionStatus: auction.status,
      hasActiveAppeal,
      appeal: latestAppeal ? {
        id: latestAppeal.id,
        status: latestAppeal.status,
        reason: latestAppeal.content,
        adminNotes: latestAppeal.resolutionNote,
        submittedBy: { username: latestAppeal.member.user.username },
      } : null,
      player: auction.player ? {
        id: auction.player.id,
        name: auction.player.name,
        team: auction.player.team,
        position: auction.player.position,
        quotation: auction.player.quotation,
      } : null,
      winner: auction.winner ? { username: auction.winner.user.username } : null,
      finalPrice: auction.currentPrice,
      appealDecisionAcks,
      resumeReadyMembers,
      allMembers: allMembers.map(m => ({ id: m.id, username: m.user.username })),
      userHasAcked: appealDecisionAcks.includes(member.id),
      userIsReady: resumeReadyMembers.includes(member.id),
      allAcked: appealDecisionAcks.length >= allMembers.length,
      allReady: resumeReadyMembers.length >= allMembers.length,
    },
  }
}

/**
 * TEST ONLY: Simulate a random manager submitting an appeal on a completed auction
 */
export async function simulateAppeal(
  leagueId: string,
  userId: string,
  auctionId?: string
): Promise<ServiceResult> {
  // Verify admin
  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
      role: MemberRole.ADMIN,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Find the target auction
  let targetAuction
  if (auctionId) {
    // Use the specific auction provided
    targetAuction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        leagueId,
        appeals: {
          none: {
            status: 'PENDING',
          },
        },
      },
      include: {
        player: true,
        winner: {
          include: { user: { select: { username: true } } },
        },
      },
    })
  } else {
    // Find a completed auction without pending appeals
    targetAuction = await prisma.auction.findFirst({
      where: {
        leagueId,
        status: AuctionStatus.COMPLETED,
        appeals: {
          none: {
            status: 'PENDING',
          },
        },
      },
      include: {
        player: true,
        winner: {
          include: { user: { select: { username: true } } },
        },
      },
      orderBy: { endsAt: 'desc' },
    })
  }

  if (!targetAuction) {
    // Check if it's because there's already a pending appeal
    if (auctionId) {
      const existingAppeal = await prisma.auctionAppeal.findFirst({
        where: { auctionId, status: 'PENDING' }
      })
      if (existingAppeal) {
        return { success: false, message: 'Esiste già un ricorso PENDING per questa asta. Gestiscilo dal pannello Admin.' }
      }
    }
    return { success: false, message: 'Nessuna asta disponibile per il test' }
  }

  // Alias for backward compatibility with rest of function
  const completedAuction = targetAuction

  // Get a random non-admin member (preferably not the winner)
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
      role: MemberRole.MANAGER,
      id: { not: completedAuction.winnerId || undefined },
    },
    include: { user: { select: { username: true } } },
  })

  if (members.length === 0) {
    // If no managers available, use any non-admin member
    const anyMember = await prisma.leagueMember.findFirst({
      where: {
        leagueId,
        status: MemberStatus.ACTIVE,
        id: { not: admin.id },
      },
      include: { user: { select: { username: true } } },
    })
    if (!anyMember) {
      return { success: false, message: 'Nessun manager disponibile per il test' }
    }
    members.push(anyMember)
  }

  // Pick a random member
  const randomMember = members[Math.floor(Math.random() * members.length)]

  if (!randomMember) {
    return { success: false, message: 'Nessun manager disponibile per il test' }
  }

  // Random appeal reasons
  const reasons = [
    'Non avevo connessione durante l\'asta e non ho potuto fare offerte.',
    'Il mio browser si è bloccato proprio quando stavo per fare un\'offerta.',
    'C\'è stato un errore tecnico, il mio rilancio non è andato a buon fine.',
    'Problemi di rete, la pagina non si aggiornava.',
    'Il timer non era sincronizzato correttamente sul mio dispositivo.',
  ]
  const randomReason = reasons[Math.floor(Math.random() * reasons.length)] ?? 'Ricorso per verifica connessione'

  // Create the appeal
  const appeal = await prisma.auctionAppeal.create({
    data: {
      auctionId: completedAuction.id,
      memberId: randomMember.id,
      content: randomReason,
    },
  })

  // Set auction status to APPEAL_REVIEW to block progress until admin resolves
  await prisma.auction.update({
    where: { id: completedAuction.id },
    data: {
      status: AuctionStatus.APPEAL_REVIEW,
      appealDecisionAcks: [],
      resumeReadyMembers: [],
    },
  })

  return {
    success: true,
    message: `Ricorso simulato creato da ${randomMember.user.username} per ${completedAuction.player.name}`,
    data: { appeal },
  }
}

/**
 * [TEST] Completa l'asta riempiendo tutti gli slot roster di tutti i manager
 * con giocatori casuali a prezzi simulati, mantenendo la coerenza del budget.
 */
export async function completeAllRosterSlots(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  // Get session and verify admin
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    include: {
      league: true,
    },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const admin = await prisma.leagueMember.findFirst({
    where: {
      leagueId: session.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
      role: MemberRole.ADMIN,
    },
  })

  if (!admin) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Get league slot configuration
  const league = session.league
  const slotConfig = {
    P: league.goalkeeperSlots,
    D: league.defenderSlots,
    C: league.midfielderSlots,
    A: league.forwardSlots,
  }

  // Get all active members
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: RosterStatus.ACTIVE },
        include: { player: true },
      },
    },
  })

  // Get all available players (not yet in any roster for this league)
  const takenPlayerIds = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId: session.leagueId },
      status: RosterStatus.ACTIVE,
    },
    select: { playerId: true },
  })
  const takenIds = new Set(takenPlayerIds.map(p => p.playerId))

  const availablePlayers = await prisma.serieAPlayer.findMany({
    where: {
      isActive: true,
      id: { notIn: Array.from(takenIds) },
    },
    orderBy: { quotation: 'desc' },
  })

  // Group available players by position
  const playersByPosition: Record<string, typeof availablePlayers> = {
    P: availablePlayers.filter(p => p.position === Position.P),
    D: availablePlayers.filter(p => p.position === Position.D),
    C: availablePlayers.filter(p => p.position === Position.C),
    A: availablePlayers.filter(p => p.position === Position.A),
  }

  let totalPlayersAdded = 0
  let totalContractsCreated = 0
  const results: string[] = []

  // Process each member
  for (const member of members) {
    // Count current roster by position
    const currentCount: Record<string, number> = { P: 0, D: 0, C: 0, A: 0 }
    for (const entry of member.roster) {
      const pos = entry.player.position
      currentCount[pos] = (currentCount[pos] || 0) + 1
    }

    let memberBudget = member.currentBudget
    let memberPlayersAdded = 0

    // Fill missing slots for each position
    for (const position of ['P', 'D', 'C', 'A'] as const) {
      const needed = slotConfig[position] - (currentCount[position] || 0)

      for (let i = 0; i < needed; i++) {
        // Get a random available player for this position
        const posPlayers = playersByPosition[position]
        if (!posPlayers || posPlayers.length === 0) continue

        // Pick a random player (weighted towards lower quotation for budget management)
        const randomIndex = Math.floor(Math.random() * posPlayers.length)
        const player = posPlayers[randomIndex]
        if (!player) continue

        // Remove from available pool
        posPlayers.splice(randomIndex, 1)

        // Calculate price: between quotation and quotation + 20% with some randomness
        const basePrice = player.quotation
        const maxExtra = Math.floor(basePrice * 0.3)
        const acquisitionPrice = basePrice + Math.floor(Math.random() * maxExtra)

        // Check if member can afford this player
        // Need to leave at least 1 credit per remaining slot after this one
        const remainingSlots = (needed - i - 1) +
          (slotConfig.D - (currentCount.D || 0) - (position === 'D' ? i + 1 : 0)) +
          (slotConfig.C - (currentCount.C || 0) - (position === 'C' ? i + 1 : 0)) +
          (slotConfig.A - (currentCount.A || 0) - (position === 'A' ? i + 1 : 0)) +
          (slotConfig.P - (currentCount.P || 0) - (position === 'P' ? i + 1 : 0))

        const minReserve = Math.max(remainingSlots, 0)
        const actualPrice = Math.min(acquisitionPrice, memberBudget - minReserve)

        if (actualPrice < 1) {
          // Can't afford any player, use minimum price
          continue
        }

        const finalPrice = Math.max(1, actualPrice)

        // Create roster entry
        const rosterEntry = await prisma.playerRoster.create({
          data: {
            leagueMemberId: member.id,
            playerId: player.id,
            acquisitionPrice: finalPrice,
            acquisitionType: AcquisitionType.FIRST_MARKET,
            status: RosterStatus.ACTIVE,
          },
        })

        // Create default contract (10% of acquisition price, minimum 1, 2 semesters)
        const rawSalary = finalPrice * 0.1
        const salary = Math.max(1, Math.round(rawSalary * 2) / 2) // Round to 0.5, min 1
        const duration = 2
        const rescissionClause = Math.round(salary * duration * 2)

        await prisma.playerContract.create({
          data: {
            rosterId: rosterEntry.id,
            leagueMemberId: member.id,
            salary,
            duration,
            initialSalary: salary,
            initialDuration: duration,
            rescissionClause,
          },
        })

        // Update member budget
        memberBudget -= finalPrice
        memberPlayersAdded++
        totalPlayersAdded++
        totalContractsCreated++

        // Update current count for remaining iterations
        currentCount[position] = (currentCount[position] || 0) + 1
      }
    }

    // Update member's budget in database
    await prisma.leagueMember.update({
      where: { id: member.id },
      data: { currentBudget: Math.max(0, memberBudget) },
    })

    if (memberPlayersAdded > 0) {
      results.push(`${member.user.username}: +${memberPlayersAdded} giocatori (budget: ${memberBudget})`)
    }
  }

  // Close the session
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      status: SessionStatus.COMPLETED,
      currentPhase: null,
    },
  })

  return {
    success: true,
    message: `Asta completata! ${totalPlayersAdded} giocatori aggiunti, ${totalContractsCreated} contratti creati.`,
    data: {
      totalPlayersAdded,
      totalContractsCreated,
      memberResults: results,
    },
  }
}
