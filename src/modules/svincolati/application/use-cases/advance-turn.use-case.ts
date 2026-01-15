/**
 * Advance Turn Use Case - Application Layer
 *
 * Called after an auction closes to advance to the next turn.
 * - Finds next member in order who hasn't passed
 * - If no one left in round, starts new round (resets passes)
 * - If max rounds reached, completes session
 * - Updates the current nominator
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import {
  NotFoundError,
  ConflictError,
  ValidationError
} from '../../../../shared/infrastructure/http/errors'
import type { ISvincolatiRepository } from '../../domain/repositories/svincolati.repository.interface'
import type { AdvanceTurnDto, AdvanceTurnResultDto } from '../dto/svincolati.dto'
import { allMembersPassed, allMembersFinished } from '../../domain/entities/turn-order.entity'

/**
 * Custom error for wrong phase when advancing
 */
export class CannotAdvanceError extends ConflictError {
  constructor(context?: Record<string, unknown>) {
    super('Non è possibile avanzare al prossimo turno in questo momento', context)
  }
}

export type AdvanceTurnError =
  | NotFoundError
  | ValidationError
  | CannotAdvanceError

export class AdvanceTurnUseCase {
  constructor(
    private readonly svincolatiRepository: ISvincolatiRepository
  ) {}

  async execute(
    dto: AdvanceTurnDto
  ): Promise<Result<AdvanceTurnResultDto, AdvanceTurnError>> {
    // Step 1: Get and validate session
    const session = await this.svincolatiRepository.getSession(dto.sessionId)

    if (!session) {
      return fail(new NotFoundError('Sessione non trovata', { sessionId: dto.sessionId }))
    }

    // Step 2: Check session is in a state that allows advancing
    // Typically called after PENDING_ACK when all acknowledged
    if (session.status !== 'PENDING_ACK' && session.status !== 'AUCTION') {
      return fail(
        new CannotAdvanceError({
          currentStatus: session.status,
          allowedStatuses: ['PENDING_ACK', 'AUCTION']
        })
      )
    }

    // Step 3: Get current turn order
    const turnOrder = await this.svincolatiRepository.getTurnOrder(dto.sessionId)

    if (turnOrder.length === 0) {
      return fail(new ValidationError('Nessun ordine turni trovato', { sessionId: dto.sessionId }))
    }

    // Step 4: The previous nominator successfully nominated, so they get to continue
    // (they didn't pass - they participated)
    // Reset their pass status if it was set
    const previousNominatorId = session.currentNominatorId
    if (previousNominatorId) {
      // Member who nominated doesn't count as passed
      const prevEntry = turnOrder.find(t => t.memberId === previousNominatorId)
      if (prevEntry && prevEntry.hasPassed) {
        // This shouldn't happen normally, but reset just in case
        // The implementation would need to handle this in the repository
      }
    }

    // Step 5: Check if all members are finished
    if (allMembersFinished(turnOrder)) {
      await this.svincolatiRepository.updateSession(dto.sessionId, {
        status: 'COMPLETED',
        currentNominatorId: null
      })

      return ok({
        nextMemberId: null,
        nextMemberUsername: null,
        newRoundStarted: false,
        currentRound: session.currentRound,
        sessionCompleted: true
      })
    }

    // Step 6: Find next member who hasn't passed or finished
    const currentIndex = turnOrder.findIndex(t => t.memberId === previousNominatorId)
    const nextEntry = await this.svincolatiRepository.advanceToNextMember(dto.sessionId)

    // Step 7: Check if we need to start a new round
    if (!nextEntry || allMembersPassed(turnOrder)) {
      // All have passed or finished this round
      // Check if we should start a new round

      // Reset all passes for new round
      await this.svincolatiRepository.resetPasses(dto.sessionId)

      // Increment round
      const newRound = session.currentRound + 1

      // Check if max rounds reached
      if (newRound > session.totalRounds) {
        await this.svincolatiRepository.updateSession(dto.sessionId, {
          status: 'COMPLETED',
          currentNominatorId: null
        })

        return ok({
          nextMemberId: null,
          nextMemberUsername: null,
          newRoundStarted: false,
          currentRound: session.currentRound,
          sessionCompleted: true
        })
      }

      // Start new round - get first non-finished member
      const refreshedTurnOrder = await this.svincolatiRepository.getTurnOrder(dto.sessionId)
      const firstActive = refreshedTurnOrder.find(t => !t.hasFinished)

      if (!firstActive) {
        // Everyone finished
        await this.svincolatiRepository.updateSession(dto.sessionId, {
          status: 'COMPLETED',
          currentNominatorId: null
        })

        return ok({
          nextMemberId: null,
          nextMemberUsername: null,
          newRoundStarted: false,
          currentRound: session.currentRound,
          sessionCompleted: true
        })
      }

      // Update session for new round
      await this.svincolatiRepository.updateSession(dto.sessionId, {
        status: 'READY_CHECK',
        currentNominatorId: firstActive.memberId,
        currentRound: newRound
      })

      // Get username
      const members = await this.svincolatiRepository.getActiveMembers(dto.sessionId)
      const nextMember = members.find(m => m.id === firstActive.memberId)

      return ok({
        nextMemberId: firstActive.memberId,
        nextMemberUsername: nextMember?.username ?? null,
        newRoundStarted: true,
        currentRound: newRound,
        sessionCompleted: false
      })
    }

    // Step 8: Update session with next nominator
    await this.svincolatiRepository.updateSession(dto.sessionId, {
      status: 'READY_CHECK',
      currentNominatorId: nextEntry.memberId
    })

    // Get username
    const members = await this.svincolatiRepository.getActiveMembers(dto.sessionId)
    const nextMember = members.find(m => m.id === nextEntry.memberId)

    return ok({
      nextMemberId: nextEntry.memberId,
      nextMemberUsername: nextMember?.username ?? null,
      newRoundStarted: false,
      currentRound: session.currentRound,
      sessionCompleted: false
    })
  }
}
