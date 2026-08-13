/**
 * app-meta.test.ts - Unit tests for session context helpers
 * (Livello 2 raccolta evidenze beta)
 */

import { describe, it, expect } from 'vitest'
import { getPageContext, buildSessionMetadata } from '../utils/app-meta'

describe('getPageContext', () => {
  it('extracts league subpage from path', () => {
    window.history.pushState({}, '', '/leagues/abc123/contracts')
    expect(getPageContext()).toBe('contracts')
  })

  it('returns league for a bare league route', () => {
    window.history.pushState({}, '', '/leagues/abc123')
    expect(getPageContext()).toBe('league')
  })

  it('returns home for root', () => {
    window.history.pushState({}, '', '/')
    expect(getPageContext()).toBe('home')
  })

  it('returns full path for non-league routes', () => {
    window.history.pushState({}, '', '/dashboard')
    expect(getPageContext()).toBe('dashboard')
  })

  it('returns the full subpath for nested league pages', () => {
    window.history.pushState({}, '', '/leagues/abc123/strategie-rubata')
    expect(getPageContext()).toBe('strategie-rubata')
  })
})

describe('buildSessionMetadata', () => {
  it('includes build, viewport and route context', () => {
    window.history.pushState({}, '', '/leagues/abc123/contracts')
    const meta = buildSessionMetadata()

    expect(meta.version).toBe(__APP_VERSION__)
    expect(meta.commit).toBe(__GIT_COMMIT__)
    expect(meta.branch).toBe(__GIT_BRANCH__)
    expect(meta.userAgent).toBe(navigator.userAgent)
    expect(meta.viewport).toMatch(/^\d+x\d+$/)
    expect(meta.route).toBe('/leagues/abc123/contracts')
  })

  it('returns a known device type', () => {
    const meta = buildSessionMetadata()
    expect(['desktop', 'tablet', 'mobile', 'unknown']).toContain(meta.deviceType)
  })
})
