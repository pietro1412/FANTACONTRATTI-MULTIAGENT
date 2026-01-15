/**
 * Global error handler middleware for Express
 * - Logs errors appropriately (operational vs programmer errors)
 * - Returns consistent JSON error responses
 * - Hides internal details in production
 */

import { Request, Response, NextFunction } from 'express'
import { AppError } from './errors'

interface ErrorResponse {
  success: false
  error: {
    name: string
    message: string
    statusCode: number
    context?: Record<string, unknown>
    stack?: string
  }
}

/**
 * Determines if we're in production mode
 */
const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}

/**
 * Logs the error with appropriate severity
 */
const logError = (error: Error | AppError, req: Request): void => {
  const timestamp = new Date().toISOString()
  const requestInfo = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: (req as any).userId || 'anonymous',
  }

  if (error instanceof AppError) {
    if (error.isOperational) {
      // Operational errors are expected - log as warning
      console.warn(`[${timestamp}] OPERATIONAL ERROR:`, {
        ...requestInfo,
        error: {
          name: error.name,
          message: error.message,
          statusCode: error.statusCode,
          context: error.context,
        },
      })
    } else {
      // Programmer errors - log as error with stack
      console.error(`[${timestamp}] PROGRAMMER ERROR:`, {
        ...requestInfo,
        error: {
          name: error.name,
          message: error.message,
          statusCode: error.statusCode,
          context: error.context,
          stack: error.stack,
        },
      })
    }
  } else {
    // Unknown errors - log everything
    console.error(`[${timestamp}] UNKNOWN ERROR:`, {
      ...requestInfo,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })
  }
}

/**
 * Creates a standardized error response
 */
const createErrorResponse = (
  error: Error | AppError,
  includeStack: boolean
): ErrorResponse => {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        context: error.isOperational ? error.context : undefined,
        stack: includeStack ? error.stack : undefined,
      },
    }
  }

  // Unknown error - hide details in production
  return {
    success: false,
    error: {
      name: isProduction() ? 'InternalError' : error.name,
      message: isProduction()
        ? 'Si è verificato un errore interno del server'
        : error.message,
      statusCode: 500,
      stack: includeStack ? error.stack : undefined,
    },
  }
}

/**
 * Express error handling middleware
 * Must be registered after all routes
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log the error
  logError(error, req)

  // Determine status code
  const statusCode = error instanceof AppError ? error.statusCode : 500

  // Create response (hide stack in production)
  const response = createErrorResponse(error, !isProduction())

  // Send response
  res.status(statusCode).json(response)
}

/**
 * Async handler wrapper to catch async errors
 * Wraps async route handlers to properly forward errors to the error handler
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Not found handler for undefined routes
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new (class extends Error {
    statusCode = 404
    isOperational = true
  })(`Route non trovata: ${req.method} ${req.originalUrl}`)
  error.name = 'NotFoundError'
  next(error)
}
