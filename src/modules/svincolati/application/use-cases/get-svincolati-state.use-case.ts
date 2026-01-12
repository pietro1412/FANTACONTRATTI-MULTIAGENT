/**
 * Get Svincolati State Use Case - Application Layer
 *
 * Returns the complete state of a svincolati session for UI rendering.
 * Includes turn order, nominations, available players, and member status.
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { NotFoundError, ForbiddenError } from '../../../../shared/infrastructure/http/errors'
import type { ISvincolatiRepository } from '../../domain/repositories/svincolati.repository.interface'
import type {
  GetSvincolatiStateDto,
  SvincolatiStateDto,
  TurnOrderMemberDto,
  NominationDto,
  PendingNominationDto,
  PlayerDto
} from '../dto/svincolati.dto'

export type GetSvincolatiStateError = NotFoundError | ForbiddenError

export class GetSvincolatiStateUseCase {
  constructor(
    private readonly svincolatiRepository: ISvincolatiRepository
  ) {}

  async execute(
    dto: GetSvincolatiStateDto
  ): Promise<Result<SvincolatiStateDto, GetSvincolatiStateError>> {
    // Step 1: Get session
    const session = await this.svincolatiRepository.getSession(dto.sessionId)

    if (!session) {
      return fail(new NotFoundError('Sessione non trovata', { sessionId: dto.sessionId }))
    }

    // Step 2: Get all active members
    const members = await this.svincolatiRepository.getActiveMembers(dto.sessionId)

    // Verify requesting member is part of the session
    const requestingMember = members.find(m => m.id === dto.memberId)
    if (!requestingMember) {
      return fail(new ForbiddenError('Non sei membro di questa sessione', { memberId: dto.memberId }))
    }

    // Step 3: Get turn order
    const turnOrder = await this.svincolatiRepository.getTurnOrder(dto.sessionId)

    // Build turn order DTOs
    const turnOrderDtos: TurnOrderMemberDto[] = turnOrder.map(entry => {
      const member = members.find(m => m.id === entry.memberId)
      return {
        memberId: entry.memberId,
        username: member?.username ?? 'Unknown',
        budget: member?.currentBudget ?? 0,
        orderIndex: entry.orderIndex,
        hasPassed: entry.hasPassed,
        hasFinished: entry.hasFinished
      }
    }).sort((a, b) => a.orderIndex - b.orderIndex)

    // Step 4: Get nominations
    const nominations = await this.svincolatiRepository.getNominations(dto.sessionId)

    // Get pending nomination if any
    const pendingNomination = await this.svincolatiRepository.getPendingNomination(dto.sessionId)

    // Step 5: Get available players
    const availablePlayers = await this.svincolatiRepository.getAvailablePlayers(dto.sessionId)

    // Step 6: Get ready members
    const readyMembers = await this.svincolatiRepository.getReadyMembers(dto.sessionId)

    // Step 7: Find current nominator info
    let currentNominator: { id: string; username: string } | null = null
    if (session.currentNominatorId) {
      const nominatorMember = members.find(m => m.id === session.currentNominatorId)
      if (nominatorMember) {
        currentNominator = {
          id: nominatorMember.id,
          username: nominatorMember.username
        }
      }
    }

    // Step 8: Build nomination DTOs
    const nominationDtos: NominationDto[] = nominations.map(nom => {
      const nominator = members.find(m => m.id === nom.nominatorId)
      const winner = nom.winnerId ? members.find(m => m.id === nom.winnerId) : null
      const player = availablePlayers.find(p => p.id === nom.playerId)

      return {
        id: nom.id,
        player: player
          ? {
              id: player.id,
              name: player.name,
              team: player.team,
              position: player.position,
              quotation: player.quotation
            }
          : {
              id: nom.playerId,
              name: 'Unknown Player',
              team: 'N/A',
              position: 'C' as const,
              quotation: 0
            },
        nominatorId: nom.nominatorId,
        nominatorUsername: nominator?.username ?? 'Unknown',
        status: nom.status,
        round: nom.round,
        winnerId: nom.winnerId,
        winnerUsername: winner?.username ?? null,
        finalPrice: nom.finalPrice,
        createdAt: nom.createdAt
      }
    })

    // Step 9: Build pending nomination DTO
    let pendingNominationDto: PendingNominationDto | null = null
    if (pendingNomination) {
      const nominator = members.find(m => m.id === pendingNomination.nominatorId)
      const player = availablePlayers.find(p => p.id === pendingNomination.playerId)

      pendingNominationDto = {
        id: pendingNomination.id,
        player: player
          ? {
              id: player.id,
              name: player.name,
              team: player.team,
              position: player.position,
              quotation: player.quotation
            }
          : {
              id: pendingNomination.playerId,
              name: 'Unknown Player',
              team: 'N/A',
              position: 'C' as const,
              quotation: 0
            },
        nominatorId: pendingNomination.nominatorId,
        nominatorUsername: nominator?.username ?? 'Unknown',
        isConfirmed: pendingNomination.status === 'CONFIRMED',
        readyMembers,
        totalMembers: members.length
      }
    }

    // Step 10: Build available players DTOs
    const playerDtos: PlayerDto[] = availablePlayers.map(p => ({
      id: p.id,
      name: p.name,
      team: p.team,
      position: p.position,
      quotation: p.quotation
    }))

    // Step 11: Get requesting member's turn entry
    const myTurnEntry = turnOrder.find(t => t.memberId === dto.memberId)

    // Step 12: Build and return state
    const state: SvincolatiStateDto = {
      isActive: session.status !== 'COMPLETED' && session.status !== 'SETUP',
      status: session.status,
      round: session.currentRound,
      currentNominator,
      isMyTurn: session.currentNominatorId === dto.memberId,
      turnOrder: turnOrderDtos,
      nominations: nominationDtos,
      pendingNomination: pendingNominationDto,
      activeAuction: null, // TODO: Add auction integration when needed
      readyMembers,
      availablePlayers: playerDtos,
      timerSeconds: session.timerSeconds,
      myInfo: {
        memberId: dto.memberId,
        budget: requestingMember.currentBudget,
        hasPassed: myTurnEntry?.hasPassed ?? false,
        hasFinished: myTurnEntry?.hasFinished ?? false,
        isAdmin: requestingMember.isAdmin
      }
    }

    return ok(state)
  }
}
