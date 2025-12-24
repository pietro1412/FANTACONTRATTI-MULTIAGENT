import { PrismaClient, AuctionStatus, AuctionType, MemberRole, MemberStatus, AcquisitionType, RosterStatus, Prisma } from '@prisma/client'
import { calculateRescissionClause, canAdvanceFromContratti } from './contract.service'
import { recordMovement } from './movement.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
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
    message: 'Sessione chiusa',
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
          bidder: true,
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
  const recentCompletedAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: sessionId,
      status: { in: ['COMPLETED', 'NO_BIDS'] },
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

  // If all acknowledged, no pending
  if (allAcknowledged) {
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
        userAcknowledged,
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
  // The nominator is automatically ready
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      pendingNominationPlayerId: playerId,
      pendingNominatorId: member.id,
      readyMembers: [member.id], // Nominator is automatically ready
    },
  })

  return {
    success: true,
    message: `Hai nominato ${player.name}. In attesa che tutti siano pronti.`,
    data: { player },
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

  // Get current ready members
  const readyMembers = (session.readyMembers as string[]) || []

  // Check if already ready
  if (readyMembers.includes(member.id)) {
    return { success: false, message: 'Sei già pronto' }
  }

  // Add to ready list
  readyMembers.push(member.id)

  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      readyMembers,
    },
  })

  // Check if all members are ready
  const totalMembers = await prisma.leagueMember.count({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (readyMembers.length >= totalMembers) {
    // All ready! Start the auction
    return await startPendingAuction(sessionId)
  }

  return {
    success: true,
    message: 'Sei pronto!',
    data: {
      readyCount: readyMembers.length,
      totalMembers,
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
      userIsNominator: session.pendingNominatorId === member.id,
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

  return {
    success: true,
    data: {
      managers: managersData,
      currentTurnManager,
      currentRole,
      slotLimits,
      myId: me.id,
    },
  }
}
