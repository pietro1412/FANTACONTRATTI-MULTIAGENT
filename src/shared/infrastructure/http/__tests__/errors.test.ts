/**
 * Tests for error handling infrastructure
 */

import { describe, it, expect } from 'vitest'
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  AuctionClosedError,
  InsufficientBudgetError,
  OutbidError,
  NotYourTurnError,
  SessionNotActiveError,
  PlayerNotFoundError,
  TeamNotFoundError,
  SessionNotFoundError,
} from '../errors'
import type {
  Result} from '../result';
import {
  Success,
  Failure,
  ok,
  fail,
  combine,
  tryCatch,
  tryCatchAsync,
  isSuccess,
  isFailure,
} from '../result'

describe('Error Classes', () => {
  describe('Base HTTP Errors', () => {
    it('ValidationError has status code 400 and is operational', () => {
      const error = new ValidationError('Invalid input')
      expect(error.statusCode).toBe(400)
      expect(error.isOperational).toBe(true)
      expect(error.message).toBe('Invalid input')
      expect(error.name).toBe('ValidationError')
    })

    it('UnauthorizedError has status code 401 and is operational', () => {
      const error = new UnauthorizedError('Not authenticated')
      expect(error.statusCode).toBe(401)
      expect(error.isOperational).toBe(true)
    })

    it('ForbiddenError has status code 403 and is operational', () => {
      const error = new ForbiddenError('Access denied')
      expect(error.statusCode).toBe(403)
      expect(error.isOperational).toBe(true)
    })

    it('NotFoundError has status code 404 and is operational', () => {
      const error = new NotFoundError('Resource not found')
      expect(error.statusCode).toBe(404)
      expect(error.isOperational).toBe(true)
    })

    it('ConflictError has status code 409 and is operational', () => {
      const error = new ConflictError('Resource conflict')
      expect(error.statusCode).toBe(409)
      expect(error.isOperational).toBe(true)
    })

    it('RateLimitError has status code 429 and is operational', () => {
      const error = new RateLimitError('Too many requests')
      expect(error.statusCode).toBe(429)
      expect(error.isOperational).toBe(true)
    })

    it('InternalError has status code 500 and is NOT operational', () => {
      const error = new InternalError('Server error')
      expect(error.statusCode).toBe(500)
      expect(error.isOperational).toBe(false)
    })
  })

  describe('Context Preservation', () => {
    it('preserves context in error', () => {
      const context = { userId: '123', action: 'create' }
      const error = new ValidationError('Invalid input', context)
      expect(error.context).toEqual(context)
    })

    it('context is undefined when not provided', () => {
      const error = new ValidationError('Invalid input')
      expect(error.context).toBeUndefined()
    })

    it('toJSON includes all error properties', () => {
      const context = { field: 'email' }
      const error = new ValidationError('Invalid email', context)
      const json = error.toJSON()

      expect(json.name).toBe('ValidationError')
      expect(json.message).toBe('Invalid email')
      expect(json.statusCode).toBe(400)
      expect(json.isOperational).toBe(true)
      expect(json.context).toEqual(context)
    })
  })

  describe('Domain-Specific Errors', () => {
    it('AuctionClosedError extends ConflictError', () => {
      const error = new AuctionClosedError({ auctionId: '123' })
      expect(error.statusCode).toBe(409)
      expect(error.isOperational).toBe(true)
      expect(error.message).toBe("L'asta è chiusa e non accetta più offerte")
      expect(error.context).toEqual({ auctionId: '123' })
    })

    it('InsufficientBudgetError extends ValidationError', () => {
      const error = new InsufficientBudgetError({ budget: 100, required: 150 })
      expect(error.statusCode).toBe(400)
      expect(error.isOperational).toBe(true)
      expect(error.message).toBe('Budget insufficiente per questa offerta')
    })

    it('OutbidError extends ConflictError', () => {
      const error = new OutbidError({ currentBid: 50, newBid: 60 })
      expect(error.statusCode).toBe(409)
      expect(error.isOperational).toBe(true)
      expect(error.message).toBe('La tua offerta è stata superata')
    })

    it('NotYourTurnError extends ForbiddenError', () => {
      const error = new NotYourTurnError({ currentTurn: 'Team A' })
      expect(error.statusCode).toBe(403)
      expect(error.isOperational).toBe(true)
      expect(error.message).toBe('Non è il tuo turno per fare offerte')
    })

    it('SessionNotActiveError extends ConflictError', () => {
      const error = new SessionNotActiveError({ sessionId: '456' })
      expect(error.statusCode).toBe(409)
      expect(error.isOperational).toBe(true)
      expect(error.message).toBe('La sessione non è attiva')
    })

    it('PlayerNotFoundError extends NotFoundError', () => {
      const error = new PlayerNotFoundError({ playerId: '789' })
      expect(error.statusCode).toBe(404)
      expect(error.isOperational).toBe(true)
      expect(error.message).toBe('Giocatore non trovato')
    })

    it('TeamNotFoundError extends NotFoundError', () => {
      const error = new TeamNotFoundError({ teamId: 'abc' })
      expect(error.statusCode).toBe(404)
      expect(error.isOperational).toBe(true)
    })

    it('SessionNotFoundError extends NotFoundError', () => {
      const error = new SessionNotFoundError({ sessionId: 'xyz' })
      expect(error.statusCode).toBe(404)
      expect(error.isOperational).toBe(true)
    })
  })

  describe('Error Inheritance', () => {
    it('all errors are instances of AppError', () => {
      const errors = [
        new ValidationError('test'),
        new UnauthorizedError('test'),
        new ForbiddenError('test'),
        new NotFoundError('test'),
        new ConflictError('test'),
        new RateLimitError('test'),
        new InternalError('test'),
        new AuctionClosedError(),
        new InsufficientBudgetError(),
        new OutbidError(),
        new NotYourTurnError(),
        new SessionNotActiveError(),
      ]

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(AppError)
        expect(error).toBeInstanceOf(Error)
      })
    })

    it('captures stack trace', () => {
      const error = new ValidationError('test')
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ValidationError')
    })
  })
})

describe('Result Type', () => {
  describe('Success', () => {
    it('creates a Success result with ok()', () => {
      const result = ok(42)
      expect(result.isSuccess).toBe(true)
      expect(result.isFailure).toBe(false)
      expect(result.value).toBe(42)
    })

    it('Success is instance of Success class', () => {
      const result = ok('test')
      expect(result).toBeInstanceOf(Success)
    })

    it('map transforms the value', () => {
      const result = ok(10).map((x) => x * 2)
      expect(result.isSuccess).toBe(true)
      expect((result as Success<number>).value).toBe(20)
    })

    it('flatMap chains Results', () => {
      const result = ok(5).flatMap((x) => ok(x * 3))
      expect(result.isSuccess).toBe(true)
      expect((result as Success<number>).value).toBe(15)
    })

    it('getOrElse returns the value', () => {
      const result = ok('hello')
      expect(result.getOrElse('default')).toBe('hello')
    })

    it('onSuccess executes callback', () => {
      let called = false
      ok('test').onSuccess(() => {
        called = true
      })
      expect(called).toBe(true)
    })

    it('onFailure does not execute callback', () => {
      let called = false
      ok('test').onFailure(() => {
        called = true
      })
      expect(called).toBe(false)
    })
  })

  describe('Failure', () => {
    it('creates a Failure result with fail()', () => {
      const error = new ValidationError('Invalid')
      const result = fail(error)
      expect(result.isSuccess).toBe(false)
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe(error)
    })

    it('Failure is instance of Failure class', () => {
      const result = fail(new Error('test'))
      expect(result).toBeInstanceOf(Failure)
    })

    it('map does not transform (returns same Failure)', () => {
      const error = new ValidationError('Invalid')
      const result = fail(error).map((x: never) => x)
      expect(result.isFailure).toBe(true)
      expect((result as Failure<ValidationError>).error).toBe(error)
    })

    it('flatMap does not chain (returns same Failure)', () => {
      const error = new ValidationError('Invalid')
      const result = fail(error).flatMap(() => ok(10))
      expect(result.isFailure).toBe(true)
    })

    it('getOrElse returns the default value', () => {
      const result = fail(new Error('test'))
      expect(result.getOrElse('default')).toBe('default')
    })

    it('onSuccess does not execute callback', () => {
      let called = false
      fail(new Error('test')).onSuccess(() => {
        called = true
      })
      expect(called).toBe(false)
    })

    it('onFailure executes callback', () => {
      let called = false
      fail(new Error('test')).onFailure(() => {
        called = true
      })
      expect(called).toBe(true)
    })
  })

  describe('Type Guards', () => {
    it('isSuccess returns true for Success', () => {
      const result: Result<number, Error> = ok(42)
      expect(isSuccess(result)).toBe(true)
      expect(isFailure(result)).toBe(false)
    })

    it('isFailure returns true for Failure', () => {
      const result: Result<number, Error> = fail(new Error('test'))
      expect(isFailure(result)).toBe(true)
      expect(isSuccess(result)).toBe(false)
    })
  })

  describe('combine', () => {
    it('combines successful results into array', () => {
      const results = [ok(1), ok(2), ok(3)]
      const combined = combine(results)
      expect(combined.isSuccess).toBe(true)
      expect((combined as Success<number[]>).value).toEqual([1, 2, 3])
    })

    it('returns first failure when any result fails', () => {
      const error = new ValidationError('First error')
      const results = [ok(1), fail(error), ok(3)]
      const combined = combine(results)
      expect(combined.isFailure).toBe(true)
      expect((combined as Failure<ValidationError>).error).toBe(error)
    })

    it('handles empty array', () => {
      const combined = combine([])
      expect(combined.isSuccess).toBe(true)
      expect((combined as Success<unknown[]>).value).toEqual([])
    })
  })

  describe('tryCatch', () => {
    it('returns Success when function succeeds', () => {
      const result = tryCatch(
        () => 42,
        (e) => new Error(String(e))
      )
      expect(result.isSuccess).toBe(true)
      expect((result as Success<number>).value).toBe(42)
    })

    it('returns Failure when function throws', () => {
      const result = tryCatch(
        () => {
          throw new Error('Oops')
        },
        (e) => new ValidationError((e as Error).message)
      )
      expect(result.isFailure).toBe(true)
      expect((result as Failure<ValidationError>).error.message).toBe('Oops')
    })
  })

  describe('tryCatchAsync', () => {
    it('returns Success when async function succeeds', async () => {
      const result = await tryCatchAsync(
        async () => 42,
        (e) => new Error(String(e))
      )
      expect(result.isSuccess).toBe(true)
      expect((result as Success<number>).value).toBe(42)
    })

    it('returns Failure when async function throws', async () => {
      const result = await tryCatchAsync(
        async () => {
          throw new Error('Async error')
        },
        (e) => new ValidationError((e as Error).message)
      )
      expect(result.isFailure).toBe(true)
      expect((result as Failure<ValidationError>).error.message).toBe(
        'Async error'
      )
    })

    it('returns Failure when Promise rejects', async () => {
      const result = await tryCatchAsync(
        () => Promise.reject(new Error('Rejected')),
        (e) => new ValidationError((e as Error).message)
      )
      expect(result.isFailure).toBe(true)
      expect((result as Failure<ValidationError>).error.message).toBe('Rejected')
    })
  })
})
