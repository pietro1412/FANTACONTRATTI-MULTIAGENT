import { PrismaClient, MemberStatus, RosterStatus, AcquisitionType } from '@prisma/client'
import { recordMovement } from './movement.service'

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
  1: 4,   // 1 semestre = moltiplicatore 4
}

const MAX_DURATION = 4 // Max 4 semestri
const MIN_SALARY_PERCENTAGE = 0.1 // 10% del prezzo acquisto per acquisti non-PRIMO MERCATO

function getMultiplier(duration: number): number {
  return DURATION_MULTIPLIERS[duration] ?? 4
}

export function calculateRescissionClause(salary: number, duration: number): number {
  return salary * getMultiplier(duration)
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

  // Caso normale: no ribasso
  if (newSalary < currentSalary) {
    return { valid: false, reason: `Ingaggio non può diminuire: ${newSalary} < ${currentSalary}` }
  }
  if (newDuration < currentDuration) {
    return { valid: false, reason: `Durata non può diminuire: ${newDuration} < ${currentDuration}` }
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

  // Check if in CONTRATTI phase
  const inContrattiPhase = await isInContrattiPhase(leagueId)

  // Get roster with contracts
  const roster = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: member.id,
      status: RosterStatus.ACTIVE,
    },
    include: {
      player: true,
      contract: true,
    },
    orderBy: {
      player: {
        position: 'asc',
      },
    },
  })

  // Separate players with and without contracts
  const playersWithContract = roster.filter(r => r.contract)
  const playersWithoutContract = roster.filter(r => !r.contract)

  // Add calculated fields for contracts
  const contracts = playersWithContract.map(r => ({
    id: r.contract!.id,
    salary: r.contract!.salary,
    duration: r.contract!.duration,
    initialSalary: r.contract!.initialSalary,
    initialDuration: r.contract!.initialDuration,
    rescissionClause: calculateRescissionClause(r.contract!.salary, r.contract!.duration),
    canRenew: r.contract!.duration < MAX_DURATION,
    canSpalmare: r.contract!.duration === 1,
    roster: {
      id: r.id,
      player: r.player,
      acquisitionPrice: r.acquisitionPrice,
      acquisitionType: r.acquisitionType,
    },
  }))

  // Players needing contract setup
  const pendingContracts = playersWithoutContract.map(r => ({
    rosterId: r.id,
    player: r.player,
    acquisitionPrice: r.acquisitionPrice,
    acquisitionType: r.acquisitionType,
    minSalary: r.acquisitionType === AcquisitionType.FIRST_MARKET
      ? 1
      : Math.ceil(r.acquisitionPrice * MIN_SALARY_PERCENTAGE),
  }))

  return {
    success: true,
    data: {
      contracts,
      pendingContracts,
      memberBudget: member.currentBudget,
      inContrattiPhase,
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
  const canRenew = contract.duration < MAX_DURATION
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
        canRenew: duration < MAX_DURATION,
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

  // Check if in CONTRATTI phase
  const inContrattiPhase = await isInContrattiPhase(contract.roster.leagueMember.leagueId)
  if (!inContrattiPhase) {
    return { success: false, message: 'Puoi rinnovare contratti solo durante la fase CONTRATTI' }
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

  // Check budget
  const member = contract.roster.leagueMember
  if (renewalCost > member.currentBudget) {
    return { success: false, message: `Budget insufficiente. Costo rinnovo: ${renewalCost}, Budget: ${member.currentBudget}` }
  }

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

  // Deduct budget
  if (renewalCost > 0) {
    await prisma.leagueMember.update({
      where: { id: member.id },
      data: {
        currentBudget: {
          decrement: renewalCost,
        },
      },
    })
  }

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
      newBudget: member.currentBudget - renewalCost,
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

  // Calculate release cost (rescission clause)
  const releaseCost = calculateRescissionClause(contract.salary, contract.duration)

  // Check budget
  const member = contract.roster.leagueMember
  if (releaseCost > member.currentBudget) {
    return { success: false, message: `Budget insufficiente. Clausola rescissoria: ${releaseCost}, Budget: ${member.currentBudget}` }
  }

  const playerName = contract.roster.player.name

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

  // Record movement for RELEASE
  await recordMovement({
    leagueId: contract.roster.leagueMember.leagueId,
    playerId: contract.roster.playerId,
    movementType: 'RELEASE',
    fromMemberId: member.id,
    price: releaseCost,
    oldSalary: contract.salary,
    oldDuration: contract.duration,
    oldClause: calculateRescissionClause(contract.salary, contract.duration),
    marketSessionId: activeSession?.id,
  })

  return {
    success: true,
    message: `${playerName} svincolato. Clausola pagata: ${releaseCost}`,
    data: {
      releaseCost,
      newBudget: member.currentBudget - releaseCost,
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
