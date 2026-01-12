/**
 * Custom error classes for FANTACONTRATTI application
 * Provides a structured error handling system with status codes and operational flags
 */

// Base error class
export abstract class AppError extends Error {
  abstract readonly statusCode: number
  abstract readonly isOperational: boolean

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: this.context,
    }
  }
}

// HTTP 400 - Bad Request
export class ValidationError extends AppError {
  readonly statusCode = 400
  readonly isOperational = true
}

// HTTP 401 - Unauthorized
export class UnauthorizedError extends AppError {
  readonly statusCode = 401
  readonly isOperational = true
}

// HTTP 403 - Forbidden
export class ForbiddenError extends AppError {
  readonly statusCode = 403
  readonly isOperational = true
}

// HTTP 404 - Not Found
export class NotFoundError extends AppError {
  readonly statusCode = 404
  readonly isOperational = true
}

// HTTP 409 - Conflict
export class ConflictError extends AppError {
  readonly statusCode = 409
  readonly isOperational = true
}

// HTTP 429 - Too Many Requests
export class RateLimitError extends AppError {
  readonly statusCode = 429
  readonly isOperational = true
}

// HTTP 500 - Internal Server Error
export class InternalError extends AppError {
  readonly statusCode = 500
  readonly isOperational = false
}

// Domain-specific errors

/**
 * Thrown when attempting to bid on a closed auction
 */
export class AuctionClosedError extends ConflictError {
  constructor(context?: Record<string, unknown>) {
    super('L\'asta è chiusa e non accetta più offerte', context)
  }
}

/**
 * Thrown when a team doesn't have enough budget to place a bid
 */
export class InsufficientBudgetError extends ValidationError {
  constructor(context?: Record<string, unknown>) {
    super('Budget insufficiente per questa offerta', context)
  }
}

/**
 * Thrown when a bid has been outbid by another team
 */
export class OutbidError extends ConflictError {
  constructor(context?: Record<string, unknown>) {
    super('La tua offerta è stata superata', context)
  }
}

/**
 * Thrown when a team tries to bid when it's not their turn
 */
export class NotYourTurnError extends ForbiddenError {
  constructor(context?: Record<string, unknown>) {
    super('Non è il tuo turno per fare offerte', context)
  }
}

/**
 * Thrown when trying to perform an action on an inactive session
 */
export class SessionNotActiveError extends ConflictError {
  constructor(context?: Record<string, unknown>) {
    super('La sessione non è attiva', context)
  }
}

/**
 * Thrown when a player is not found
 */
export class PlayerNotFoundError extends NotFoundError {
  constructor(context?: Record<string, unknown>) {
    super('Giocatore non trovato', context)
  }
}

/**
 * Thrown when a team is not found
 */
export class TeamNotFoundError extends NotFoundError {
  constructor(context?: Record<string, unknown>) {
    super('Squadra non trovata', context)
  }
}

/**
 * Thrown when a session is not found
 */
export class SessionNotFoundError extends NotFoundError {
  constructor(context?: Record<string, unknown>) {
    super('Sessione non trovata', context)
  }
}
