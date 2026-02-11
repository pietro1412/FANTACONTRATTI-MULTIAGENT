import { PrismaClient, AuctionStatus, AuctionType, MemberRole, MemberStatus, AcquisitionType, RosterStatus, Position, SessionStatus, Prisma } from '@prisma/client'
import { calculateRescissionClause, calculateDefaultSalary, canAdvanceFromContratti } from './contract.service'
import { autoReleaseRitiratiPlayers } from './indemnity-phase.service'
import { recordMovement } from './movement.service'
import {
  createContractHistoryEntry,
  createContractHistoryEntries,
  createSessionStartSnapshots,
} from './contract-history.service'
import {
  triggerBidPlaced,
  triggerNominationPending,
  triggerNominationConfirmed,
  triggerMemberReady,
  triggerAuctionStarted,
  triggerAuctionClosed,
  triggerPauseRequested,
} from './pusher.service'
import { withRetry } from '../utils/db-retry'
import { notifyAuctionStart, notifyPhaseChange } from './notification.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== PLAYER STATS ENRICHMENT ====================

/** Enrich a raw SerieAPlayer record with mini-stats extracted from apiFootballStats JSON blob */
function enrichPlayerWithStats<T extends Record<string, unknown>>(player: T): T & { appearances: number | null; goals: number | null; assists: number | null; avgRating: number | null } {
  const stats = (player as Record<string, unknown>).apiFootballStats as {
    games?: { appearences?: number; rating?: number }
    goals?: { total?: number; assists?: number }
  } | null | undefined

  return {
    ...player,
    appearances: stats?.games?.appearences ?? null,
    goals: stats?.goals?.total ?? null,
    assists: stats?.goals?.assists ?? null,
    avgRating: stats?.games?.rating ? Math.round(stats.games.rating * 10) / 10 : null,
  }
}

// ==================== HEARTBEAT / CONNECTION STATUS ====================

// In-memory storage for heartbeats (sessionId -> memberId -> timestamp)
const heartbeats = new Map<string, Map<string, number>>()

// Heartbeat timeout in milliseconds (45 seconds — 1.5× the 30s client interval)
const HEARTBEAT_TIMEOUT = 45000

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

// ==================== ROSTER COMPLETION CHECK ====================

/**
 * Verifica se tutti i manager hanno completato la rosa (per chiudere ASTA_LIBERA nel PRIMO_MERCATO)
 */
export async function canAdvanceFromAstaLibera(leagueId: string): Promise<{
  canAdvance: boolean
  reason?: string
  details?: { username: string; missing: { position: string; count: number }[] }[]
}> {
  // Get league config
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  })

  if (!league) {
    return { canAdvance: false, reason: 'Lega non trovata' }
  }

  const requiredSlots = {
    P: league.goalkeeperSlots,
    D: league.defenderSlots,
    C: league.midfielderSlots,
    A: league.forwardSlots,
  }

  // Get all active members with their rosters
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: RosterStatus.ACTIVE },
        include: { player: { select: { position: true } } },
      },
    },
  })

  const incompleteMembers: { username: string; missing: { position: string; count: number }[] }[] = []

  for (const member of members) {
    // Count players by position
    const positionCounts: Record<string, number> = { P: 0, D: 0, C: 0, A: 0 }
    for (const entry of member.roster) {
      const pos = entry.player.position
      if (pos in positionCounts) {
        positionCounts[pos]++
      }
    }

    // Check for missing slots
    const missing: { position: string; count: number }[] = []
    for (const [pos, required] of Object.entries(requiredSlots)) {
      const current = positionCounts[pos] || 0
      if (current < required) {
        const positionNames: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
        missing.push({ position: positionNames[pos], count: required - current })
      }
    }

    if (missing.length > 0) {
      incompleteMembers.push({ username: member.user.username, missing })
    }
  }

  if (incompleteMembers.length > 0) {
    const summary = incompleteMembers.map(m => {
      const missingStr = m.missing.map(p => `${p.count} ${p.position}`).join(', ')
      return `${m.username}: mancano ${missingStr}`
    }).join('; ')

    return {
      canAdvance: false,
      reason: `Rose incomplete. ${summary}`,
      details: incompleteMembers,
    }
  }

  return { canAdvance: true }
}

// ==================== CONTRACT DURATION MANAGEMENT ====================

/**
 * Decrementa la durata di tutti i contratti di una lega di 1 semestre
 * Chiamato all'apertura di un nuovo mercato (non PRIMO_MERCATO)
 * Se la durata diventa 0, il giocatore viene svincolato automaticamente
 * Crea ContractHistory entries per tracciare tutte le operazioni
 */
async function decrementContractDurations(leagueId: string, marketSessionId: string): Promise<{
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
  const historyEntries: Parameters<typeof createContractHistoryEntries>[0] = []

  for (const contract of contracts) {
    const newDuration = contract.duration - 1
    const previousClause = contract.rescissionClause

    if (newDuration <= 0) {
      // Contract expired - release player automatically (NO clause payment)
      // Create history entry for auto-release
      historyEntries.push({
        contractId: contract.id,
        playerId: contract.roster.playerId,
        leagueMemberId: contract.roster.leagueMemberId,
        marketSessionId,
        eventType: 'AUTO_RELEASE_EXPIRED',
        previousSalary: contract.salary,
        previousDuration: contract.duration,
        previousClause,
        newSalary: undefined,
        newDuration: undefined,
        newClause: undefined,
        cost: 0, // No cost for auto-release on expiry
        notes: `Contratto scaduto automaticamente per ${contract.roster.player.name}`,
      })

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

      // M-13: Record PlayerMovement for auto-release on contract expiry
      await recordMovement({
        leagueId,
        playerId: contract.roster.playerId,
        movementType: 'RELEASE',
        fromMemberId: contract.roster.leagueMemberId,
        price: 0,
        oldSalary: contract.salary,
        oldDuration: contract.duration,
        oldClause: contract.rescissionClause,
        marketSessionId,
      })

      released.push(contract.roster.player.name)
    } else {
      // Decrement duration and recalculate rescission clause
      const newRescissionClause = calculateRescissionClause(contract.salary, newDuration)

      // Create history entry for duration decrement
      historyEntries.push({
        contractId: contract.id,
        playerId: contract.roster.playerId,
        leagueMemberId: contract.roster.leagueMemberId,
        marketSessionId,
        eventType: 'DURATION_DECREMENT',
        previousSalary: contract.salary,
        previousDuration: contract.duration,
        previousClause,
        newSalary: contract.salary,
        newDuration,
        newClause: newRescissionClause,
        notes: `Decremento automatico durata: ${contract.duration}→${newDuration}`,
      })

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

  // Batch create all history entries
  if (historyEntries.length > 0) {
    await createContractHistoryEntries(historyEntries)
  }

  return { decremented, released }
}

// ==================== AUCTION SESSIONS ====================

export async function createAuctionSession(
  leagueId: string,
  adminUserId: string,
  isRegularMarket: boolean = false,
  auctionMode: 'REMOTE' | 'IN_PRESENCE' = 'REMOTE'
): Promise<ServiceResult> {
  // Usa retry per gestire cold start del database
  return withRetry(async () => {
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

    // Check minimum participants (platform rule: min 6, league.minParticipants is the target max)
    const PLATFORM_MIN_PARTICIPANTS = 6
    if (activeMembersCount < PLATFORM_MIN_PARTICIPANTS) {
      return {
        success: false,
        message: `Servono almeno ${PLATFORM_MIN_PARTICIPANTS} partecipanti. Attualmente: ${activeMembersCount}`
      }
    }

    // Check even number if required
    if (league.requireEvenNumber && activeMembersCount % 2 !== 0) {
      return {
        success: false,
        message: `Il numero di partecipanti deve essere pari. Attualmente: ${activeMembersCount}`
      }
    }

    // Usa transazione per prevenire race condition
    // Il controllo per sessione esistente e la creazione avvengono atomicamente
    const result = await prisma.$transaction(async (tx) => {
      // Check for existing active session (dentro transazione per evitare race condition)
      const existingSession = await tx.marketSession.findFirst({
        where: {
          leagueId,
          status: 'ACTIVE',
        },
      })

      if (existingSession) {
        return { success: false, message: 'Esiste già una sessione attiva' }
      }

      // Check if PRIMO_MERCATO already exists (can only have one ever)
      // Auto-correct: if frontend sends isRegularMarket=false but PRIMO_MERCATO exists,
      // automatically treat it as a regular market
      let effectiveIsRegularMarket = isRegularMarket
      const existingPrimoMercato = await tx.marketSession.findFirst({
        where: {
          leagueId,
          type: 'PRIMO_MERCATO',
        },
      })

      if (existingPrimoMercato) {
        // Force regular market if first market already exists
        effectiveIsRegularMarket = true
      }

      // Count existing market sessions to determine semester
      const sessionCount = await tx.marketSession.count({
        where: { leagueId },
      })

      // Determine market type and semester
      const marketType = effectiveIsRegularMarket ? 'MERCATO_RICORRENTE' : 'PRIMO_MERCATO'
      const semester = sessionCount + 1

      // Create market session
      const now = new Date()
      const session = await tx.marketSession.create({
        data: {
          leagueId,
          type: marketType as 'PRIMO_MERCATO' | 'MERCATO_RICORRENTE',
          season: league.currentSeason,
          semester,
          status: 'ACTIVE',
          currentPhase: effectiveIsRegularMarket ? 'OFFERTE_PRE_RINNOVO' : 'ASTA_LIBERA',
          auctionMode,
          startsAt: now,
          phaseStartedAt: now,
        },
      })

      return { success: true, session, marketType }
    })

    // Se la transazione ha fallito (sessione già esistente), ritorna l'errore
    if (!result.success) {
      return result as ServiceResult
    }

    // For regular markets, decrement all contract durations (fuori dalla transazione)
    // Use marketType from transaction result to determine if it's a regular market
    const isEffectivelyRegularMarket = result.marketType === 'MERCATO_RICORRENTE'
    let decrementResult = { decremented: 0, released: [] as string[] }
    if (isEffectivelyRegularMarket) {
      decrementResult = await decrementContractDurations(leagueId, result.session.id)

      // Create SESSION_START snapshots for all managers (after duration decrement)
      try {
        const snapshotResult = await createSessionStartSnapshots(result.session.id, leagueId)
        console.log(`Created SESSION_START snapshots: ${snapshotResult.created} success, ${snapshotResult.failed} failed`)
      } catch (error) {
        console.error('Error creating session start snapshots:', error)
      }
    }

    // Auto-release RITIRATO players (RETROCESSO/ESTERO handled in CONTRATTI phase)
    let ritiratiResult = { released: 0, players: [] as string[] }
    if (isEffectivelyRegularMarket) {
      try {
        ritiratiResult = await autoReleaseRitiratiPlayers(leagueId, result.session.id)
      } catch (error) {
        console.error('Error auto-releasing ritirato players:', error)
      }
    }

    const message = isEffectivelyRegularMarket
      ? `Mercato regolare aperto (fase: Scambi Pre-Rinnovo). Contratti decrementati: ${decrementResult.decremented}, Svincolati per scadenza: ${decrementResult.released.length}${ritiratiResult.released > 0 ? `, Ritirati auto-rilasciati: ${ritiratiResult.released}` : ''}`
      : 'Sessione PRIMO MERCATO creata'

    // Push notification: auction started (fire-and-forget)
    notifyAuctionStart(leagueId, result.marketType).catch(() => {})

    return {
      success: true,
      message,
      data: {
        session: result.session,
        ...(isEffectivelyRegularMarket && {
          contractsDecremented: decrementResult.decremented,
          playersReleased: decrementResult.released,
          ...(ritiratiResult.released > 0 && {
            ritiratiAutoReleased: ritiratiResult,
          }),
        }),
      },
    }
  }, { maxRetries: 3, initialDelayMs: 2000 })
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

  // Validate phase based on market type
  // PRIMO_MERCATO: solo ASTA_LIBERA
  // MERCATO_RICORRENTE: OFFERTE_PRE_RINNOVO, PREMI, CONTRATTI, RUBATA, ASTA_SVINCOLATI, OFFERTE_POST_ASTA_SVINCOLATI
  const primoMercatoPhases = ['ASTA_LIBERA']
  const mercatoRicorrentePhases = ['OFFERTE_PRE_RINNOVO', 'PREMI', 'CONTRATTI', 'RUBATA', 'ASTA_SVINCOLATI', 'OFFERTE_POST_ASTA_SVINCOLATI']

  const validPhases = session.type === 'PRIMO_MERCATO' ? primoMercatoPhases : mercatoRicorrentePhases

  if (!validPhases.includes(phase)) {
    if (session.type === 'PRIMO_MERCATO') {
      return { success: false, message: 'Il Primo Mercato ha solo la fase ASTA_LIBERA' }
    }
    return { success: false, message: `Fase non valida per Mercato Ricorrente. Fasi disponibili: ${mercatoRicorrentePhases.join(', ')}` }
  }

  // Check roster completion when leaving ASTA_LIBERA during PRIMO_MERCATO
  if (session.currentPhase === 'ASTA_LIBERA' && phase !== 'ASTA_LIBERA' && session.type === 'PRIMO_MERCATO') {
    const rosterCheck = await canAdvanceFromAstaLibera(session.leagueId)
    if (!rosterCheck.canAdvance) {
      return { success: false, message: rosterCheck.reason || 'Non tutti i manager hanno completato la rosa' }
    }
  }

  // Check prize finalization when moving from PREMI to CONTRATTI
  if (session.currentPhase === 'PREMI' && phase === 'CONTRATTI') {
    const prizeConfig = await prisma.prizePhaseConfig.findUnique({
      where: { marketSessionId: sessionId },
      select: { isFinalized: true }
    })
    if (!prizeConfig?.isFinalized) {
      return {
        success: false,
        message: 'Devi prima consolidare i premi prima di passare alla fase Contratti. Clicca su "Conferma Premi" nella sezione Premi.'
      }
    }
  }

  // Check consolidation when leaving CONTRATTI phase
  if (session.currentPhase === 'CONTRATTI' && phase !== 'CONTRATTI') {
    const consolidationCheck = await canAdvanceFromContratti(sessionId)
    if (!consolidationCheck.canAdvance) {
      return { success: false, message: consolidationCheck.reason || 'Non tutti i manager hanno consolidato i contratti' }
    }

    // Reset all pre-consolidation values now that the phase is ending
    // This makes the Finanze page show the actual current values
    await prisma.leagueMember.updateMany({
      where: { leagueId: session.leagueId, status: MemberStatus.ACTIVE },
      data: { preConsolidationBudget: null },
    })

    await prisma.playerContract.updateMany({
      where: {
        leagueMember: { leagueId: session.leagueId, status: MemberStatus.ACTIVE },
      },
      data: {
        preConsolidationSalary: null,
        preConsolidationDuration: null,
      },
    })
  }

  // Update session phase
  const updatedSession = await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      currentPhase: phase as 'ASTA_LIBERA' | 'PREMI' | 'OFFERTE_PRE_RINNOVO' | 'CONTRATTI' | 'RUBATA' | 'ASTA_SVINCOLATI' | 'OFFERTE_POST_ASTA_SVINCOLATI',
      phaseStartedAt: new Date(),
    },
  })

  // Push notification: phase changed (fire-and-forget)
  notifyPhaseChange(session.leagueId, phase).catch(() => {})

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

  // Check roster completion when closing ASTA_LIBERA during PRIMO_MERCATO
  if (session.currentPhase === 'ASTA_LIBERA' && session.type === 'PRIMO_MERCATO') {
    const rosterCheck = await canAdvanceFromAstaLibera(session.leagueId)
    if (!rosterCheck.canAdvance) {
      return { success: false, message: rosterCheck.reason || 'Non tutti i manager hanno completato la rosa' }
    }
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

    // Create contracts: 10% of acquisition price, 3 semesters
    for (const roster of rostersWithoutContracts) {
      const salary = calculateDefaultSalary(roster.acquisitionPrice)
      const duration = 3
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
            select: {
              id: true,
              teamName: true,
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
      const rosterEntry = await prisma.playerRoster.create({
        data: {
          leagueMemberId: winningBid.bidderId,
          playerId: auction.playerId,
          acquisitionPrice: winningBid.amount,
          acquisitionType: AcquisitionType.FIRST_MARKET,
          status: RosterStatus.ACTIVE,
        },
      })

      // Create contract: 10% salary (integer, min 1), 3 semesters
      const salary = calculateDefaultSalary(winningBid.amount)
      const duration = 3
      const rescissionClause = calculateRescissionClause(salary, duration)

      await prisma.playerContract.create({
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
        newSalary: salary,
        newDuration: duration,
        newClause: rescissionClause,
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

  // Enrich auction player with mini-stats from apiFootballStats JSON blob
  const enrichedAuction = auction && auction.player
    ? { ...auction, player: enrichPlayerWithStats(auction.player as unknown as Record<string, unknown>) }
    : auction

  return {
    success: true,
    data: {
      auction: enrichedAuction,
      userMembership: member,
      session: {
        id: session.id,
        type: session.type,
        currentRole: session.currentRole,
        currentPhase: session.currentPhase,
        auctionTimerSeconds: session.auctionTimerSeconds,
        auctionMode: session.auctionMode,
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
  const startTime = Date.now()
  console.log(`[PLACEBID-TIMING] === Start placeBid ===`)

  const t1 = Date.now()
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      league: true,
      marketSession: true,
    },
  })
  console.log(`[PLACEBID-TIMING] Query auction: ${Date.now() - t1}ms`)

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  // Verifica timer non scaduto (controllo server-side autoritativo)
  const serverNow = new Date()
  if (auction.timerExpiresAt && serverNow > auction.timerExpiresAt) {
    console.log(`[PLACEBID] Bid rifiutata: timer scaduto. Server: ${serverNow.toISOString()}, Expiry: ${auction.timerExpiresAt.toISOString()}`)
    return {
      success: false,
      message: 'Tempo scaduto - asta chiusa',
      data: { reason: 'TIMER_EXPIRED' }
    }
  }

  // Get member
  const t2 = Date.now()
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })
  console.log(`[PLACEBID-TIMING] Query member: ${Date.now() - t2}ms`)

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check budget using bilancio (budget - monteIngaggi)
  const monteIngaggiAuction = await prisma.playerContract.aggregate({
    where: { leagueMemberId: member.id },
    _sum: { salary: true },
  })
  const bilancio = member.currentBudget - (monteIngaggiAuction._sum.salary || 0)

  // Primo Mercato: reserve budget for remaining empty slots (2 per slot = 1 min bid + 1 min salary)
  const isPrimoMercato = auction.marketSession?.type === 'PRIMO_MERCATO'
  let slotReserve = 0
  if (isPrimoMercato) {
    const totalSlots = auction.league.goalkeeperSlots + auction.league.defenderSlots
      + auction.league.midfielderSlots + auction.league.forwardSlots
    const filledSlots = await prisma.playerRoster.count({
      where: { leagueMemberId: member.id, status: 'ACTIVE' },
    })
    const remainingAfter = Math.max(0, totalSlots - filledSlots - 1)
    slotReserve = remainingAfter * 2
  }

  if (amount + calculateDefaultSalary(amount) > bilancio - slotReserve) {
    const maxBid = bilancio - slotReserve
    return { success: false, message: `Budget insufficiente. Offerta massima: ${maxBid}${isPrimoMercato && slotReserve > 0 ? ` (riservati ${slotReserve} per ${slotReserve / 2} slot rimanenti)` : ''}` }
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
  const tPusher = Date.now()
  if (auction.marketSessionId) {
    triggerBidPlaced(auction.marketSessionId, {
      auctionId: auction.id,
      memberId: member.id,
      memberName: bid.bidder.user.username,
      amount: amount,
      playerId: auction.playerId,
      playerName: auction.player.name,
      timestamp: new Date().toISOString(),
      timerExpiresAt: newTimerExpires.toISOString(),
      timerSeconds: timerSeconds,
    })
  }
  console.log(`[PLACEBID-TIMING] Pusher trigger (fire&forget): ${Date.now() - tPusher}ms`)
  console.log(`[PLACEBID-TIMING] === TOTAL: ${Date.now() - startTime}ms ===`)

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

  // Create roster entry
  const rosterEntry = await prisma.playerRoster.create({
    data: {
      leagueMemberId: winner.id,
      playerId: auction.playerId,
      acquisitionPrice: winningBid.amount,
      acquisitionType: AcquisitionType.FIRST_MARKET,
      status: RosterStatus.ACTIVE,
    },
  })

  // Create contract: 10% salary (integer, min 1), 3 semesters
  const salary = calculateDefaultSalary(winningBid.amount)
  const duration = 3
  const rescissionClause = calculateRescissionClause(salary, duration)

  await prisma.playerContract.create({
    data: {
      rosterId: rosterEntry.id,
      leagueMemberId: winner.id,
      salary,
      duration,
      initialSalary: salary,
      initialDuration: duration,
      rescissionClause,
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
    newSalary: salary,
    newDuration: duration,
    newClause: rescissionClause,
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
      quotation: r.player.quotation,
      age: r.player.age,
      apiFootballId: r.player.apiFootballId,
      apiFootballStats: r.player.apiFootballStats,
      statsSyncedAt: r.player.statsSyncedAt,
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
        include: { player: true, contract: true },
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

    // Calculate bilancio for turn eligibility (bilancio < 2 → excluded)
    const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
    const bilancio = m.currentBudget - monteIngaggi

    return {
      memberId: m.id,
      username: m.user.username,
      teamName: m.teamName,
      rosterByRole,
      slotsNeeded,
      bilancio,
      isComplete: Object.values(slotsNeeded).every(s => s <= 0),
      isCurrentRoleComplete: slotsNeeded[currentRole as keyof typeof slotsNeeded] <= 0,
      isExcludedBudget: bilancio < 2,
    }
  })

  // Find current nominator (skip those with complete current role OR insufficient budget)
  let currentNominator = null
  if (turnOrder && turnOrder.length > 0) {
    let searchIndex = currentTurnIndex
    for (let i = 0; i < turnOrder.length; i++) {
      const idx = (searchIndex + i) % turnOrder.length
      const memberId = turnOrder[idx]
      const status = memberStatus.find(m => m.memberId === memberId)
      if (status && !status.isCurrentRoleComplete && !status.isExcludedBudget) {
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

  // M-3: Skip members with bilancio < 2 (budget - monteIngaggi)
  let nextIndex = (currentIndex + 1) % turnOrder.length
  let searchCount = 0
  const skippedMembers: string[] = []
  while (searchCount < turnOrder.length) {
    const candidateId = turnOrder[nextIndex] as string
    const candidate = await prisma.leagueMember.findUnique({
      where: { id: candidateId },
    })
    if (candidate) {
      const monteIngaggi = await prisma.playerContract.aggregate({
        where: { leagueMemberId: candidateId },
        _sum: { salary: true },
      })
      const bilancio = candidate.currentBudget - (monteIngaggi._sum.salary || 0)
      if (bilancio >= 2) {
        break // This member has enough budget
      }
      skippedMembers.push(candidateId)
    }
    nextIndex = (nextIndex + 1) % turnOrder.length
    searchCount++
  }

  // If all members have bilancio < 2, no one can play
  if (searchCount >= turnOrder.length) {
    return {
      success: false,
      message: 'Nessun manager ha bilancio sufficiente (>= 2) per continuare',
      data: { allInsufficientBudget: true, skippedMembers },
    }
  }

  await prisma.marketSession.update({
    where: { id: sessionId },
    data: { currentTurnIndex: nextIndex },
  })

  return {
    success: true,
    message: 'Turno avanzato',
    data: { previousIndex: currentIndex, currentIndex: nextIndex, skippedMembers },
  }
}

// ==================== MANAGER PAUSE REQUEST ====================

export async function requestPause(
  sessionId: string,
  userId: string,
  pauseType: 'nomination' | 'auction'
): Promise<ServiceResult> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
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
    include: { user: { select: { username: true } } },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Send Pusher notification to all (admin will see the request)
  triggerPauseRequested(sessionId, {
    memberId: member.id,
    username: member.user.username,
    type: pauseType,
  })

  return {
    success: true,
    message: 'Richiesta di pausa inviata all\'admin',
  }
}

// ==================== M-1: PAUSE/RESUME AUCTION TIMER ====================

export async function pauseAuction(
  auctionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { marketSession: true },
  })

  if (!auction || !auction.marketSession) {
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

  if (auction.status !== AuctionStatus.ACTIVE) {
    return { success: false, message: 'Puoi mettere in pausa solo un\'asta attiva' }
  }

  // Calculate remaining seconds
  let remainingSeconds = auction.timerSeconds || 30
  if (auction.timerExpiresAt) {
    const remainingMs = auction.timerExpiresAt.getTime() - Date.now()
    remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  }

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: AuctionStatus.AWAITING_RESUME,
      timerExpiresAt: null,
      timerSeconds: remainingSeconds,
      resumeReadyMembers: [],
    },
  })

  return {
    success: true,
    message: `Asta in pausa (${remainingSeconds} secondi rimanenti)`,
    data: { remainingSeconds },
  }
}

export async function resumeAuction(
  auctionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { marketSession: true },
  })

  if (!auction || !auction.marketSession) {
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

  if (auction.status !== AuctionStatus.AWAITING_RESUME) {
    return { success: false, message: 'L\'asta non è in pausa' }
  }

  const remainingSeconds = auction.timerSeconds || 30

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: AuctionStatus.ACTIVE,
      timerExpiresAt: new Date(Date.now() + remainingSeconds * 1000),
      resumeReadyMembers: null,
    },
  })

  return {
    success: true,
    message: `Asta ripresa (${remainingSeconds} secondi)`,
    data: { remainingSeconds },
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

// ==================== M-2: ADMIN CANCEL ACTIVE AUCTION ====================

export async function cancelActiveAuction(
  auctionId: string,
  adminUserId: string,
  reason: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { marketSession: true, player: true },
  })

  if (!auction || !auction.marketSession) {
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

  if (auction.status !== AuctionStatus.ACTIVE && auction.status !== AuctionStatus.PENDING) {
    return { success: false, message: 'Asta non attiva o pendente' }
  }

  // Cancel the auction (no winner)
  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: AuctionStatus.NO_BIDS,
      timerExpiresAt: null,
      endsAt: new Date(),
    },
  })

  // Cancel all bids
  await prisma.auctionBid.updateMany({
    where: { auctionId, isCancelled: false },
    data: { isCancelled: true, cancelledAt: new Date(), cancelledBy: adminUserId },
  })

  // M-7: Audit log
  await prisma.auditLog.create({
    data: {
      userId: adminUserId,
      leagueId: auction.leagueId,
      action: 'AUCTION_CANCELLED_BY_ADMIN',
      entityType: 'Auction',
      entityId: auctionId,
      oldValues: { status: auction.status, playerName: auction.player.name } as never,
      newValues: { status: 'NO_BIDS', reason } as never,
    },
  })

  return {
    success: true,
    message: `Asta per ${auction.player.name} annullata dall'admin. Motivo: ${reason}`,
    data: { auctionId, playerName: auction.player.name },
  }
}

// ==================== M-2: ADMIN RECTIFY COMPLETED TRANSACTION ====================

export async function rectifyTransaction(
  auctionId: string,
  adminUserId: string,
  reason: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      marketSession: true,
      player: true,
      bids: { where: { isWinning: true }, take: 1 },
    },
  })

  if (!auction || !auction.marketSession) {
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

  if (auction.status !== AuctionStatus.COMPLETED) {
    return { success: false, message: 'Solo aste completate possono essere rettificate' }
  }

  if (!auction.winnerId) {
    return { success: false, message: 'Nessun vincitore da rettificare' }
  }

  const winningBid = auction.bids[0]
  if (!winningBid) {
    return { success: false, message: 'Nessuna offerta vincente trovata' }
  }

  // Rollback: restore budget to winner
  await prisma.leagueMember.update({
    where: { id: auction.winnerId },
    data: { currentBudget: { increment: winningBid.amount } },
  })

  // Rollback: remove roster entry and contract
  const roster = await prisma.playerRoster.findFirst({
    where: {
      leagueMemberId: auction.winnerId,
      playerId: auction.playerId,
      status: 'ACTIVE',
    },
    include: { contract: true },
  })

  if (roster) {
    if (roster.contract) {
      await prisma.playerContract.delete({ where: { id: roster.contract.id } })
    }
    await prisma.playerRoster.delete({ where: { id: roster.id } })
  }

  // For RUBATA: also restore seller's roster/contract and deduct seller payment
  if (auction.type === 'RUBATA' && auction.sellerId) {
    // Note: Full rubata rollback is complex (seller's contract was transferred).
    // This is a basic version — the admin may need to manually fix the seller's state.
  }

  // Mark auction as cancelled
  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: AuctionStatus.NO_BIDS,
      winnerId: null,
    },
  })

  // M-7: Audit log
  await prisma.auditLog.create({
    data: {
      userId: adminUserId,
      leagueId: auction.leagueId,
      action: 'TRANSACTION_RECTIFIED_BY_ADMIN',
      entityType: 'Auction',
      entityId: auctionId,
      oldValues: {
        winnerId: auction.winnerId,
        amount: winningBid.amount,
        playerName: auction.player.name,
      } as never,
      newValues: { status: 'NO_BIDS', reason } as never,
    },
  })

  return {
    success: true,
    message: `Transazione rettificata: ${auction.player.name}. Budget restituito (${winningBid.amount}). Motivo: ${reason}`,
    data: {
      auctionId,
      playerName: auction.player.name,
      refundedAmount: winningBid.amount,
    },
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

  // Find current nominator (skip those with complete current role OR insufficient budget)
  let currentNominatorId: string | null = null
  for (let i = 0; i < turnOrder.length; i++) {
    const idx = (currentTurnIndex + i) % turnOrder.length
    const memberId = turnOrder[idx]

    // Get this member's roster with contracts
    const m = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      include: {
        roster: {
          where: { status: 'ACTIVE' },
          include: { player: true, contract: true },
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

      // Check bilancio >= 2 (min bid 1 + min salary 1)
      const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
      const bilancio = m.currentBudget - monteIngaggi

      if ((mRoster[currentRole as keyof typeof mRoster] ?? 0) < (slotLimits[currentRole] ?? 0) && bilancio >= 2) {
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

  // Get contract info for winner (for post-acquisition modification)
  let winnerContractInfo = null
  if (auction.winnerId === member.id && auction.status === 'COMPLETED') {
    const roster = await prisma.playerRoster.findFirst({
      where: {
        leagueMemberId: member.id,
        playerId: auction.playerId,
        status: RosterStatus.ACTIVE,
      },
      include: { contract: true, player: true },
    })
    if (roster?.contract) {
      winnerContractInfo = {
        contractId: roster.contract.id,
        rosterId: roster.id,
        playerId: auction.playerId,
        playerName: roster.player.name,
        playerTeam: roster.player.team,
        playerPosition: roster.player.position,
        salary: roster.contract.salary,
        duration: roster.contract.duration,
        initialSalary: roster.contract.initialSalary,
        rescissionClause: roster.contract.rescissionClause,
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
      winnerContractInfo, // For contract modification modal
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

  // Get contract info if there's a winner
  let contractInfo = null
  if (recentCompletedAuction.winnerId) {
    const winnerRoster = await prisma.playerRoster.findFirst({
      where: {
        leagueMemberId: recentCompletedAuction.winnerId,
        playerId: recentCompletedAuction.playerId,
        status: RosterStatus.ACTIVE,
      },
      include: { contract: true },
    })
    if (winnerRoster?.contract) {
      contractInfo = {
        salary: winnerRoster.contract.salary,
        duration: winnerRoster.contract.duration,
        rescissionClause: winnerRoster.contract.rescissionClause,
      }
    }
  }

  // Enrich player with stats
  const enrichedPlayer = enrichPlayerWithStats(recentCompletedAuction.player as unknown as Record<string, unknown>)

  return {
    success: true,
    data: {
      pendingAuction: {
        id: recentCompletedAuction.id,
        player: enrichedPlayer,
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
        contractInfo,
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

  // Find current nominator (who should call — skip completed role OR insufficient budget)
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
          include: { player: true, contract: true },
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

      // Check bilancio >= 2 (min bid 1 + min salary 1)
      const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
      const bilancio = m.currentBudget - monteIngaggi

      if ((mRoster[currentRole as keyof typeof mRoster] ?? 0) < (slotLimits[currentRole] ?? 0) && bilancio >= 2) {
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

  // Check if we're the only member or IN_PRESENCE mode (auto-start)
  const totalMembers = await prisma.leagueMember.count({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (totalMembers === 1 || session.auctionMode === 'IN_PRESENCE') {
    // Solo member or in-presence mode: start auction immediately (skip ready-check)
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

  // Get all members with usernames for Pusher event
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
    },
  })

  // Build ready and pending lists for the Pusher event
  const readyMembersList = allMembers
    .filter(m => newReadyMembers.includes(m.id))
    .map(m => ({ id: m.id, username: m.user.username }))
  const pendingMembersList = allMembers
    .filter(m => !newReadyMembers.includes(m.id))
    .map(m => ({ id: m.id, username: m.user.username }))

  // Trigger Pusher event for member ready (fire and forget)
  triggerMemberReady(sessionId, {
    memberId: member.id,
    memberName: member.user.username,
    isReady: true,
    readyCount: newReadyMembers.length,
    totalMembers: allMembers.length,
    readyMembers: readyMembersList,
    pendingMembers: pendingMembersList,
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

  // Enrich player with stats
  const enrichedPlayer = session.pendingNominationPlayer
    ? enrichPlayerWithStats(session.pendingNominationPlayer as unknown as Record<string, unknown>)
    : null

  return {
    success: true,
    data: {
      hasPendingNomination: true,
      nominatorConfirmed: session.nominatorConfirmed,
      player: enrichedPlayer,
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
        include: { player: true, contract: true },
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

  type RosterSlotData = { id: string; playerId: string; playerName: string; playerTeam: string; acquisitionPrice: number; age?: number | null; apiFootballId?: number | null; contract?: { salary: number; duration: number; rescissionClause: number } | null }
  const rosterByPosition: {
    P: RosterSlotData[]
    D: RosterSlotData[]
    C: RosterSlotData[]
    A: RosterSlotData[]
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
        age: r.player.age ?? null,
        apiFootballId: r.player.apiFootballId ?? null,
        contract: r.contract ? {
          salary: r.contract.salary,
          duration: r.contract.duration,
          rescissionClause: r.contract.rescissionClause,
        } : null,
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
        include: { player: true, contract: true },
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
        // Also check bilancio >= 2 (min bid 1 + min salary 1)
        const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
        const bilancio = m.currentBudget - monteIngaggi
        if (roleCount < slotLimits[currentRole as keyof typeof slotLimits] && bilancio >= 2) {
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
        quotation: r.player.quotation,
        contract: r.contract ? {
          salary: r.contract.salary,
          duration: r.contract.duration,
          rescissionClause: r.contract.rescissionClause,
        } : null,
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

  // Check auction is completed (in svincolati flow, auction is COMPLETED when PENDING_ACK modal shows)
  if (auction.status !== 'COMPLETED') {
    return { success: false, message: 'Puoi fare ricorso solo su aste completate' }
  }

  // Nessun limite al numero di ricorsi - può essere usato per gestire disconnessioni
  // durante l'asta da parte di qualsiasi manager

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
    try {
      // Annulla la transazione
      // 1. Remove the player from winner's roster (only if there was a winner)
      if (appeal.auction.winnerId) {
        // Check if roster entry exists before trying to delete
        const existingRoster = await prisma.playerRoster.findFirst({
          where: {
            leagueMemberId: appeal.auction.winnerId,
            playerId: appeal.auction.playerId,
            status: 'ACTIVE',
          },
        })

        if (existingRoster) {
          // 2. Delete any contract for this roster first (foreign key constraint)
          await prisma.playerContract.deleteMany({
            where: { rosterId: existingRoster.id },
          })

          // Delete the roster entry (instead of updating to RELEASED to avoid unique constraint)
          await prisma.playerRoster.delete({
            where: { id: existingRoster.id },
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

    // 6. Metti l'asta in AWAITING_RESUME - tutti devono confermare di essere pronti
    // Il timer NON parte ancora - partirà quando tutti saranno pronti
    const timerSeconds = appeal.auction.marketSession?.svincolatiTimerSeconds ??
                         appeal.auction.marketSession?.auctionTimerSeconds ?? 30

    await prisma.auction.update({
      where: { id: appeal.auctionId },
      data: {
        status: AuctionStatus.AWAITING_RESUME,
        winnerId: null,
        // currentPrice rimane invariato - l'asta riprenderà dall'ultima offerta
        timerExpiresAt: null, // Timer non parte ancora
        timerSeconds,
        endsAt: null,
        appealDecisionAcks: [],
        resumeReadyMembers: [], // Tutti devono confermare
      },
    })

    // 7. Se è un'asta svincolati, aggiorna lo stato della sessione
    if (appeal.auction.marketSession?.currentPhase === 'ASTA_SVINCOLATI') {
      await prisma.marketSession.update({
        where: { id: appeal.auction.marketSessionId! },
        data: {
          svincolatiState: 'AWAITING_RESUME',
          svincolatiTimerStartedAt: null,
          svincolatiPendingAck: null, // Pulisci il pending ack precedente
        },
      })
    }

    // 8. Le offerte NON vengono cancellate - l'asta riprende da dove era

    // 9. Mark appeal as accepted
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
      message: 'Ricorso accettato. L\'asta riprende immediatamente.',
      data: {
        sessionId: appeal.auction.marketSessionId,
        auctionId: appeal.auctionId,
        leagueId: appeal.auction.leagueId,
        isSvincolati: appeal.auction.marketSession?.currentPhase === 'ASTA_SVINCOLATI',
      },
    }
    } catch (error) {
      console.error('[resolveAppeal] Error accepting appeal:', error)
      return {
        success: false,
        message: `Errore nell'accettare il ricorso: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
      }
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
      marketSession: true,
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

      // Se è un'asta svincolati, avanza al prossimo turno
      if (auction.marketSession?.currentPhase === 'ASTA_SVINCOLATI' &&
          auction.marketSession?.svincolatiState === 'PENDING_ACK') {
        const turnOrder = (auction.marketSession.svincolatiTurnOrder as string[] | null) || []
        const passedMembers = (auction.marketSession.svincolatiPassedMembers as string[] | null) || []
        const currentTurnIndex = auction.marketSession.svincolatiCurrentTurnIndex ?? 0
        const previousNominatorId = auction.marketSession.svincolatiPendingNominatorId

        // Reset passed state for nominator (they didn't pass, they called)
        const newPassedMembers = previousNominatorId
          ? passedMembers.filter(id => id !== previousNominatorId)
          : passedMembers

        // Find next member who hasn't passed
        let nextIndex = (currentTurnIndex + 1) % turnOrder.length
        let searchCount = 0
        while (newPassedMembers.includes(turnOrder[nextIndex]) && searchCount < turnOrder.length) {
          nextIndex = (nextIndex + 1) % turnOrder.length
          searchCount++
        }

        // Check if all remaining members have passed
        const activeMembers = turnOrder.filter(id => !newPassedMembers.includes(id))
        if (activeMembers.length === 0) {
          // All passed - complete phase
          await prisma.marketSession.update({
            where: { id: auction.marketSessionId! },
            data: {
              svincolatiState: 'COMPLETED',
              svincolatiPendingPlayerId: null,
              svincolatiPendingNominatorId: null,
              svincolatiNominatorConfirmed: false,
              svincolatiPendingAck: null,
              svincolatiReadyMembers: [],
            },
          })
        } else {
          // Update to next turn
          await prisma.marketSession.update({
            where: { id: auction.marketSessionId! },
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
        }
      }

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
    include: { marketSession: true },
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

    // Se è un'asta svincolati, aggiorna anche lo stato della sessione
    if (auction.marketSession?.currentPhase === 'ASTA_SVINCOLATI') {
      await prisma.marketSession.update({
        where: { id: auction.marketSessionId! },
        data: {
          svincolatiState: 'AUCTION',
          svincolatiTimerStartedAt: new Date(),
        },
      })
    }

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
    include: { marketSession: true },
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

  // Se è un'asta svincolati, aggiorna anche lo stato della sessione
  if (auction.marketSession?.currentPhase === 'ASTA_SVINCOLATI') {
    await prisma.marketSession.update({
      where: { id: auction.marketSessionId! },
      data: {
        svincolatiState: 'AUCTION',
        svincolatiTimerStartedAt: new Date(),
      },
    })
  }

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
      marketSession: true,
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

    // Se è un'asta svincolati, avanza al prossimo turno
    if (auction.marketSession?.currentPhase === 'ASTA_SVINCOLATI' &&
        auction.marketSession?.svincolatiState === 'PENDING_ACK') {
      const turnOrder = (auction.marketSession.svincolatiTurnOrder as string[] | null) || []
      const passedMembers = (auction.marketSession.svincolatiPassedMembers as string[] | null) || []
      const currentTurnIndex = auction.marketSession.svincolatiCurrentTurnIndex ?? 0
      const previousNominatorId = auction.marketSession.svincolatiPendingNominatorId

      // Reset passed state for nominator (they didn't pass, they called)
      const newPassedMembers = previousNominatorId
        ? passedMembers.filter(id => id !== previousNominatorId)
        : passedMembers

      // Find next member who hasn't passed
      let nextIndex = (currentTurnIndex + 1) % turnOrder.length
      let searchCount = 0
      while (newPassedMembers.includes(turnOrder[nextIndex]) && searchCount < turnOrder.length) {
        nextIndex = (nextIndex + 1) % turnOrder.length
        searchCount++
      }

      // Check if all remaining members have passed
      const activeMembers = turnOrder.filter(id => !newPassedMembers.includes(id))
      if (activeMembers.length === 0) {
        // All passed - complete phase
        await prisma.marketSession.update({
          where: { id: auction.marketSessionId! },
          data: {
            svincolatiState: 'COMPLETED',
            svincolatiPendingPlayerId: null,
            svincolatiPendingNominatorId: null,
            svincolatiNominatorConfirmed: false,
            svincolatiPendingAck: null,
            svincolatiReadyMembers: [],
          },
        })
      } else {
        // Update to next turn
        await prisma.marketSession.update({
          where: { id: auction.marketSessionId! },
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
      }
    }

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

        // Create default contract (10% of acquisition price, integer min 1, 3 semesters)
        const salary = calculateDefaultSalary(finalPrice)
        const duration = 3
        const rescissionClause = calculateRescissionClause(salary, duration)

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

  // NOTE: Non chiudiamo la sessione automaticamente.
  // L'admin deve chiuderla esplicitamente dal pannello admin.

  return {
    success: true,
    message: `Rose completate! ${totalPlayersAdded} giocatori aggiunti, ${totalContractsCreated} contratti creati. Chiudi la sessione manualmente.`,
    data: {
      totalPlayersAdded,
      totalContractsCreated,
      memberResults: results,
    },
  }
}
