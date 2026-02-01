import { PrismaClient, RosterStatus, MemberStatus, Position } from '@prisma/client'
import { calculateRescissionClause, calculateReleaseCost } from './contract.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== INTERFACES ====================

export interface CessioneAnalysis {
  player: {
    id: string
    name: string
    position: string
    realTeam: string
    quotation: number
  }
  rosterId: string
  contractId: string
  currentSalary: number
  currentDuration: number
  rescissionCost: number  // costo taglio = (ingaggio x durata rimanente) / 2
  budgetFreed: number     // salary that would be freed
  newBudget: number       // projected budget after release
  slotFreed: {
    position: string
    count: number
  }
}

export interface BudgetAnalysis {
  currentBudget: number
  totalSalary: number                // somma di tutti gli ingaggi correnti
  draftRenewalsImpact: number        // extra salary from draft renewals
  projectedBudget: number            // budget after consolidation (considering draft renewals)
  availableForPurchase: number       // budget disponibile per acquisti
  slotsByPosition: {
    P: { used: number; max: number }
    D: { used: number; max: number }
    C: { used: number; max: number }
    A: { used: number; max: number }
  }
  totalSlots: {
    used: number
    max: number
  }
}

export interface SostitutoSuggestion {
  player: {
    id: string
    name: string
    position: string
    realTeam: string
  }
  quotation: number         // quotazione from SerieAPlayer
  rating: number | null     // API Football rating if available (from cachedStats)
  isOwned: boolean          // true if owned by another manager in league
  ownerId: string | null    // memberId of owner if owned
  ownerTeamName: string | null
  matchScore: number        // how well it matches the released player (based on position + rating)
}

// ==================== GET CESSIONE ANALYSIS ====================

export async function getCessioneAnalysis(
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

  // Filter only players with contracts
  const playersWithContracts = roster.filter(r => r.contract)

  // Calculate cessione analysis for each player
  const analyses: CessioneAnalysis[] = playersWithContracts.map(r => {
    const contract = r.contract!
    const rescissionCost = calculateReleaseCost(contract.salary, contract.duration)
    const budgetFreed = contract.salary
    const newBudget = member.currentBudget - rescissionCost + budgetFreed

    return {
      player: {
        id: r.player.id,
        name: r.player.name,
        position: r.player.position,
        realTeam: r.player.team,
        quotation: r.player.quotation,
      },
      rosterId: r.id,
      contractId: contract.id,
      currentSalary: contract.salary,
      currentDuration: contract.duration,
      rescissionCost,
      budgetFreed,
      newBudget,
      slotFreed: {
        position: r.player.position,
        count: 1,
      },
    }
  })

  return {
    success: true,
    data: analyses,
  }
}

// ==================== GET BUDGET ANALYSIS ====================

export async function getBudgetAnalysis(
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
    include: {
      league: true,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Get roster with contracts and draft values
  const roster = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: member.id,
      status: RosterStatus.ACTIVE,
    },
    include: {
      player: true,
      contract: true,
    },
  })

  // Calculate current totals
  const playersWithContracts = roster.filter(r => r.contract)

  // Current total salary
  const totalSalary = playersWithContracts.reduce(
    (sum, r) => sum + r.contract!.salary,
    0
  )

  // Calculate draft renewals impact
  // Draft renewals add extra salary if draftSalary > current salary
  let draftRenewalsImpact = 0
  for (const r of playersWithContracts) {
    const contract = r.contract!
    if (contract.draftSalary && contract.draftDuration) {
      // Calculate renewal cost impact
      const currentValue = contract.salary * contract.duration
      const newValue = contract.draftSalary * contract.draftDuration
      if (newValue > currentValue) {
        draftRenewalsImpact += (newValue - currentValue)
      }
    }
  }

  // Calculate slots by position
  const slotsByPosition: BudgetAnalysis['slotsByPosition'] = {
    P: { used: 0, max: member.league.goalkeeperSlots },
    D: { used: 0, max: member.league.defenderSlots },
    C: { used: 0, max: member.league.midfielderSlots },
    A: { used: 0, max: member.league.forwardSlots },
  }

  for (const r of roster) {
    const pos = r.player.position as keyof typeof slotsByPosition
    if (slotsByPosition[pos]) {
      slotsByPosition[pos].used++
    }
  }

  const maxSlots = member.league.goalkeeperSlots +
                   member.league.defenderSlots +
                   member.league.midfielderSlots +
                   member.league.forwardSlots

  const analysis: BudgetAnalysis = {
    currentBudget: member.currentBudget,
    totalSalary,
    draftRenewalsImpact,
    projectedBudget: member.currentBudget - draftRenewalsImpact,
    availableForPurchase: member.currentBudget - draftRenewalsImpact,
    slotsByPosition,
    totalSlots: {
      used: roster.length,
      max: maxSlots,
    },
  }

  return {
    success: true,
    data: analysis,
  }
}

// ==================== GET SOSTITUTI (REPLACEMENTS) ====================

export async function getSostituti(
  leagueId: string,
  playerId: string,
  userId: string,
  limit: number = 10
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

  // Get the player being released
  const targetPlayer = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!targetPlayer) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Get all players with same position
  const candidates = await prisma.serieAPlayer.findMany({
    where: {
      position: targetPlayer.position,
      listStatus: 'IN_LIST',
      id: { not: playerId }, // exclude the player being released
    },
    orderBy: {
      quotation: 'desc',
    },
  })

  // Get ownership info for all candidates in this league
  const ownedPlayers = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId },
      status: RosterStatus.ACTIVE,
      playerId: { in: candidates.map(c => c.id) },
    },
    include: {
      leagueMember: { select: { id: true, teamName: true } },
    },
  })

  const ownershipMap = new Map(
    ownedPlayers.map(op => [
      op.playerId,
      { memberId: op.leagueMember.id, teamName: op.leagueMember.teamName },
    ])
  )

  // Calculate match scores and build suggestions
  const suggestions: SostitutoSuggestion[] = candidates.map(c => {
    const ownership = ownershipMap.get(c.id)

    // Parse API Football stats for rating
    let rating: number | null = null
    if (c.apiFootballStats) {
      try {
        const stats = c.apiFootballStats as { games?: { rating?: string } }
        if (stats.games?.rating) {
          rating = parseFloat(stats.games.rating)
        }
      } catch {
        // ignore parse errors
      }
    }

    // Calculate match score (higher is better)
    // Based on quotation similarity and rating
    const quotationDiff = Math.abs(c.quotation - targetPlayer.quotation)
    const quotationScore = Math.max(0, 100 - quotationDiff)
    const ratingScore = rating ? rating * 10 : 50 // default to 50 if no rating
    const matchScore = Math.round(quotationScore * 0.6 + ratingScore * 0.4)

    return {
      player: {
        id: c.id,
        name: c.name,
        position: c.position,
        realTeam: c.team,
      },
      quotation: c.quotation,
      rating,
      isOwned: !!ownership,
      ownerId: ownership?.memberId || null,
      ownerTeamName: ownership?.teamName || null,
      matchScore,
    }
  })

  // Sort by match score and limit
  const sortedSuggestions = suggestions
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)

  return {
    success: true,
    data: sortedSuggestions,
  }
}
