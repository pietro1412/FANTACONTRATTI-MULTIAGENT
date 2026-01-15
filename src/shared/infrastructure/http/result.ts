/**
 * Result type for clean error handling in use cases
 * Provides a functional approach to error handling without exceptions
 */

import { AppError } from './errors'

/**
 * Represents a successful result containing a value
 */
export class Success<T> {
  readonly isSuccess = true as const
  readonly isFailure = false as const

  constructor(readonly value: T) {}

  /**
   * Maps the success value to a new value
   */
  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Success(fn(this.value))
  }

  /**
   * Chains another Result-returning operation
   */
  flatMap<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value)
  }

  /**
   * Gets the value or returns a default (returns the value)
   */
  getOrElse(_defaultValue: T): T {
    return this.value
  }

  /**
   * Executes a callback if successful
   */
  onSuccess(fn: (value: T) => void): this {
    fn(this.value)
    return this
  }

  /**
   * Executes a callback if failed (does nothing for Success)
   */
  onFailure(_fn: (error: never) => void): this {
    return this
  }
}

/**
 * Represents a failed result containing an error
 */
export class Failure<E> {
  readonly isSuccess = false as const
  readonly isFailure = true as const

  constructor(readonly error: E) {}

  /**
   * Maps the success value (does nothing for Failure)
   */
  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this as unknown as Failure<E>
  }

  /**
   * Chains another Result-returning operation (does nothing for Failure)
   */
  flatMap<U, E2>(_fn: (value: never) => Result<U, E2>): Result<U, E | E2> {
    return this as unknown as Failure<E>
  }

  /**
   * Gets the value or returns a default (returns the default)
   */
  getOrElse<T>(defaultValue: T): T {
    return defaultValue
  }

  /**
   * Executes a callback if successful (does nothing for Failure)
   */
  onSuccess(_fn: (value: never) => void): this {
    return this
  }

  /**
   * Executes a callback if failed
   */
  onFailure(fn: (error: E) => void): this {
    fn(this.error)
    return this
  }
}

/**
 * Union type representing either a Success or Failure
 */
export type Result<T, E = AppError> = Success<T> | Failure<E>

/**
 * Creates a successful Result
 */
export const ok = <T>(value: T): Success<T> => new Success(value)

/**
 * Creates a failed Result
 */
export const fail = <E>(error: E): Failure<E> => new Failure(error)

/**
 * Combines multiple Results into a single Result
 * If all are successful, returns Success with array of values
 * If any fail, returns the first Failure
 */
export const combine = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = []

  for (const result of results) {
    if (result.isFailure) {
      return result as unknown as Failure<E>
    }
    values.push(result.value)
  }

  return ok(values)
}

/**
 * Wraps a function that might throw into a Result
 */
export const tryCatch = <T, E = Error>(
  fn: () => T,
  onError: (error: unknown) => E
): Result<T, E> => {
  try {
    return ok(fn())
  } catch (error) {
    return fail(onError(error))
  }
}

/**
 * Wraps an async function that might throw into a Result
 */
export const tryCatchAsync = async <T, E = Error>(
  fn: () => Promise<T>,
  onError: (error: unknown) => E
): Promise<Result<T, E>> => {
  try {
    const value = await fn()
    return ok(value)
  } catch (error) {
    return fail(onError(error))
  }
}

/**
 * Type guard to check if a Result is a Success
 */
export const isSuccess = <T, E>(result: Result<T, E>): result is Success<T> => {
  return result.isSuccess
}

/**
 * Type guard to check if a Result is a Failure
 */
export const isFailure = <T, E>(result: Result<T, E>): result is Failure<E> => {
  return result.isFailure
}
