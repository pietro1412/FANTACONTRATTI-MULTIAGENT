/**
 * Setup Svincolati Use Case - Application Layer
 *
 * Handles the initialization of a svincolati session.
 * Calculates turn order based on budget and sets the first nominator.
 */

import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import { NotFoundError, ValidationError, ConflictError } from '@/shared/infrastructure/http/errors'
import type { ISvincolatiRepository } from '../../domain/repositories/svincolati.repository.interface'
import type { SetupSvincolatiDto, SetupSvincolatiResultDto, TurnOrderMemberDto } from '../dto/svincolati.dto'
import { calculateTurnOrderByBudget } from '../../domain/entities/turn-order.entity'
import { DEFAULT_SVINCOLATI_TIMER_SECONDS } from '../../domain/entities/svincolati-session.entity'

export class SetupSvincolatiUseCase {
  constructor(
    private readonly svincolatiRepository: ISvincolatiRepository
  ) {}

  async execute(
    dto: SetupSvincolatiDto
  ): Promise<Result<SetupSvincolatiResultDto, NotFoundError | ValidationError | ConflictError>> {
    // Get the session
    const session = await this.svincolatiRepository.getSession(dto.sessionId)

    if (!session) {
      return fail(new NotFoundError('Sessione non trovata', { sessionId: dto.sessionId }))
    }

    // Check session is in SETUP status
    if (session.status !== 'SETUP') {
      return fail(
        new ConflictError('La sessione svincolati è già stata configurata', {
          currentStatus: session.status
        })
      )
    }

    // Get all active members for the league
    const members = await this.svincolatiRepository.getActiveMembers(dto.sessionId)

    if (members.length < 2) {
      return fail(
        new ValidationError('Servono almeno 2 membri attivi per avviare la sessione svincolati', {
          memberCount: members.length
        })
      )
    }

    // Calculate turn order
    let turnOrderMemberIds: string[]

    if (dto.customTurnOrder && dto.customTurnOrder.length > 0) {
      // Use custom turn order if provided
      // Validate that all member IDs are valid
      const memberIdSet = new Set(members.map(m => m.id))
      const invalidIds = dto.customTurnOrder.filter(id => !memberIdSet.has(id))

      if (invalidIds.length > 0) {
        return fail(
          new ValidationError('Alcuni ID membri non sono validi', {
            invalidIds
          })
        )
      }

      // Validate that all members are included
      if (dto.customTurnOrder.length !== members.length) {
        return fail(
          new ValidationError('L\'ordine turni deve includere tutti i membri', {
            provided: dto.customTurnOrder.length,
            expected: members.length
          })
        )
      }

      turnOrderMemberIds = dto.customTurnOrder
    } else {
      // Calculate turn order by budget (lowest first)
      const membersWithBudget = members.map(m => ({
        id: m.id,
        currentBudget: m.currentBudget,
        username: m.username
      }))

      turnOrderMemberIds = calculateTurnOrderByBudget(membersWithBudget)
    }

    // Set the turn order in repository
    await this.svincolatiRepository.setTurnOrder(dto.sessionId, turnOrderMemberIds)

    // Determine timer seconds
    const timerSeconds = dto.timerSeconds ?? DEFAULT_SVINCOLATI_TIMER_SECONDS

    // Update session to READY_CHECK status with first nominator
    const firstNominatorId = turnOrderMemberIds[0]

    await this.svincolatiRepository.updateSession(dto.sessionId, {
      status: 'READY_CHECK',
      currentNominatorId: firstNominatorId,
      currentRound: 1,
      timerSeconds
    })

    // Build the result with turn order details
    const turnOrderResult: TurnOrderMemberDto[] = turnOrderMemberIds.map((memberId, index) => {
      const member = members.find(m => m.id === memberId)!
      return {
        memberId,
        username: member.username,
        budget: member.currentBudget,
        orderIndex: index,
        hasPassed: false,
        hasFinished: false
      }
    })

    const firstNominator = members.find(m => m.id === firstNominatorId)!

    return ok({
      sessionId: dto.sessionId,
      turnOrder: turnOrderResult,
      firstNominatorId,
      firstNominatorUsername: firstNominator.username,
      timerSeconds
    })
  }
}
