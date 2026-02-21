/**
 * objectives.service.ts - Auction Objectives Service
 *
 * Gestione degli obiettivi pre-asta dei manager.
 * Permette ai manager di salvare giocatori target con priorità.
 *
 * Creato il: 25/01/2026
 */

import type { ObjectiveStatus } from '@prisma/client';
import { PrismaClient } from '@prisma/client'
import type { ServiceResult } from '@/shared/types/service-result'

const prisma = new PrismaClient()

export interface CreateObjectiveInput {
  sessionId: string
  playerId: string
  priority?: number
  notes?: string
  maxPrice?: number
}

export interface UpdateObjectiveInput {
  priority?: number
  notes?: string
  maxPrice?: number
  status?: ObjectiveStatus
}

/**
 * Get all objectives for a member in a session
 */
export async function getObjectives(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  // Get member for this session
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    select: { leagueId: true }
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const member = await prisma.leagueMember.findFirst({
    where: {
      userId,
      leagueId: session.leagueId,
      status: 'ACTIVE'
    }
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const objectives = await prisma.auctionObjective.findMany({
    where: {
      sessionId,
      memberId: member.id
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          team: true,
          position: true,
          quotation: true
        }
      }
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'asc' }
    ]
  })

  return { success: true, data: objectives }
}

/**
 * Create a new objective
 */
export async function createObjective(
  userId: string,
  input: CreateObjectiveInput
): Promise<ServiceResult> {
  const { sessionId, playerId, priority = 2, notes, maxPrice } = input

  // Get session and verify it exists
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    select: { id: true, leagueId: true, status: true }
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Check session is not completed
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    return { success: false, message: 'Sessione non attiva' }
  }

  // Get member for this session
  const member = await prisma.leagueMember.findFirst({
    where: {
      userId,
      leagueId: session.leagueId,
      status: 'ACTIVE'
    }
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Verify player exists
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
    select: { id: true, name: true }
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Check if objective already exists
  const existingObjective = await prisma.auctionObjective.findUnique({
    where: {
      sessionId_memberId_playerId: {
        sessionId,
        memberId: member.id,
        playerId
      }
    }
  })

  if (existingObjective) {
    return { success: false, message: 'Obiettivo già esistente per questo giocatore' }
  }

  // Validate priority
  if (priority < 1 || priority > 3) {
    return { success: false, message: 'Priorità deve essere 1, 2 o 3' }
  }

  // Create objective
  const objective = await prisma.auctionObjective.create({
    data: {
      sessionId,
      memberId: member.id,
      playerId,
      priority,
      notes,
      maxPrice
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          team: true,
          position: true,
          quotation: true
        }
      }
    }
  })

  return { success: true, data: objective }
}

/**
 * Update an objective
 */
export async function updateObjective(
  objectiveId: string,
  userId: string,
  input: UpdateObjectiveInput
): Promise<ServiceResult> {
  // Get objective and verify ownership
  const objective = await prisma.auctionObjective.findUnique({
    where: { id: objectiveId },
    include: {
      member: {
        select: { userId: true, leagueId: true }
      },
      session: {
        select: { status: true }
      }
    }
  })

  if (!objective) {
    return { success: false, message: 'Obiettivo non trovato' }
  }

  if (objective.member.userId !== userId) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Check session is not completed
  if (objective.session.status === 'COMPLETED' || objective.session.status === 'CANCELLED') {
    return { success: false, message: 'Sessione non attiva' }
  }

  // Validate priority if provided
  if (input.priority !== undefined && (input.priority < 1 || input.priority > 3)) {
    return { success: false, message: 'Priorità deve essere 1, 2 o 3' }
  }

  // Update objective
  const updated = await prisma.auctionObjective.update({
    where: { id: objectiveId },
    data: {
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.maxPrice !== undefined && { maxPrice: input.maxPrice }),
      ...(input.status !== undefined && { status: input.status })
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          team: true,
          position: true,
          quotation: true
        }
      }
    }
  })

  return { success: true, data: updated }
}

/**
 * Delete an objective
 */
export async function deleteObjective(
  objectiveId: string,
  userId: string
): Promise<ServiceResult> {
  // Get objective and verify ownership
  const objective = await prisma.auctionObjective.findUnique({
    where: { id: objectiveId },
    include: {
      member: {
        select: { userId: true }
      },
      session: {
        select: { status: true }
      }
    }
  })

  if (!objective) {
    return { success: false, message: 'Obiettivo non trovato' }
  }

  if (objective.member.userId !== userId) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Check session is not completed
  if (objective.session.status === 'COMPLETED' || objective.session.status === 'CANCELLED') {
    return { success: false, message: 'Sessione non attiva' }
  }

  await prisma.auctionObjective.delete({
    where: { id: objectiveId }
  })

  return { success: true, message: 'Obiettivo eliminato' }
}

/**
 * Mark objective as acquired (called when player is won)
 */
export async function markObjectiveAcquired(
  sessionId: string,
  playerId: string,
  winnerId: string
): Promise<void> {
  // Mark winner's objective as ACQUIRED
  await prisma.auctionObjective.updateMany({
    where: {
      sessionId,
      playerId,
      memberId: winnerId,
      status: 'ACTIVE'
    },
    data: {
      status: 'ACQUIRED'
    }
  })

  // Mark other members' objectives for this player as MISSED
  await prisma.auctionObjective.updateMany({
    where: {
      sessionId,
      playerId,
      memberId: { not: winnerId },
      status: 'ACTIVE'
    },
    data: {
      status: 'MISSED'
    }
  })
}

/**
 * Get objectives summary for a session (counts by status)
 */
export async function getObjectivesSummary(
  sessionId: string,
  userId: string
): Promise<ServiceResult> {
  // Get session and verify membership
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
    select: { leagueId: true }
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  const member = await prisma.leagueMember.findFirst({
    where: {
      userId,
      leagueId: session.leagueId,
      status: 'ACTIVE'
    }
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const objectives = await prisma.auctionObjective.groupBy({
    by: ['status'],
    where: {
      sessionId,
      memberId: member.id
    },
    _count: true
  })

  const summary = {
    active: 0,
    acquired: 0,
    missed: 0,
    removed: 0,
    total: 0
  }

  for (const obj of objectives) {
    const count = obj._count
    summary.total += count
    switch (obj.status) {
      case 'ACTIVE':
        summary.active = count
        break
      case 'ACQUIRED':
        summary.acquired = count
        break
      case 'MISSED':
        summary.missed = count
        break
      case 'REMOVED':
        summary.removed = count
        break
    }
  }

  return { success: true, data: summary }
}
