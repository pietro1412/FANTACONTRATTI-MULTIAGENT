/**
 * Validate Anti-Loop Use Case - Application Layer
 * Checks for circular trades in the same market session
 */

import type { ITradeRepository } from '../../domain/repositories/trade.repository.interface'
import type { TradeOffer } from '../../domain/entities/trade-offer.entity'
import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import type { ValidationError} from '@/shared/infrastructure/http/errors';
import { InternalError } from '@/shared/infrastructure/http/errors'

/**
 * Input for anti-loop validation
 */
export interface ValidateAntiLoopInput {
  leagueId: string
  senderId: string
  receiverId: string
  marketSessionId?: string
}

/**
 * Output of anti-loop validation
 */
export interface ValidateAntiLoopOutput {
  isValid: boolean
  reason?: string
  existingTrades?: Array<{
    tradeId: string
    direction: 'forward' | 'reverse'
  }>
}

/**
 * Use case for validating anti-loop rule
 *
 * Business rules:
 * - Checks for circular trades (A->B, B->A in same session)
 * - Also detects multi-hop loops (A->B, B->C, C->A)
 * - Returns validation result with existing trades if loop detected
 */
export class ValidateAntiLoopUseCase {
  constructor(private readonly tradeRepository: ITradeRepository) {}

  /**
   * Execute the anti-loop validation
   * @param input - The validation parameters
   * @returns Result containing the validation result or error
   */
  async execute(
    input: ValidateAntiLoopInput
  ): Promise<Result<ValidateAntiLoopOutput, ValidationError | InternalError>> {
    try {
      // If no session context, we can't check for loops
      if (!input.marketSessionId) {
        const activeSessionId = await this.tradeRepository.getActiveMarketSessionId(input.leagueId)
        if (!activeSessionId) {
          // No active session, no loop possible
          return ok({
            isValid: true,
          })
        }
        input.marketSessionId = activeSessionId
      }

      // Check for direct reverse trades (A->B when B->A already accepted)
      const reverseTrades = await this.tradeRepository.findAcceptedTradesInSession(
        input.marketSessionId,
        input.receiverId,
        input.senderId
      )

      if (reverseTrades.length > 0) {
        return ok({
          isValid: false,
          reason: 'Non puoi fare uno scambio inverso nella stessa sessione di mercato',
          existingTrades: reverseTrades.map(t => ({
            tradeId: t.id,
            direction: 'reverse' as const,
          })),
        })
      }

      // Check for multi-hop loops (A->B->C->A)
      // This is more complex - we need to check if there's a path from receiver back to sender
      const loopExists = await this.checkMultiHopLoop(
        input.marketSessionId,
        input.senderId,
        input.receiverId,
        new Set<string>()
      )

      if (loopExists) {
        return ok({
          isValid: false,
          reason: 'Questo scambio creerebbe un ciclo circolare nella stessa sessione',
        })
      }

      return ok({
        isValid: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nella validazione anti-loop'
      return fail(new InternalError(message))
    }
  }

  /**
   * Check for multi-hop loops using DFS
   * @param sessionId - Market session ID
   * @param targetId - The target member we're looking for (original sender)
   * @param currentId - Current member in the search
   * @param visited - Set of already visited members
   * @returns true if a loop exists
   */
  private async checkMultiHopLoop(
    sessionId: string,
    targetId: string,
    currentId: string,
    visited: Set<string>
  ): Promise<boolean> {
    // Prevent infinite loops in search
    if (visited.has(currentId)) {
      return false
    }

    visited.add(currentId)

    // Get all accepted trades where currentId is the sender
    const allLeagueTrades = await this.tradeRepository.findByLeague(sessionId)
    const outgoingTrades = allLeagueTrades.filter(
      t =>
        t.marketSessionId === sessionId &&
        t.senderId === currentId &&
        t.status === 'ACCEPTED'
    )

    for (const trade of outgoingTrades) {
      // If we found a path back to the target, we have a loop
      if (trade.receiverId === targetId) {
        return true
      }

      // Recursively check from this receiver
      const hasLoop = await this.checkMultiHopLoop(sessionId, targetId, trade.receiverId, visited)
      if (hasLoop) {
        return true
      }
    }

    return false
  }
}

/**
 * Simplified anti-loop check for use in trade validation
 * Just checks direct reverse trades
 */
export async function checkAntiLoopSimple(
  tradeRepository: ITradeRepository,
  trade: TradeOffer
): Promise<boolean> {
  if (!trade.marketSessionId) {
    return true // No session context, can't check
  }

  const reverseTrades = await tradeRepository.findAcceptedTradesInSession(
    trade.marketSessionId,
    trade.receiverId,
    trade.senderId
  )

  return reverseTrades.length === 0
}
