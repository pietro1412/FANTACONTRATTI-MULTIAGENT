/**
 * HTTP Infrastructure exports
 * Provides error handling, result types, and Express middleware
 */

// Error classes
export {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  // Domain-specific errors
  AuctionClosedError,
  InsufficientBudgetError,
  OutbidError,
  NotYourTurnError,
  SessionNotActiveError,
  PlayerNotFoundError,
  TeamNotFoundError,
  SessionNotFoundError,
} from './errors'

// Error handler middleware
export {
  errorHandler,
  asyncHandler,
  notFoundHandler,
} from './error-handler'

// Result type for use cases
export {
  Success,
  Failure,
  ok,
  fail,
  combine,
  tryCatch,
  tryCatchAsync,
  isSuccess,
  isFailure,
} from './result'
export type { Result } from './result'
