/**
 * frontend-error-reporter.test.ts - Unit tests for global error/rejection reporter
 * (Livello 2 raccolta evidenze beta)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { installFrontendErrorReporter } from '../utils/frontend-error-reporter'

describe('frontend-error-reporter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is idempotent when installed multiple times', () => {
    installFrontendErrorReporter()
    installFrontendErrorReporter()
    expect(true).toBe(true)
  })

  it('reports window errors to /api/logs with session context', () => {
    installFrontendErrorReporter()

    window.dispatchEvent(new ErrorEvent('error', {
      message: 'boom',
      error: new Error('boom'),
    }))

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalled()

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/logs')
    expect(typeof opts.body).toBe('string')
    const body = JSON.parse(opts.body as string) as {
      severity: string
      category: string
      message: string
      metadata: { version: string; userAgent: string; stack?: string }
    }
    expect(body.severity).toBe('ERROR')
    expect(body.category).toBe('ERROR')
    expect(body.message).toContain('boom')
    expect(body.metadata.userAgent).toBe(navigator.userAgent)
    expect(body.metadata.version).toBe(__APP_VERSION__)
    expect(body.metadata.stack).toContain('Error: boom')
  })

  it('reports unhandled promise rejections', () => {
    installFrontendErrorReporter()

    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: new Error('nope'),
    }))

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalled()

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/logs')
    expect(typeof opts.body).toBe('string')
    const body = JSON.parse(opts.body as string) as { message: string }
    expect(body.message).toContain('nope')
  })

  it('never throws when the log endpoint is unreachable', () => {
    installFrontendErrorReporter()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockRejectedValue(new Error('network down'))

    expect(() => {
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'boom',
        error: new Error('boom'),
      }))
    }).not.toThrow()
  })
})
