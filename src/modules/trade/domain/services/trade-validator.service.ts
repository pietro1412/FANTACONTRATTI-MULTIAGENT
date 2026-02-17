/**
 * Trade Validator Service - Domain Layer
 * Provides validation logic for trade operations
 */

import type { TradeOffer } from '../entities/trade-offer.entity'
import type { ITradeRepository } from '../repositories/trade.repository.interface'

/**
 * Result of asset validation
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Interface for trade validation operations
 */
export interface ITradeValidator {
  /**
   * Validates trade doesn't create circular loop (A->B, B->A in same session)
   * @param trade - The trade offer to validate
   * @returns Promise resolving to boolean indicating if trade is valid (no loop)
   */
  validateAntiLoop(trade: TradeOffer): Promise<boolean>

  /**
   * Validates both parties have required players/budget
   * @param trade - The trade offer to validate
   * @returns Promise resolving to validation result
   */
  validateAssets(trade: TradeOffer): Promise<ValidationResult>

  /**
   * Check if trade window is open for the league
   * @param leagueId - The league ID
   * @returns Promise resolving to boolean indicating if trade window is open
   */
  isTradeWindowOpen(leagueId: string): Promise<boolean>
}

/**
 * Implementation of trade validation service
 */
export class TradeValidatorService implements ITradeValidator {
  constructor(private readonly tradeRepository: ITradeRepository) {}

  /**
   * Validates that the trade doesn't create a circular loop
   * In the same market session, A cannot trade with B if B has already traded with A
   */
  async validateAntiLoop(trade: TradeOffer): Promise<boolean> {
    if (!trade.marketSessionId) {
      // No session context, can't check for loops
      return true
    }

    // Check if there's already an accepted trade from receiver to sender in this session
    const reverseTrades = await this.tradeRepository.findAcceptedTradesInSession(
      trade.marketSessionId,
      trade.receiverId,
      trade.senderId
    )

    // If any reverse trade exists, this would create a loop
    return reverseTrades.length === 0
  }

  /**
   * Validates that both parties have the required assets for the trade
   */
  async validateAssets(trade: TradeOffer): Promise<ValidationResult> {
    const errors: string[] = []

    // Validate sender's players
    if (trade.senderPlayers.length > 0) {
      const senderRosters = await this.tradeRepository.getRosterInfo(trade.senderPlayers)

      for (const playerId of trade.senderPlayers) {
        const roster = senderRosters.find(r => r.id === playerId)
        if (!roster) {
          errors.push(`Giocatore offerto non trovato: ${playerId}`)
          continue
        }
        if (roster.leagueMemberId !== trade.senderId) {
          errors.push('Alcuni giocatori offerti non sono nella tua rosa')
        }
        if (roster.status !== 'ACTIVE') {
          errors.push('Alcuni giocatori offerti non sono attivi')
        }
      }
    }

    // Validate receiver's players
    if (trade.receiverPlayers.length > 0) {
      const receiverRosters = await this.tradeRepository.getRosterInfo(trade.receiverPlayers)

      for (const playerId of trade.receiverPlayers) {
        const roster = receiverRosters.find(r => r.id === playerId)
        if (!roster) {
          errors.push(`Giocatore richiesto non trovato: ${playerId}`)
          continue
        }
        if (roster.leagueMemberId !== trade.receiverId) {
          errors.push('Alcuni giocatori richiesti non sono nella rosa del destinatario')
        }
        if (roster.status !== 'ACTIVE') {
          errors.push('Alcuni giocatori richiesti non sono attivi')
        }
      }
    }

    // Validate sender's budget
    if (trade.senderBudget > 0) {
      const senderBudget = await this.tradeRepository.getMemberBudget(trade.senderId)
      if (!senderBudget) {
        errors.push('Impossibile verificare il budget del mittente')
      } else if (trade.senderBudget > senderBudget.currentBudget) {
        errors.push(`Budget insufficiente. Disponibile: ${senderBudget.currentBudget}`)
      }
    }

    // Validate receiver's budget (for counter-offer validation)
    if (trade.receiverBudget > 0) {
      const receiverBudget = await this.tradeRepository.getMemberBudget(trade.receiverId)
      if (!receiverBudget) {
        errors.push('Impossibile verificare il budget del destinatario')
      } else if (trade.receiverBudget > receiverBudget.currentBudget) {
        errors.push(`Il destinatario non ha abbastanza budget. Richiesto: ${trade.receiverBudget}, Disponibile: ${receiverBudget.currentBudget}`)
      }
    }

    // Validate that something is being traded
    if (
      trade.senderPlayers.length === 0 &&
      trade.receiverPlayers.length === 0 &&
      trade.senderBudget === 0 &&
      trade.receiverBudget === 0
    ) {
      errors.push('Devi offrire o richiedere almeno qualcosa')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Check if trade window is open for the league
   */
  async isTradeWindowOpen(leagueId: string): Promise<boolean> {
    return this.tradeRepository.isTradeWindowOpen(leagueId)
  }
}
