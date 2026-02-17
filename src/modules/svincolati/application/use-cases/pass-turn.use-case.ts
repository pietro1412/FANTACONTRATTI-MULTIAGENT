/**
 * Pass Turn Use Case - Application Layer
 *
 * Handles a member passing their turn in the svincolati session.
 * - Marks member as passed for this round
 * - Advances to next member in order
 * - If all passed, ends round or session
 * - Returns new current nominator
 */

import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import type {
  ForbiddenError,
  SessionNotActiveError
} from '@/shared/infrastructure/http/errors';
import {
  NotFoundError,
  ConflictError,
  NotYourTurnError
} from '@/shared/infrastructure/http/errors'
import type { ISvincolatiRepository } from '../../domain/repositories/svincolati.repository.interface'
import type { PassTurnDto, PassTurnResultDto } from '../dto/svincolati.dto'
import { allMembersPassed } from '../../domain/entities/turn-order.entity'

/**
 * Custom error for wrong phase when passing
 */
export class CannotPassNowError extends ConflictError {
  constructor(context?: Record<string, unknown>) {
    super('Non puoi passare in questo momento', context)
  }
}

/**
 * Custom error for already passed
 */
export class AlreadyPassedError extends ConflictError {
  constructor(context?: Record<string, unknown>) {
    super('Hai già passato questo giro', context)
  }
}

export type PassTurnError =
  | NotFoundError
  | ForbiddenError
  | NotYourTurnError
  | SessionNotActiveError
  | CannotPassNowError
  | AlreadyPassedError

export class PassTurnUseCase {
  constructor(
    private readonly svincolatiRepository: ISvincolatiRepository
  ) {}

  async execute(
    dto: PassTurnDto
  ): Promise<Result<PassTurnResultDto, PassTurnError>> {
    // Step 1: Get and validate session
    const session = await this.svincolatiRepository.getSession(dto.sessionId)

    if (!session) {
      return fail(new NotFoundError('Sessione non trovata', { sessionId: dto.sessionId }))
    }

    // Step 2: Check session is in correct phase for passing
    // Can only pass during READY_CHECK phase (when it's your turn to nominate)
    if (session.status !== 'READY_CHECK') {
      return fail(
        new CannotPassNowError({
          currentStatus: session.status,
          allowedStatus: 'READY_CHECK'
        })
      )
    }

    // Step 3: Check it's the member's turn to pass
    if (session.currentNominatorId !== dto.memberId) {
      return fail(
        new NotYourTurnError({
          yourId: dto.memberId,
          currentTurnId: session.currentNominatorId,
          message: 'Non è il tuo turno'
        })
      )
    }

    // Step 4: Get turn order and check if already passed
    const turnOrder = await this.svincolatiRepository.getTurnOrder(dto.sessionId)
    const memberEntry = turnOrder.find(t => t.memberId === dto.memberId)

    if (!memberEntry) {
      return fail(new NotFoundError('Non sei nell\'ordine dei turni', { memberId: dto.memberId }))
    }

    if (memberEntry.hasPassed) {
      return fail(new AlreadyPassedError({ memberId: dto.memberId }))
    }

    // Step 5: Mark the member as passed
    await this.svincolatiRepository.markPassed(dto.sessionId, dto.memberId)

    // Step 6: Refresh turn order to check if all passed
    const updatedTurnOrder = await this.svincolatiRepository.getTurnOrder(dto.sessionId)
    const passedCount = updatedTurnOrder.filter(t => t.hasPassed || t.hasFinished).length
    const totalMembers = updatedTurnOrder.length

    // Step 7: Check if all members have passed
    if (allMembersPassed(updatedTurnOrder)) {
      // All passed - complete the session
      await this.svincolatiRepository.updateSession(dto.sessionId, {
        status: 'COMPLETED',
        currentNominatorId: null
      })

      return ok({
        allPassed: true,
        nextMemberId: null,
        nextMemberUsername: null,
        passedCount,
        totalMembers
      })
    }

    // Step 8: Find and set next active member
    const nextEntry = await this.svincolatiRepository.advanceToNextMember(dto.sessionId)

    if (!nextEntry) {
      // This shouldn't happen if allMembersPassed check passed
      // But handle it gracefully
      await this.svincolatiRepository.updateSession(dto.sessionId, {
        status: 'COMPLETED',
        currentNominatorId: null
      })

      return ok({
        allPassed: true,
        nextMemberId: null,
        nextMemberUsername: null,
        passedCount,
        totalMembers
      })
    }

    // Update session with new nominator
    await this.svincolatiRepository.updateSession(dto.sessionId, {
      currentNominatorId: nextEntry.memberId
    })

    // Get username for the next member
    const members = await this.svincolatiRepository.getActiveMembers(dto.sessionId)
    const nextMember = members.find(m => m.id === nextEntry.memberId)

    return ok({
      allPassed: false,
      nextMemberId: nextEntry.memberId,
      nextMemberUsername: nextMember?.username ?? null,
      passedCount,
      totalMembers
    })
  }
}
