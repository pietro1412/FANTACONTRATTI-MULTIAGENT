import { PrismaClient, MemberStatus, RosterStatus, AcquisitionType } from '@prisma/client'
import { recordMovement } from './movement.service'
import {
  createContractHistoryEntry,
  createContractHistoryEntries,
  createPhaseStartSnapshot,
  createPhaseEndSnapshot,
} from './contract-history.service'
import type { CreateContractHistoryInput, ContractEventType } from '../types/contract-history'
import { computeSeasonStatsBatch, type ComputedSeasonStats } from './player-stats.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// Moltiplicatori per calcolo clausola rescissione (da specifica)
const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,  // 4 semestri = moltiplicatore 11
  3: 9,   // 3 semestri = moltiplicatore 9
  2: 7,   // 2 semestri = moltiplicatore 7
  1: 3,   // 1 semestre = moltiplicatore 3
}

const MAX_DURATION = 4 // Max 4 semestri
const MIN_SALARY_PERCENTAGE = 0.1 // 10% del prezzo acquisto per acquisti non-PRIMO MERCATO
const MAX_ROSTER_SIZE = 29 // Massimo giocatori in rosa dopo consolidamento

// M-12: Runtime validation to ensure budget never goes negative
export async function validateBudgetNotNegative(memberId: string): Promise<boolean> {
  const member = await prisma.leagueMember.findUnique({
    where: { id: memberId },
    select: { currentBudget: true },
  })
  return member ? member.currentBudget >= 0 : true
}

function getMultiplier(duration: number): number {
  return DURATION_MULTIPLIERS[duration] ?? 3
}

export function calculateRescissionClause(salary: number, duration: number): number {
  return salary * getMultiplier(duration)
}

export function calculateDefaultSalary(auctionPrice: number): number {
  return Math.max(1, Math.round(auctionPrice / 10))
}

// Costo taglio = (ingaggio × durata rimanente) / 2
export function calculateReleaseCost(salary: number, duration: number): number {
  return Math.ceil((salary * duration) / 2)
}

// Verifica se la lega è in fase CONTRATTI
async function isInContrattiPhase(leagueId: string): Promise<boolean> {
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })
  return !!activeSession
}

// Validazione rinnovo secondo le regole di business
// Regole:
// - L'ingaggio può essere aumentato liberamente (ma non diminuito)
// - La durata può essere aumentata SOLO se l'ingaggio viene aumentato
// - Caso speciale SPALMA: se durata=1, può ridistribuire ingaggio su più semestri
export function isValidRenewal(
  currentSalary: number,
  currentDuration: number,
  newSalary: number,
  newDuration: number,
  initialSalary: number
): { valid: boolean; reason?: string } {
  // Max duration check
  if (newDuration > MAX_DURATION) {
    return { valid: false, reason: `Durata massima: ${MAX_DURATION} semestri` }
  }

  // Caso SPALMAINGAGGI: durata corrente = 1
  if (currentDuration === 1) {
    // Può spalmare: newSalary * newDuration >= initialSalary
    const isValid = newSalary * newDuration >= initialSalary
    return {
      valid: isValid,
      reason: isValid ? undefined : `Spalma non valido: ${newSalary} x ${newDuration} = ${newSalary * newDuration} < ${initialSalary} (ingaggio iniziale)`
    }
  }

  // Caso normale: validazione rinnovo
  // 1. Ingaggio non può diminuire sotto il valore corrente
  if (newSalary < currentSalary) {
    return { valid: false, reason: `Ingaggio non può diminuire: ${newSalary} < ${currentSalary}` }
  }

  // 2. Durata non può diminuire sotto il valore corrente
  if (newDuration < currentDuration) {
    return { valid: false, reason: `Durata non può diminuire: ${newDuration} < ${currentDuration}` }
  }

  // 3. REGOLA CHIAVE: La durata può aumentare SOLO se l'ingaggio aumenta
  // Se la durata aumenta ma l'ingaggio rimane uguale → NON valido
  if (newDuration > currentDuration && newSalary <= currentSalary) {
    return {
      valid: false,
      reason: `Per aumentare la durata da ${currentDuration} a ${newDuration}, devi prima aumentare l'ingaggio (attuale: ${currentSalary}M)`
    }
  }

  return { valid: true }
}

// ==================== GET CONTRACTS ====================

export async function getContracts(leagueId: string, userId: string): Promise<ServiceResult> {
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

  // Check if in CONTRATTI phase and if user has consolidated
  const activeSession = await prisma.marketSession.findFirst({
    where: { leagueId, status: 'ACTIVE', currentPhase: 'CONTRATTI' },
  })
  const inContrattiPhase = !!activeSession

  // Check consolidation status
  let isConsolidated = false
  if (activeSession) {
    const consolidation = await prisma.contractConsolidation.findUnique({
      where: {
        sessionId_memberId: {
          sessionId: activeSession.id,
          memberId: member.id,
        },
      },
    })
    isConsolidated = !!consolidation
  }

  // Get roster with contracts and draft contracts
  const roster = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: member.id,
      status: RosterStatus.ACTIVE,
    },
    include: {
      player: true,
      contract: {
        select: {
          id: true,
          salary: true,
          duration: true,
          initialSalary: true,
          initialDuration: true,
          rescissionClause: true,
          draftSalary: true,
          draftDuration: true,
          draftReleased: true,
          draftExitDecision: true,
          preConsolidationSalary: true,
          preConsolidationDuration: true,
        },
      },
      draftContract: true,
    },
    orderBy: {
      player: {
        position: 'asc',
      },
    },
  })

  // Compute season stats for all players in batch (efficient single query)
  const allPlayerIds = roster.map(r => r.playerId)
  const statsMap = await computeSeasonStatsBatch(allPlayerIds)

  // Fetch indemnity amounts for ESTERO players from individual "Indennizzo - PlayerName" categories
  // (activeSession is already defined above for CONTRATTI phase check)
  // Map: playerName -> indemnity amount (from consolidated individual categories)
  const playerIndemnityAmounts: Record<string, number> = {}
  let indennizzoEsteroDefault = 50 // fallback if no individual category exists
  if (activeSession) {
    // Get base amount from "Indennizzo Partenza Estero"
    const baseCategory = await prisma.prizeCategory.findFirst({
      where: {
        marketSessionId: activeSession.id,
        name: 'Indennizzo Partenza Estero',
        isSystemPrize: true,
      },
      include: {
        managerPrizes: { where: { leagueMemberId: member.id } },
      },
    })
    if (baseCategory?.managerPrizes[0]) {
      indennizzoEsteroDefault = baseCategory.managerPrizes[0].amount
    }

    // Get individual "Indennizzo - PlayerName" categories (created at consolidation)
    const individualCategories = await prisma.prizeCategory.findMany({
      where: {
        marketSessionId: activeSession.id,
        name: { startsWith: 'Indennizzo - ' },
        isSystemPrize: true,
      },
      include: {
        managerPrizes: { where: { leagueMemberId: member.id } },
      },
    })
    for (const cat of individualCategories) {
      const playerName = cat.name.replace('Indennizzo - ', '')
      if (cat.managerPrizes[0]) {
        playerIndemnityAmounts[playerName] = cat.managerPrizes[0].amount
      }
    }
  }

  // Separate players with and without contracts
  const playersWithContract = roster.filter(r => r.contract)
  const playersWithoutContract = roster.filter(r => !r.contract)

  // If consolidated, fetch renewal history to show what changed
  // This map contains ONLY contracts that were actually modified (RENEWAL or SPALMA)
  let modifiedContractsMap: Map<string, { newSalary: number; newDuration: number; previousSalary: number; previousDuration: number }> = new Map()
  if (isConsolidated && activeSession) {
    const renewalHistory = await prisma.contractHistory.findMany({
      where: {
        leagueMemberId: member.id,
        marketSessionId: activeSession.id,
        eventType: { in: ['RENEWAL', 'SPALMA'] },
        contractId: { not: null },
      },
      select: {
        contractId: true,
        newSalary: true,
        newDuration: true,
        previousSalary: true,
        previousDuration: true,
      },
    })
    for (const h of renewalHistory) {
      if (h.contractId && h.newSalary != null && h.newDuration != null) {
        modifiedContractsMap.set(h.contractId, {
          newSalary: h.newSalary,
          newDuration: h.newDuration,
          previousSalary: h.previousSalary || 0,
          previousDuration: h.previousDuration || 0,
        })
      }
    }
  }

  // Add calculated fields for contracts (including draft values)
  const contracts = playersWithContract.map(r => {
    const contract = r.contract!
    const rescissionClause = calculateRescissionClause(contract.salary, contract.duration)
    const isExitedPlayer = r.player.listStatus === 'NOT_IN_LIST' && r.player.exitReason != null && r.player.exitReason !== 'RITIRATO'
    const exitReason = r.player.exitReason

    // Check if this contract was modified during consolidation (has RENEWAL/SPALMA history)
    const historyEntry = modifiedContractsMap.get(contract.id)
    const wasModified = !!historyEntry

    // Display values depend on consolidation state
    let displaySalary = contract.salary
    let displayDuration = contract.duration
    let displayDraftSalary: number | null = contract.draftSalary
    let displayDraftDuration: number | null = contract.draftDuration

    if (isConsolidated) {
      if (historyEntry) {
        // Contract was modified: show previous as "current", new as "draft"
        displaySalary = historyEntry.previousSalary
        displayDuration = historyEntry.previousDuration
        displayDraftSalary = historyEntry.newSalary
        displayDraftDuration = historyEntry.newDuration
      } else {
        // Contract was NOT modified: show current values in both columns
        // (current = new, no change)
        displayDraftSalary = contract.salary
        displayDraftDuration = contract.duration
      }
    }

    return {
      id: contract.id,
      salary: displaySalary,
      duration: displayDuration,
      initialSalary: contract.initialSalary,
      initialDuration: contract.initialDuration,
      rescissionClause,
      canRenew: true,  // Tutti possono rinnovare (aumentare ingaggio), anche con durata max
      canSpalmare: displayDuration === 1,
      // Draft values (if any saved, or post-consolidation values from history)
      draftSalary: displayDraftSalary,
      draftDuration: displayDraftDuration,
      draftReleased: contract.draftReleased,  // Marcato per taglio
      draftExitDecision: contract.draftExitDecision,  // null=INDECISO, "KEEP", "RELEASE"
      // Exited player info
      isExitedPlayer,
      exitReason,
      indemnityCompensation: (isExitedPlayer && exitReason === 'ESTERO')
        ? (playerIndemnityAmounts[r.player.name] ?? indennizzoEsteroDefault)
        : 0,
      // Flag to indicate if contract was modified during this session's consolidation
      wasModified,
      roster: {
        id: r.id,
        player: {
          ...r.player,
          computedStats: statsMap.get(r.playerId) || null,
        },
        acquisitionPrice: r.acquisitionPrice,
        acquisitionType: r.acquisitionType,
      },
    }
  })

  // Query released players from ContractHistory (only after consolidation)
  let releasedPlayers: Array<{
    id: string
    playerName: string
    playerTeam: string
    playerPosition: string
    salary: number
    duration: number
    releaseCost: number
    releaseType: string
    indemnityAmount?: number
  }> = []

  // Track total renewal cost for the formula
  let totalRenewalCost = 0

  if (isConsolidated && activeSession) {
    const releaseHistory = await prisma.contractHistory.findMany({
      where: {
        leagueMemberId: member.id,
        marketSessionId: activeSession.id,
        eventType: { in: ['RELEASE_NORMAL', 'RELEASE_ESTERO', 'RELEASE_RETROCESSO'] },
      },
      include: {
        player: { select: { id: true, name: true, team: true, position: true } },
      },
    })

    releasedPlayers = releaseHistory.map(h => ({
      id: h.id,
      playerName: h.player.name,
      playerTeam: h.player.team,
      playerPosition: h.player.position,
      salary: h.previousSalary || 0,
      duration: h.previousDuration || 0,
      releaseCost: h.cost || 0,
      releaseType: h.eventType,
      indemnityAmount: h.eventType === 'RELEASE_ESTERO' ? (h.income || 0) : undefined,
    }))

    // Fetch net salary change from ContractHistory (RENEWAL and SPALMA)
    // Positive = cost (salary increases), Negative = savings (salary decreases from spalma)
    const salaryChangeHistory = await prisma.contractHistory.findMany({
      where: {
        leagueMemberId: member.id,
        marketSessionId: activeSession.id,
        eventType: { in: ['RENEWAL', 'SPALMA'] },
      },
      select: { previousSalary: true, newSalary: true },
    })
    totalRenewalCost = salaryChangeHistory.reduce((sum, h) => {
      const diff = (h.newSalary || 0) - (h.previousSalary || 0)
      return sum + diff
    }, 0)
  }

  // Players needing contract setup (include any saved draft values)
  const pendingContracts = playersWithoutContract.map(r => ({
    rosterId: r.id,
    player: {
      ...r.player,
      computedStats: statsMap.get(r.playerId) || null,
    },
    acquisitionPrice: r.acquisitionPrice,
    acquisitionType: r.acquisitionType,
    minSalary: r.acquisitionType === AcquisitionType.FIRST_MARKET
      ? 1
      : Math.ceil(r.acquisitionPrice * MIN_SALARY_PERCENTAGE),
    // Draft values (if any saved)
    draftSalary: r.draftContract?.salary || null,
    draftDuration: r.draftContract?.duration || null,
  }))

  // After consolidation, use preConsolidationBudget as the "Budget Iniziale"
  // so the formula (Budget - Ingaggi - Tagli + Indennizzi = Residuo) displays correctly
  const budgetToShow = isConsolidated && member.preConsolidationBudget !== null
    ? member.preConsolidationBudget
    : member.currentBudget

  return {
    success: true,
    data: {
      contracts,
      pendingContracts,
      releasedPlayers,  // Include released players for post-consolidation view
      memberBudget: budgetToShow,
      inContrattiPhase,
      isConsolidated,  // Include consolidation status
      indennizzoEsteroAmount: indennizzoEsteroDefault,
      totalRenewalCost,  // Total cost of renewals for the formula
    },
  }
}

export async function getContractById(
  contractId: string,
  userId: string
): Promise<ServiceResult> {
  const contract = await prisma.playerContract.findUnique({
    where: { id: contractId },
    include: {
      roster: {
        include: {
          player: true,
          leagueMember: {
            include: {
              user: {
                select: { id: true, username: true },
              },
              league: true,
            },
          },
        },
      },
    },
  })

  if (!contract) {
    return { success: false, message: 'Contratto non trovato' }
  }

  // Verify ownership
  if (contract.roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non sei il proprietario di questo contratto' }
  }

  const rescissionClause = calculateRescissionClause(contract.salary, contract.duration)
  const canRenew = true  // Tutti possono rinnovare (aumentare ingaggio)
  const canSpalmare = contract.duration === 1
  const inContrattiPhase = await isInContrattiPhase(contract.roster.leagueMember.leagueId)

  return {
    success: true,
    data: {
      contract: {
        ...contract,
        rescissionClause,
        canRenew,
        canSpalmare,
        maxDuration: MAX_DURATION,
      },
      memberBudget: contract.roster.leagueMember.currentBudget,
      inContrattiPhase,
    },
  }
}

// ==================== CREATE CONTRACT ====================

export async function createContract(
  rosterId: string,
  userId: string,
  salary: number,
  duration: number
): Promise<ServiceResult> {
  // Get roster with member info
  const roster = await prisma.playerRoster.findUnique({
    where: { id: rosterId },
    include: {
      player: true,
      contract: true,
      leagueMember: {
        include: {
          user: { select: { id: true } },
          league: true,
        },
      },
    },
  })

  if (!roster) {
    return { success: false, message: 'Giocatore non trovato nella rosa' }
  }

  // Verify ownership
  if (roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non sei il proprietario di questo giocatore' }
  }

  // Check if already has contract
  if (roster.contract) {
    return { success: false, message: 'Questo giocatore ha già un contratto' }
  }

  // Check if in CONTRATTI phase
  const inContrattiPhase = await isInContrattiPhase(roster.leagueMember.leagueId)
  if (!inContrattiPhase) {
    return { success: false, message: 'Puoi impostare contratti solo durante la fase CONTRATTI' }
  }

  // Validate duration
  if (duration < 1 || duration > MAX_DURATION) {
    return { success: false, message: `Durata deve essere tra 1 e ${MAX_DURATION} semestri` }
  }

  // Validate salary
  if (salary < 1) {
    return { success: false, message: 'Ingaggio minimo: 1' }
  }

  // Check minimum salary rule for non-PRIMO MERCATO acquisitions
  if (roster.acquisitionType !== AcquisitionType.FIRST_MARKET) {
    const minSalary = Math.ceil(roster.acquisitionPrice * MIN_SALARY_PERCENTAGE)
    if (salary < minSalary) {
      return { success: false, message: `Ingaggio minimo per questo giocatore: ${minSalary} (10% del prezzo acquisto ${roster.acquisitionPrice})` }
    }
  }

  // Calculate rescission clause
  const rescissionClause = calculateRescissionClause(salary, duration)

  // Create contract
  const contract = await prisma.playerContract.create({
    data: {
      rosterId,
      leagueMemberId: roster.leagueMember.id,
      salary,
      duration,
      initialSalary: salary,
      initialDuration: duration,
      rescissionClause,
    },
    include: {
      roster: {
        include: {
          player: true,
        },
      },
    },
  })

  return {
    success: true,
    message: `Contratto impostato per ${roster.player.name}: ${salary}/sem x ${duration} semestri`,
    data: {
      contract: {
        ...contract,
        rescissionClause,
        canRenew: true,  // Tutti possono rinnovare
        canSpalmare: duration === 1,
      },
    },
  }
}

// ==================== RENEW CONTRACT ====================

export async function renewContract(
  contractId: string,
  userId: string,
  newSalary: number,
  newDuration: number
): Promise<ServiceResult> {
  // Get contract with all relations
  const contract = await prisma.playerContract.findUnique({
    where: { id: contractId },
    include: {
      roster: {
        include: {
          player: true,
          leagueMember: {
            include: {
              user: { select: { id: true } },
              league: true,
            },
          },
        },
      },
    },
  })

  if (!contract) {
    return { success: false, message: 'Contratto non trovato' }
  }

  // Verify ownership
  if (contract.roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non sei il proprietario di questo contratto' }
  }

  // Block contract modification for players acquired via trade
  if (contract.roster.acquisitionType === 'TRADE') {
    return { success: false, message: 'Non puoi modificare il contratto di un giocatore acquisito tramite scambio' }
  }

  // Check if in CONTRATTI phase
  const inContrattiPhase = await isInContrattiPhase(contract.roster.leagueMember.leagueId)
  if (!inContrattiPhase) {
    return { success: false, message: 'Puoi rinnovare contratti solo durante la fase CONTRATTI' }
  }

  // P0-9 FIX: Block standalone renewal if member has already consolidated.
  // After consolidation, contract modifications must go through saveDrafts → consolidateContracts.
  // This is a legacy path — the preferred flow is the consolidation pipeline.
  const activeSessionForConsolidation = await prisma.marketSession.findFirst({
    where: {
      leagueId: contract.roster.leagueMember.leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })
  if (activeSessionForConsolidation) {
    const existingConsolidation = await prisma.contractConsolidation.findUnique({
      where: {
        sessionId_memberId: {
          sessionId: activeSessionForConsolidation.id,
          memberId: contract.roster.leagueMember.id,
        },
      },
    })
    if (existingConsolidation) {
      return {
        success: false,
        message: 'Non puoi modificare contratti dopo il consolidamento. Hai già consolidato i tuoi contratti.',
      }
    }
  }

  // Validate salary
  if (newSalary < 1) {
    return { success: false, message: 'Ingaggio minimo: 1' }
  }

  // Validate duration
  if (newDuration < 1 || newDuration > MAX_DURATION) {
    return { success: false, message: `Durata deve essere tra 1 e ${MAX_DURATION} semestri` }
  }

  // Validate renewal according to business rules
  const validation = isValidRenewal(
    contract.salary,
    contract.duration,
    newSalary,
    newDuration,
    contract.initialSalary
  )

  if (!validation.valid) {
    return { success: false, message: validation.reason }
  }

  // Calculate renewal cost (difference in total salary commitment)
  const currentValue = contract.salary * contract.duration
  const newValue = newSalary * newDuration
  const renewalCost = Math.max(0, newValue - currentValue)

  // Renewal affects monte ingaggi (salary commitment), NOT budget.
  // No budget check needed — budget is only for auction/rubata cash flows.
  const member = contract.roster.leagueMember

  // Calculate new rescission clause
  const newRescissionClause = calculateRescissionClause(newSalary, newDuration)

  // Update contract
  const updatedContract = await prisma.playerContract.update({
    where: { id: contractId },
    data: {
      salary: newSalary,
      duration: newDuration,
      rescissionClause: newRescissionClause,
      renewalHistory: {
        ...(contract.renewalHistory as object || {}),
        [new Date().toISOString()]: {
          oldSalary: contract.salary,
          oldDuration: contract.duration,
          newSalary,
          newDuration,
          cost: renewalCost,
        },
      },
    },
    include: {
      roster: {
        include: {
          player: true,
        },
      },
    },
  })

  // NOTE: Renewal does NOT decrement budget. Budget is cash liquidity for
  // auctions/rubate. Renewal only changes the salary commitment (monte ingaggi),
  // which is tracked via the contract's salary field, not the member's currentBudget.

  // Get active market session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId: contract.roster.leagueMember.leagueId,
      status: 'ACTIVE',
    },
  })

  // Record movement for CONTRACT_RENEW
  await recordMovement({
    leagueId: contract.roster.leagueMember.leagueId,
    playerId: contract.roster.playerId,
    movementType: 'CONTRACT_RENEW',
    toMemberId: member.id, // Player stays with the same owner
    price: renewalCost,
    oldSalary: contract.salary,
    oldDuration: contract.duration,
    oldClause: calculateRescissionClause(contract.salary, contract.duration),
    newSalary,
    newDuration,
    newClause: newRescissionClause,
    marketSessionId: activeSession?.id,
  })

  return {
    success: true,
    message: `Contratto di ${contract.roster.player.name} rinnovato. Costo: ${renewalCost}`,
    data: {
      contract: updatedContract,
      renewalCost,
      newBudget: member.currentBudget, // Budget unchanged — renewal only affects monte ingaggi
    },
  }
}

// ==================== RELEASE PLAYER ====================

export async function releasePlayer(
  contractId: string,
  userId: string
): Promise<ServiceResult> {
  // Get contract with all relations
  const contract = await prisma.playerContract.findUnique({
    where: { id: contractId },
    include: {
      roster: {
        include: {
          player: true,
          leagueMember: {
            include: {
              user: { select: { id: true } },
              league: true,
            },
          },
        },
      },
    },
  })

  if (!contract) {
    return { success: false, message: 'Contratto non trovato' }
  }

  // Verify ownership
  if (contract.roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non sei il proprietario di questo contratto' }
  }

  // Check if in CONTRATTI phase
  const inContrattiPhase = await isInContrattiPhase(contract.roster.leagueMember.leagueId)
  if (!inContrattiPhase) {
    return { success: false, message: 'Puoi svincolare giocatori solo durante la fase CONTRATTI' }
  }

  // P0-9 FIX: Block standalone release if member has already consolidated.
  // After consolidation, releases must go through saveDrafts → consolidateContracts.
  // This is a legacy path — the preferred flow is the consolidation pipeline.
  const activeSessionForConsolidation = await prisma.marketSession.findFirst({
    where: {
      leagueId: contract.roster.leagueMember.leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })
  if (activeSessionForConsolidation) {
    const existingConsolidation = await prisma.contractConsolidation.findUnique({
      where: {
        sessionId_memberId: {
          sessionId: activeSessionForConsolidation.id,
          memberId: contract.roster.leagueMember.id,
        },
      },
    })
    if (existingConsolidation) {
      return {
        success: false,
        message: 'Non puoi svincolare giocatori dopo il consolidamento. Hai già consolidato i tuoi contratti.',
      }
    }
  }

  // M-14: Release cost = 0 for ESTERO/RETROCESSO players
  const player = contract.roster.player
  const isExitedPlayer = player.listStatus === 'NOT_IN_LIST' &&
    (player.exitReason === 'ESTERO' || player.exitReason === 'RETROCESSO')
  const releaseCost = isExitedPlayer ? 0 : calculateReleaseCost(contract.salary, contract.duration)

  // Check budget
  const member = contract.roster.leagueMember
  if (releaseCost > member.currentBudget) {
    return { success: false, message: `Budget insufficiente. Costo taglio: ${releaseCost}, Budget: ${member.currentBudget}` }
  }

  const playerName = player.name

  // Delete contract
  await prisma.playerContract.delete({
    where: { id: contractId },
  })

  // Update roster status to RELEASED
  await prisma.playerRoster.update({
    where: { id: contract.rosterId },
    data: {
      status: RosterStatus.RELEASED,
      releasedAt: new Date(),
    },
  })

  // Deduct budget
  await prisma.leagueMember.update({
    where: { id: member.id },
    data: {
      currentBudget: {
        decrement: releaseCost,
      },
    },
  })

  // Get active market session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId: contract.roster.leagueMember.leagueId,
      status: 'ACTIVE',
    },
  })

  // Record movement for RELEASE (M-14: use specific type for exited players)
  const movementType = isExitedPlayer
    ? (player.exitReason === 'ESTERO' ? 'ABROAD_COMPENSATION' : 'RELEGATION_RELEASE')
    : 'RELEASE'
  await recordMovement({
    leagueId: contract.roster.leagueMember.leagueId,
    playerId: contract.roster.playerId,
    movementType,
    fromMemberId: member.id,
    price: releaseCost,
    oldSalary: contract.salary,
    oldDuration: contract.duration,
    oldClause: calculateRescissionClause(contract.salary, contract.duration),
    marketSessionId: activeSession?.id,
  })

  const releaseMessage = isExitedPlayer
    ? `${playerName} svincolato gratuitamente (${player.exitReason}).`
    : `${playerName} svincolato. Costo taglio: ${releaseCost}M (${contract.salary}×${contract.duration}/2)`

  return {
    success: true,
    message: releaseMessage,
    data: {
      releaseCost,
      newBudget: member.currentBudget - releaseCost,
      isExitedPlayer,
    },
  }
}

// ==================== CALCULATE PREVIEW ====================

export async function previewRenewal(
  contractId: string,
  userId: string,
  newSalary: number,
  newDuration: number
): Promise<ServiceResult> {
  const contract = await prisma.playerContract.findUnique({
    where: { id: contractId },
    include: {
      roster: {
        include: {
          leagueMember: {
            include: {
              user: { select: { id: true } },
            },
          },
        },
      },
    },
  })

  if (!contract) {
    return { success: false, message: 'Contratto non trovato' }
  }

  if (contract.roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Validate renewal
  const validation = isValidRenewal(
    contract.salary,
    contract.duration,
    newSalary,
    newDuration,
    contract.initialSalary
  )

  // Calculate costs
  const currentValue = contract.salary * contract.duration
  const newValue = newSalary * newDuration
  const renewalCost = Math.max(0, newValue - currentValue)
  const newRescissionClause = calculateRescissionClause(newSalary, newDuration)

  return {
    success: true,
    data: {
      currentSalary: contract.salary,
      currentDuration: contract.duration,
      currentClause: calculateRescissionClause(contract.salary, contract.duration),
      initialSalary: contract.initialSalary,
      newSalary,
      newDuration,
      renewalCost,
      newRescissionClause,
      canAfford: renewalCost <= contract.roster.leagueMember.currentBudget,
      isValid: validation.valid,
      validationError: validation.reason,
      isSpalmaingaggi: contract.duration === 1,
    },
  }
}

// ==================== PREVIEW CONTRACT CREATION ====================

export async function previewContract(
  rosterId: string,
  userId: string,
  salary: number,
  duration: number
): Promise<ServiceResult> {
  const roster = await prisma.playerRoster.findUnique({
    where: { id: rosterId },
    include: {
      player: true,
      leagueMember: {
        include: {
          user: { select: { id: true } },
        },
      },
    },
  })

  if (!roster) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  if (roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Calculate minimum salary
  const minSalary = roster.acquisitionType === AcquisitionType.FIRST_MARKET
    ? 1
    : Math.ceil(roster.acquisitionPrice * MIN_SALARY_PERCENTAGE)

  const isValidSalary = salary >= minSalary
  const isValidDuration = duration >= 1 && duration <= MAX_DURATION
  const rescissionClause = calculateRescissionClause(salary, duration)

  return {
    success: true,
    data: {
      player: roster.player,
      acquisitionPrice: roster.acquisitionPrice,
      acquisitionType: roster.acquisitionType,
      minSalary,
      salary,
      duration,
      rescissionClause,
      isValid: isValidSalary && isValidDuration,
      validationError: !isValidSalary
        ? `Ingaggio minimo: ${minSalary}`
        : (!isValidDuration ? `Durata deve essere tra 1 e ${MAX_DURATION}` : undefined),
    },
  }
}

// ==================== CONTRACT CONSOLIDATION ====================

// Get consolidation status for the current manager
export async function getConsolidationStatus(
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

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return {
      success: true,
      data: {
        inContrattiPhase: false,
        isConsolidated: false,
        consolidatedAt: null,
      },
    }
  }

  // Check if manager has consolidated
  const consolidation = await prisma.contractConsolidation.findUnique({
    where: {
      sessionId_memberId: {
        sessionId: activeSession.id,
        memberId: member.id,
      },
    },
  })

  return {
    success: true,
    data: {
      inContrattiPhase: true,
      sessionId: activeSession.id,
      isConsolidated: !!consolidation,
      consolidatedAt: consolidation?.consolidatedAt || null,
    },
  }
}

// Consolidate contracts for the current manager
export async function consolidateContracts(
  leagueId: string,
  userId: string,
  renewals?: { contractId: string; salary: number; duration: number }[],
  newContracts?: { rosterId: string; salary: number; duration: number }[]
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

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Non siamo in fase CONTRATTI' }
  }

  // Check if already consolidated
  const existingConsolidation = await prisma.contractConsolidation.findUnique({
    where: {
      sessionId_memberId: {
        sessionId: activeSession.id,
        memberId: member.id,
      },
    },
  })

  if (existingConsolidation) {
    return { success: false, message: 'Hai già consolidato i tuoi contratti' }
  }

  // Collect history entries to create after transaction succeeds
  const historyEntries: CreateContractHistoryInput[] = []

  // Process all operations in a transaction (with extended timeout for complex consolidations)
  try {
    await prisma.$transaction(async (tx) => {
      // 0. Salva il budget pre-consolidamento PRIMA di qualsiasi modifica
      // Questo permette alla pagina Finanze di mostrare i valori "congelati" durante tutta la fase CONTRATTI
      await tx.leagueMember.update({
        where: { id: member.id },
        data: {
          preConsolidationBudget: member.currentBudget,
        },
      })

      // 1. Process all renewals
      if (renewals && renewals.length > 0) {
        for (const renewal of renewals) {
          const contract = await tx.playerContract.findUnique({
            where: { id: renewal.contractId },
            include: { roster: { include: { leagueMember: true, player: true } } },
          })

          if (!contract || contract.roster.leagueMember.id !== member.id) {
            throw new Error(`Contratto ${renewal.contractId} non valido`)
          }

          // Calculate renewal cost
          const salaryDiff = renewal.salary - contract.salary
          const renewalCost = salaryDiff > 0 ? salaryDiff : 0

          // Calculate new rescission clause
          const multiplier = DURATION_MULTIPLIERS[renewal.duration as keyof typeof DURATION_MULTIPLIERS] || 7
          const newRescissionClause = renewal.salary * multiplier

          // Determine if this is a renewal (increase) or spalma (decrease salary with duration > 1)
          const isSpalma = contract.duration === 1 && renewal.duration > 1
          const eventType: ContractEventType = isSpalma ? 'SPALMA' : 'RENEWAL'

          // Track history entry
          historyEntries.push({
            contractId: contract.id,
            playerId: contract.roster.playerId,
            leagueMemberId: member.id,
            marketSessionId: activeSession.id,
            eventType,
            previousSalary: contract.salary,
            previousDuration: contract.duration,
            previousClause: contract.rescissionClause,
            newSalary: renewal.salary,
            newDuration: renewal.duration,
            newClause: newRescissionClause,
            cost: renewalCost > 0 ? renewalCost : undefined,
            notes: isSpalma
              ? `Spalma: ${contract.salary}/${contract.duration}s → ${renewal.salary}/${renewal.duration}s`
              : `Rinnovo: ${contract.salary} → ${renewal.salary}`,
          })

          // Update contract - save pre-consolidation values for privacy during CONTRATTI phase
          // Only save if not already set (first consolidation)
          await tx.playerContract.update({
            where: { id: renewal.contractId },
            data: {
              // Save original values before applying changes (for privacy to other managers)
              preConsolidationSalary: contract.preConsolidationSalary ?? contract.salary,
              preConsolidationDuration: contract.preConsolidationDuration ?? contract.duration,
              // Apply new values
              salary: renewal.salary,
              duration: renewal.duration,
              rescissionClause: newRescissionClause,
            },
          })
          // NOTE: Rinnovo NON decrementa il budget.
          // Aumenta solo il monte ingaggi (salary), che impatta il bilancio.
          // Vedi docs/BIBBIA-CONTRATTI.md sezione 2.5
        }
      }

      // 2. Process all new contracts
      if (newContracts && newContracts.length > 0) {
        for (const nc of newContracts) {
          const rosterEntry = await tx.playerRoster.findUnique({
            where: { id: nc.rosterId },
            include: { leagueMember: true, contract: true },
          })

          if (!rosterEntry || rosterEntry.leagueMember.id !== member.id) {
            throw new Error(`Roster entry ${nc.rosterId} non valido`)
          }

          if (rosterEntry.contract) {
            throw new Error(`Il giocatore ha già un contratto`)
          }

          // Calculate rescission clause
          const multiplier = DURATION_MULTIPLIERS[nc.duration as keyof typeof DURATION_MULTIPLIERS] || 7
          const rescissionClause = nc.salary * multiplier

          // Create contract
          await tx.playerContract.create({
            data: {
              rosterId: nc.rosterId,
              salary: nc.salary,
              duration: nc.duration,
              initialSalary: nc.salary,
              initialDuration: nc.duration,
              rescissionClause,
            },
          })
        }
      }

      // 2.5 Validate: all exited players must have an explicit decision (KEEP or RELEASE)
      const undecidedExited = await tx.playerContract.findMany({
        where: {
          leagueMemberId: member.id,
          draftExitDecision: null,
          roster: {
            status: RosterStatus.ACTIVE,
            player: {
              listStatus: 'NOT_IN_LIST',
              exitReason: { in: ['RETROCESSO', 'ESTERO'] },
            },
          },
        },
        include: {
          roster: { include: { player: { select: { name: true } } } },
        },
      })

      if (undecidedExited.length > 0) {
        const names = undecidedExited.map(c => c.roster.player.name).join(', ')
        throw new Error(`Devi decidere per tutti i giocatori usciti: ${names}`)
      }

      // 3. Process draft releases (players marked for release)
      const contractsToRelease = await tx.playerContract.findMany({
        where: {
          leagueMemberId: member.id,
          draftReleased: true,
        },
        include: {
          roster: { include: { player: true } },
        },
      })

      // Fetch indemnity amounts for ESTERO players from individual categories
      let indennizzoEsteroDefault = 50
      const baseIndemnityCategory = await tx.prizeCategory.findFirst({
        where: {
          marketSessionId: activeSession.id,
          name: 'Indennizzo Partenza Estero',
          isSystemPrize: true,
        },
        include: {
          managerPrizes: { where: { leagueMemberId: member.id } },
        },
      })
      if (baseIndemnityCategory?.managerPrizes[0]) {
        indennizzoEsteroDefault = baseIndemnityCategory.managerPrizes[0].amount
      }

      // Get individual "Indennizzo - PlayerName" categories for precise amounts
      const individualIndemnityCategories = await tx.prizeCategory.findMany({
        where: {
          marketSessionId: activeSession.id,
          name: { startsWith: 'Indennizzo - ' },
          isSystemPrize: true,
        },
        include: {
          managerPrizes: { where: { leagueMemberId: member.id } },
        },
      })
      const playerIndemnityMap: Record<string, number> = {}
      for (const cat of individualIndemnityCategories) {
        const playerName = cat.name.replace('Indennizzo - ', '')
        if (cat.managerPrizes[0]) {
          playerIndemnityMap[playerName] = cat.managerPrizes[0].amount
        }
      }

      for (const contract of contractsToRelease) {
        const player = contract.roster.player
        const isExitedPlayer = player.listStatus === 'NOT_IN_LIST' && player.exitReason != null

        if (isExitedPlayer) {
          // EXITED PLAYER RELEASE: no release cost
          if (player.exitReason === 'ESTERO') {
            // ESTERO: receive indemnity compensation from individual category or default
            const compensation = playerIndemnityMap[player.name] ?? indennizzoEsteroDefault
            await tx.leagueMember.update({
              where: { id: member.id },
              data: { currentBudget: { increment: compensation } },
            })

            // Track history entry for ESTERO release
            historyEntries.push({
              contractId: contract.id,
              playerId: player.id,
              leagueMemberId: member.id,
              marketSessionId: activeSession.id,
              eventType: 'RELEASE_ESTERO',
              previousSalary: contract.salary,
              previousDuration: contract.duration,
              previousClause: contract.rescissionClause,
              income: compensation,
              notes: `Rilascio ${player.name} (ESTERO) - Indennizzo: ${compensation}`,
            })

            // Track indemnity as separate entry
            historyEntries.push({
              playerId: player.id,
              leagueMemberId: member.id,
              marketSessionId: activeSession.id,
              eventType: 'INDEMNITY_RECEIVED',
              income: compensation,
              notes: `Indennizzo ricevuto per ${player.name}`,
            })

            await recordMovement({
              leagueId,
              marketSessionId: activeSession.id,
              playerId: player.id,
              fromMemberId: member.id,
              toMemberId: null,
              movementType: 'ABROAD_COMPENSATION',
              price: compensation,
            })
          } else {
            // RETROCESSO: free release, no compensation
            // Track history entry for RETROCESSO release
            historyEntries.push({
              contractId: contract.id,
              playerId: player.id,
              leagueMemberId: member.id,
              marketSessionId: activeSession.id,
              eventType: 'RELEASE_RETROCESSO',
              previousSalary: contract.salary,
              previousDuration: contract.duration,
              previousClause: contract.rescissionClause,
              cost: 0,
              notes: `Rilascio ${player.name} (RETROCESSO) - Gratuito`,
            })

            await recordMovement({
              leagueId,
              marketSessionId: activeSession.id,
              playerId: player.id,
              fromMemberId: member.id,
              toMemberId: null,
              movementType: 'RELEGATION_RELEASE',
              price: 0,
            })
          }
        } else {
          // NORMAL RELEASE: standard release cost
          const releaseCost = calculateReleaseCost(contract.salary, contract.duration)
          await tx.leagueMember.update({
            where: { id: member.id },
            data: { currentBudget: { decrement: releaseCost } },
          })

          // Track history entry for normal release
          historyEntries.push({
            contractId: contract.id,
            playerId: contract.roster.playerId,
            leagueMemberId: member.id,
            marketSessionId: activeSession.id,
            eventType: 'RELEASE_NORMAL',
            previousSalary: contract.salary,
            previousDuration: contract.duration,
            previousClause: contract.rescissionClause,
            cost: releaseCost,
            notes: `Taglio ${player.name} - Costo: ${releaseCost} (${contract.salary}×${contract.duration}/2)`,
          })

          await recordMovement({
            leagueId,
            marketSessionId: activeSession.id,
            playerId: contract.roster.playerId,
            fromMemberId: member.id,
            toMemberId: null,
            movementType: 'RELEASE',
            price: releaseCost,
          })
        }

        // Delete the contract
        await tx.playerContract.delete({
          where: { id: contract.id },
        })

        // Mark roster entry as released
        await tx.playerRoster.update({
          where: { id: contract.rosterId },
          data: {
            status: RosterStatus.RELEASED,
            releasedAt: new Date(),
          },
        })
      }

      // Record KEEP movements for exited players NOT released
      const keptExitedPlayers = await tx.playerContract.findMany({
        where: {
          leagueMemberId: member.id,
          draftReleased: false,
          roster: {
            status: RosterStatus.ACTIVE,
            player: {
              listStatus: 'NOT_IN_LIST',
              exitReason: { in: ['RETROCESSO', 'ESTERO'] },
            },
          },
        },
        include: {
          roster: { include: { player: { select: { id: true, name: true, exitReason: true } } } },
        },
      })

      for (const contract of keptExitedPlayers) {
        const movementType = contract.roster.player.exitReason === 'ESTERO'
          ? 'ABROAD_KEEP' : 'RELEGATION_KEEP'
        const eventType: ContractEventType = contract.roster.player.exitReason === 'ESTERO'
          ? 'KEEP_ESTERO' : 'KEEP_RETROCESSO'

        // Track history entry for KEEP decision
        historyEntries.push({
          contractId: contract.id,
          playerId: contract.roster.player.id,
          leagueMemberId: member.id,
          marketSessionId: activeSession.id,
          eventType,
          previousSalary: contract.salary,
          previousDuration: contract.duration,
          previousClause: contract.rescissionClause,
          newSalary: contract.salary,
          newDuration: contract.duration,
          newClause: contract.rescissionClause,
          notes: `Mantenuto ${contract.roster.player.name} (${contract.roster.player.exitReason})`,
        })

        await recordMovement({
          leagueId,
          marketSessionId: activeSession.id,
          playerId: contract.roster.player.id,
          fromMemberId: null,
          toMemberId: member.id,
          movementType: movementType as any,
          price: 0,
        })
      }

      // 4. Check if all remaining active players have contracts
      const roster = await tx.playerRoster.findMany({
        where: {
          leagueMemberId: member.id,
          status: RosterStatus.ACTIVE,
        },
        include: { contract: true, player: true },
      })

      const playersWithoutContract = roster.filter(r => !r.contract)
      if (playersWithoutContract.length > 0) {
        const names = playersWithoutContract.map(r => r.player.name).join(', ')
        throw new Error(`${playersWithoutContract.length} giocatori senza contratto: ${names}`)
      }

      // 4.5 Check roster size limit (max 29 players)
      if (roster.length > MAX_ROSTER_SIZE) {
        const excess = roster.length - MAX_ROSTER_SIZE
        throw new Error(`Rosa troppo grande: ${roster.length} giocatori. Devi tagliare ${excess} giocator${excess === 1 ? 'e' : 'i'} (max ${MAX_ROSTER_SIZE})`)
      }

      // M-11: Ricalcolo monte ingaggi post-consolidamento
      // Verify the total salaries after all operations are consistent
      const postConsolidationContracts = await tx.playerContract.findMany({
        where: { leagueMemberId: member.id },
      })
      const postMonteIngaggi = postConsolidationContracts.reduce((sum, c) => sum + c.salary, 0)
      const postMember = await tx.leagueMember.findUnique({
        where: { id: member.id },
      })
      if (postMember && postMonteIngaggi > postMember.currentBudget) {
        throw new Error(
          `Monte ingaggi (${postMonteIngaggi}) supera il budget (${postMember.currentBudget}) dopo il consolidamento`
        )
      }

      // 5. Clear all draft values and create consolidation record
      await tx.contractConsolidation.create({
        data: {
          sessionId: activeSession.id,
          memberId: member.id,
        },
      })
    }, {
      timeout: 30000, // 30 seconds timeout for complex consolidations
      maxWait: 10000, // 10 seconds max wait to acquire connection
    })

    // After successful consolidation, batch create contract history entries
    if (historyEntries.length > 0) {
      try {
        const createdCount = await createContractHistoryEntries(historyEntries)
        console.log(`Created ${createdCount} contract history entries for member ${member.id}`)
      } catch (error) {
        console.error('Error creating contract history entries:', error)
        // Don't fail the consolidation if history creation fails
      }
    }

    // After successful consolidation, create PHASE_END snapshot
    try {
      await createPhaseEndSnapshot(activeSession.id, member.id)
    } catch (error) {
      console.error('Error creating phase end snapshot:', error)
      // Don't fail the consolidation if snapshot fails
    }

    return {
      success: true,
      message: 'Contratti consolidati con successo',
      data: {
        consolidatedAt: new Date().toISOString(),
        historyEntriesCreated: historyEntries.length,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore nel consolidamento'
    return { success: false, message }
  }
}

// Get all managers' consolidation status (for admin)
export async function getAllConsolidationStatus(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify user is admin
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

  if (member.role !== 'ADMIN') {
    return { success: false, message: 'Solo gli admin possono vedere lo stato di consolidamento' }
  }

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return {
      success: true,
      data: {
        inContrattiPhase: false,
        managers: [],
        allConsolidated: false,
      },
    }
  }

  // Get all active members (excluding admins who might not have players)
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { id: true, username: true } },
      roster: { where: { status: RosterStatus.ACTIVE } },
    },
  })

  // Only consider managers with players
  const managersWithPlayers = allMembers.filter(m => m.roster.length > 0)

  // Get consolidations for this session
  const consolidations = await prisma.contractConsolidation.findMany({
    where: {
      sessionId: activeSession.id,
    },
  })

  const consolidationMap = new Map(consolidations.map(c => [c.memberId, c.consolidatedAt]))

  const managers = managersWithPlayers.map(m => ({
    memberId: m.id,
    userId: m.user.id,
    username: m.user.username,
    role: m.role,
    playerCount: m.roster.length,
    isConsolidated: consolidationMap.has(m.id),
    consolidatedAt: consolidationMap.get(m.id) || null,
  }))

  const allConsolidated = managers.every(m => m.isConsolidated)

  return {
    success: true,
    data: {
      inContrattiPhase: true,
      sessionId: activeSession.id,
      managers,
      consolidatedCount: managers.filter(m => m.isConsolidated).length,
      totalCount: managers.length,
      allConsolidated,
    },
  }
}

// Simulate all managers consolidated (admin test only)
export async function simulateAllConsolidation(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify user is admin
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

  if (member.role !== 'ADMIN') {
    return { success: false, message: 'Solo gli admin possono simulare il consolidamento' }
  }

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Non siamo in fase CONTRATTI' }
  }

  // Get all active members with players (excluding admin)
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      roster: { where: { status: RosterStatus.ACTIVE } },
      user: { select: { username: true } },
    },
  })

  const managersWithPlayers = allMembers.filter(m => m.roster.length > 0)

  // Get existing consolidations
  const existingConsolidations = await prisma.contractConsolidation.findMany({
    where: { sessionId: activeSession.id },
  })

  const existingMemberIds = new Set(existingConsolidations.map(c => c.memberId))

  // Create consolidation records for all members who haven't consolidated yet
  const membersToConsolidate = managersWithPlayers.filter(m => !existingMemberIds.has(m.id))

  if (membersToConsolidate.length === 0) {
    return { success: true, message: 'Tutti i manager hanno già consolidato' }
  }

  await prisma.contractConsolidation.createMany({
    data: membersToConsolidate.map(m => ({
      sessionId: activeSession.id,
      memberId: m.id,
    })),
  })

  const consolidatedNames = membersToConsolidate.map(m => m.user.username).join(', ')

  return {
    success: true,
    message: `Consolidamento simulato per: ${consolidatedNames}`,
    data: {
      consolidatedCount: membersToConsolidate.length,
      consolidatedMembers: membersToConsolidate.map(m => m.user.username),
    },
  }
}

// Check if all managers have consolidated (for phase advancement validation)
export async function canAdvanceFromContratti(
  sessionId: string
): Promise<{ canAdvance: boolean; reason?: string }> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { canAdvance: false, reason: 'Sessione non trovata' }
  }

  if (session.currentPhase !== 'CONTRATTI') {
    // Not in CONTRATTI phase, no consolidation check needed
    return { canAdvance: true }
  }

  // Get all active members with players
  const allMembers = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      roster: { where: { status: RosterStatus.ACTIVE } },
      user: { select: { username: true } },
    },
  })

  const managersWithPlayers = allMembers.filter(m => m.roster.length > 0)

  // Get consolidations for this session
  const consolidations = await prisma.contractConsolidation.findMany({
    where: {
      sessionId: session.id,
    },
  })

  const consolidatedMemberIds = new Set(consolidations.map(c => c.memberId))

  const notConsolidated = managersWithPlayers.filter(m => !consolidatedMemberIds.has(m.id))

  if (notConsolidated.length > 0) {
    const names = notConsolidated.map(m => m.user.username).join(', ')
    return {
      canAdvance: false,
      reason: `Manager non hanno consolidato: ${names}`,
    }
  }

  return { canAdvance: true }
}

// Save draft renewals, new contracts, and releases (staging area)
export async function saveDrafts(
  leagueId: string,
  userId: string,
  renewals: { contractId: string; salary: number; duration: number }[],
  newContracts: { rosterId: string; salary: number; duration: number }[],
  releases: string[] = [],  // Contract IDs to mark for release
  exitDecisions: { contractId: string; decision: 'KEEP' | 'RELEASE' }[] = []  // Exited player decisions
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

  // Get active session in CONTRATTI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CONTRATTI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Non siamo in fase CONTRATTI' }
  }

  // Check if already consolidated
  const existingConsolidation = await prisma.contractConsolidation.findUnique({
    where: {
      sessionId_memberId: {
        sessionId: activeSession.id,
        memberId: member.id,
      },
    },
  })

  if (existingConsolidation) {
    return { success: false, message: 'Hai già consolidato i tuoi contratti' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Validate and save draft renewals in batch
      if (renewals.length > 0) {
        const contractIds = renewals.map(r => r.contractId)
        const contracts = await tx.playerContract.findMany({
          where: {
            id: { in: contractIds },
            leagueMemberId: member.id
          },
        })

        const validIds = new Set(contracts.map(c => c.id))
        for (const renewal of renewals) {
          if (!validIds.has(renewal.contractId)) {
            throw new Error(`Contratto ${renewal.contractId} non valido`)
          }
        }

        // Update each renewal
        for (const renewal of renewals) {
          await tx.playerContract.update({
            where: { id: renewal.contractId },
            data: {
              draftSalary: renewal.salary,
              draftDuration: renewal.duration,
            },
          })
        }
      }

      // 2. Validate and save draft new contracts in batch
      if (newContracts.length > 0) {
        const rosterIds = newContracts.map(nc => nc.rosterId)
        const rosterEntries = await tx.playerRoster.findMany({
          where: {
            id: { in: rosterIds },
            leagueMemberId: member.id
          },
          include: { contract: true },
        })

        const validRosters = new Map(rosterEntries.map(r => [r.id, r]))
        for (const nc of newContracts) {
          const roster = validRosters.get(nc.rosterId)
          if (!roster) {
            throw new Error(`Roster entry ${nc.rosterId} non valido`)
          }
          if (roster.contract) {
            throw new Error(`Il giocatore ha già un contratto`)
          }
        }

        // Upsert each draft contract
        for (const nc of newContracts) {
          await tx.draftContract.upsert({
            where: { rosterId: nc.rosterId },
            create: {
              rosterId: nc.rosterId,
              memberId: member.id,
              sessionId: activeSession.id,
              salary: nc.salary,
              duration: nc.duration,
            },
            update: {
              salary: nc.salary,
              duration: nc.duration,
            },
          })
        }
      }

      // 3. Mark contracts for release using batch updates
      // Get IDs of exited player contracts so we don't overwrite their draftReleased
      const exitDecisionContractIds = exitDecisions.map(ed => ed.contractId)

      // Reset draftReleased only for NON-exited player contracts
      await tx.playerContract.updateMany({
        where: {
          leagueMemberId: member.id,
          ...(exitDecisionContractIds.length > 0 ? { id: { notIn: exitDecisionContractIds } } : {}),
        },
        data: { draftReleased: false },
      })

      if (releases.length > 0) {
        await tx.playerContract.updateMany({
          where: {
            id: { in: releases },
            leagueMemberId: member.id
          },
          data: { draftReleased: true },
        })
      }

      // 4. Save exit decisions for exited players
      // Reset all draftExitDecision first
      await tx.playerContract.updateMany({
        where: { leagueMemberId: member.id },
        data: { draftExitDecision: null },
      })

      if (exitDecisions.length > 0) {
        for (const ed of exitDecisions) {
          await tx.playerContract.update({
            where: { id: ed.contractId },
            data: {
              draftExitDecision: ed.decision,
              draftReleased: ed.decision === 'RELEASE',
            },
          })
        }
      }
    }, {
      timeout: 30000, // 30 seconds timeout
    })

    return {
      success: true,
      message: 'Bozze salvate con successo',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore nel salvataggio'
    return { success: false, message }
  }
}

// ==================== MODIFY CONTRACT POST-ACQUISITION ====================

/**
 * Modify a contract after acquisition (trade, rubata, svincolati, first market).
 * This can be called outside of CONTRATTI phase.
 * The modification follows renewal rules (spalma for 1s, no decrease for >1s).
 * The cost is NOT deducted immediately - it will be counted in the "monte ingaggi" during CONTRATTI phase.
 */
export async function modifyContractPostAcquisition(
  contractId: string,
  userId: string,
  newSalary: number,
  newDuration: number
): Promise<ServiceResult> {
  // Get contract with roster and member info
  const contract = await prisma.playerContract.findUnique({
    where: { id: contractId },
    include: {
      roster: {
        include: {
          player: true,
          leagueMember: {
            include: {
              user: { select: { id: true, username: true } },
              league: true,
            },
          },
        },
      },
    },
  })

  if (!contract) {
    return { success: false, message: 'Contratto non trovato' }
  }

  // Verify ownership
  if (contract.roster.leagueMember.user.id !== userId) {
    return { success: false, message: 'Non sei il proprietario di questo contratto' }
  }

  // Post-acquisition: only increase allowed (no spalma, no taglio)
  if (newSalary < contract.salary) {
    return { success: false, message: `Ingaggio non può diminuire: ${newSalary} < ${contract.salary}` }
  }
  if (newDuration < contract.duration) {
    return { success: false, message: `Durata non può diminuire: ${newDuration} < ${contract.duration}` }
  }
  if (newDuration > contract.duration && newSalary <= contract.salary) {
    return { success: false, message: 'Per aumentare la durata devi prima aumentare l\'ingaggio' }
  }
  if (newDuration > MAX_DURATION) {
    return { success: false, message: `Durata massima: ${MAX_DURATION} semestri` }
  }

  // Check if there are actual changes
  if (newSalary === contract.salary && newDuration === contract.duration) {
    return { success: false, message: 'Nessuna modifica rilevata' }
  }

  // Calculate new rescission clause
  const newRescissionClause = calculateRescissionClause(newSalary, newDuration)

  // Store old values for renewal history
  const oldValues = {
    salary: contract.salary,
    duration: contract.duration,
    rescissionClause: contract.rescissionClause,
    modifiedAt: new Date().toISOString(),
    type: 'POST_ACQUISITION_MODIFICATION',
  }

  // Get existing renewal history or initialize empty array
  const renewalHistory = (contract.renewalHistory as unknown[] || []) as unknown[]

  // Update contract
  const updatedContract = await prisma.playerContract.update({
    where: { id: contractId },
    data: {
      salary: newSalary,
      duration: newDuration,
      rescissionClause: newRescissionClause,
      renewalHistory: [...renewalHistory, oldValues],
    },
    include: {
      roster: {
        include: {
          player: true,
        },
      },
    },
  })

  return {
    success: true,
    message: `Contratto di ${updatedContract.roster.player.name} modificato con successo`,
    data: {
      contract: {
        id: updatedContract.id,
        salary: updatedContract.salary,
        duration: updatedContract.duration,
        rescissionClause: updatedContract.rescissionClause,
        initialSalary: updatedContract.initialSalary,
        initialDuration: updatedContract.initialDuration,
      },
      player: updatedContract.roster.player,
    },
  }
}

// Get consolidation receipt data for PDF generation
export async function getConsolidationReceiptData(
  leagueId: string,
  memberId: string
): Promise<{
  success: boolean
  data?: {
    managerName: string
    managerEmail: string
    teamName: string
    leagueName: string
    consolidationDate: Date
    transactionId: string
    renewals: Array<{
      playerName: string
      position: string
      realTeam: string
      oldSalary: number
      newSalary: number
      oldDuration: number
      newDuration: number
      rescissionClause: number
    }>
    releasedPlayers: Array<{
      playerName: string
      position: string
      releaseCost: number
    }>
    totalSalary: number
    remainingBudget: number
  }
  message?: string
}> {
  const member = await prisma.leagueMember.findUnique({
    where: { id: memberId },
    include: {
      user: { select: { username: true, email: true } },
      league: { select: { name: true } },
      roster: {
        where: { status: RosterStatus.ACTIVE },
        include: {
          player: true,
          contract: true,
        },
      },
    },
  })

  if (!member) {
    return { success: false, message: 'Membro non trovato' }
  }

  // Get the most recent consolidation for this member
  const consolidation = await prisma.contractConsolidation.findFirst({
    where: { memberId },
    orderBy: { consolidatedAt: 'desc' },
  })

  if (!consolidation) {
    return { success: false, message: 'Nessun consolidamento trovato' }
  }

  // Get all contracts with their renewal history
  const contracts = await prisma.playerContract.findMany({
    where: {
      leagueMemberId: memberId,
    },
    include: {
      roster: {
        include: {
          player: true,
        },
      },
    },
  })

  // Build renewals list - contracts that have been modified (salary or duration changed from initial)
  const renewals = contracts
    .filter(c => c.salary !== c.initialSalary || c.duration !== c.initialDuration)
    .map(c => ({
      playerName: c.roster.player.name,
      position: c.roster.player.position,
      realTeam: c.roster.player.team,
      oldSalary: c.initialSalary,
      newSalary: c.salary,
      oldDuration: c.initialDuration,
      newDuration: c.duration,
      rescissionClause: c.rescissionClause,
    }))

  // Get recently released players from movements
  const recentReleases = await prisma.playerMovement.findMany({
    where: {
      leagueId,
      fromMemberId: memberId,
      movementType: 'RELEASE',
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
    include: {
      player: true,
    },
  })

  const releasedPlayers = recentReleases.map(m => ({
    playerName: m.player.name,
    position: m.player.position,
    releaseCost: m.price || 0,
  }))

  // Calculate total salary
  const totalSalary = contracts.reduce((sum, c) => sum + c.salary, 0)

  return {
    success: true,
    data: {
      managerName: member.user.username,
      managerEmail: member.user.email,
      teamName: member.teamName || member.user.username,
      leagueName: member.league.name,
      consolidationDate: consolidation.consolidatedAt,
      transactionId: consolidation.id,
      renewals,
      releasedPlayers,
      totalSalary,
      remainingBudget: member.currentBudget,
    },
  }
}
