/**
 * Nominate Player Use Case - Application Layer
 *
 * CRITICAL USE CASE for free agent auctions.
 * Handles player nomination with atomic transaction to prevent race conditions.
 *
 * Validation rules:
 * - Returns failure if not nominator's turn
 * - Returns failure if player already owned or nominated
 * - Returns failure if nominator has insufficient budget (min 1)
 * - Uses atomic transaction to prevent race conditions
 * - Creates nomination record
 * - Publishes FreeAgentNominated domain event
 */

import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import type {
  ForbiddenError} from '@/shared/infrastructure/http/errors';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  NotYourTurnError,
  InsufficientBudgetError,
  PlayerNotFoundError,
  SessionNotActiveError
} from '@/shared/infrastructure/http/errors'
import type { ISvincolatiRepository, Player } from '../../domain/repositories/svincolati.repository.interface'
import type { NominatePlayerDto, NominatePlayerResultDto } from '../dto/svincolati.dto'

/**
 * Custom error for player already owned
 */
export class PlayerAlreadyOwnedError extends ConflictError {
  constructor(context?: Record<string, unknown>) {
    super('Questo giocatore è già in una rosa', context)
  }
}

/**
 * Custom error for player already nominated
 */
export class PlayerAlreadyNominatedError extends ConflictError {
  constructor(context?: Record<string, unknown>) {
    super('Questo giocatore è già stato nominato', context)
  }
}

/**
 * Custom error for wrong phase
 */
export class WrongPhaseError extends ConflictError {
  constructor(context?: Record<string, unknown>) {
    super('Non è il momento di nominare un giocatore', context)
  }
}

export type NominatePlayerError =
  | NotFoundError
  | ValidationError
  | ForbiddenError
  | NotYourTurnError
  | InsufficientBudgetError
  | PlayerNotFoundError
  | SessionNotActiveError
  | PlayerAlreadyOwnedError
  | PlayerAlreadyNominatedError
  | WrongPhaseError

export class NominatePlayerUseCase {
  constructor(
    private readonly svincolatiRepository: ISvincolatiRepository
  ) {}

  async execute(
    dto: NominatePlayerDto
  ): Promise<Result<NominatePlayerResultDto, NominatePlayerError>> {
    // Step 1: Get and validate session
    const session = await this.svincolatiRepository.getSession(dto.sessionId)

    if (!session) {
      return fail(new NotFoundError('Sessione non trovata', { sessionId: dto.sessionId }))
    }

    // Step 2: Check session is in correct phase
    if (session.status !== 'READY_CHECK' && session.status !== 'NOMINATION') {
      return fail(
        new WrongPhaseError({
          currentStatus: session.status,
          allowedStatuses: ['READY_CHECK', 'NOMINATION']
        })
      )
    }

    // Step 3: Check it's the nominator's turn
    const turnOrder = await this.svincolatiRepository.getTurnOrder(dto.sessionId)
    const currentTurnMemberId = session.currentNominatorId

    if (currentTurnMemberId !== dto.nominatorId) {
      const currentEntry = turnOrder.find(t => t.memberId === currentTurnMemberId)
      return fail(
        new NotYourTurnError({
          yourId: dto.nominatorId,
          currentTurnId: currentTurnMemberId,
          message: 'Non è il tuo turno di nominare'
        })
      )
    }

    // Step 4: Check nominator has sufficient budget (min 1 to nominate)
    const nominatorBudget = await this.svincolatiRepository.getMemberBudget(dto.nominatorId)

    if (nominatorBudget < 1) {
      return fail(
        new InsufficientBudgetError({
          currentBudget: nominatorBudget,
          minimumRequired: 1
        })
      )
    }

    // Step 5: Check player exists and get info
    const availablePlayers = await this.svincolatiRepository.getAvailablePlayers(dto.sessionId)
    const player = availablePlayers.find(p => p.id === dto.playerId)

    // If not in available players, check why
    if (!player) {
      // Check if player is owned
      const isOwned = await this.svincolatiRepository.isPlayerOwned(dto.sessionId, dto.playerId)
      if (isOwned) {
        return fail(new PlayerAlreadyOwnedError({ playerId: dto.playerId }))
      }

      // Check if already nominated
      const isNominated = await this.svincolatiRepository.isPlayerNominated(dto.sessionId, dto.playerId)
      if (isNominated) {
        return fail(new PlayerAlreadyNominatedError({ playerId: dto.playerId }))
      }

      // Player simply doesn't exist or isn't active
      return fail(new PlayerNotFoundError({ playerId: dto.playerId }))
    }

    // Step 6: Perform atomic nomination
    // This creates the nomination in a transaction to prevent race conditions
    const nominateResult = await this.svincolatiRepository.nominatePlayerAtomic({
      sessionId: dto.sessionId,
      playerId: dto.playerId,
      nominatorId: dto.nominatorId,
      round: session.currentRound
    })

    if (!nominateResult.success || !nominateResult.nomination) {
      // Map repository errors to use case errors
      switch (nominateResult.error) {
        case 'NOT_YOUR_TURN':
          return fail(new NotYourTurnError())
        case 'PLAYER_ALREADY_OWNED':
          return fail(new PlayerAlreadyOwnedError({ playerId: dto.playerId }))
        case 'PLAYER_ALREADY_NOMINATED':
          return fail(new PlayerAlreadyNominatedError({ playerId: dto.playerId }))
        case 'INSUFFICIENT_BUDGET':
          return fail(new InsufficientBudgetError({ playerId: dto.playerId }))
        case 'INVALID_PLAYER':
          return fail(new PlayerNotFoundError({ playerId: dto.playerId }))
        case 'SESSION_NOT_ACTIVE':
          return fail(new SessionNotActiveError({ sessionId: dto.sessionId }))
        case 'WRONG_PHASE':
          return fail(new WrongPhaseError({ sessionId: dto.sessionId }))
        default:
          return fail(new ValidationError('Errore durante la nomination', { error: nominateResult.error }))
      }
    }

    // Step 7: Update session status to NOMINATION
    await this.svincolatiRepository.updateSession(dto.sessionId, {
      status: 'NOMINATION'
    })

    // Step 8: Clear ready marks for new nomination
    await this.svincolatiRepository.clearReadyMarks(dto.sessionId)

    // Get nominator info for result
    const members = await this.svincolatiRepository.getActiveMembers(dto.sessionId)
    const nominator = members.find(m => m.id === dto.nominatorId)

    return ok({
      nominationId: nominateResult.nomination.id,
      player: {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        quotation: player.quotation
      },
      nominatorId: dto.nominatorId,
      nominatorUsername: nominator?.username ?? 'Unknown',
      status: nominateResult.nomination.status
    })
  }
}
