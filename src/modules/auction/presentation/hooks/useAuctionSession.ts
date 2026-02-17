/**
 * Auction Module - useAuctionSession Hook
 *
 * Custom hook for managing auction sessions.
 * Provides session creation, listing, and phase management.
 */

import { useCallback, useState, useEffect } from 'react'
import { auctionApi } from '@/services/api'

export interface AuctionSession {
  id: string
  leagueId: string
  status: 'ACTIVE' | 'CLOSED'
  currentPhase: string
  isRegularMarket: boolean
  timerSeconds: number
  createdAt: string
  closedAt: string | null
}

export interface UseAuctionSessionResult {
  sessions: AuctionSession[]
  activeSession: AuctionSession | null
  isLoading: boolean
  error: string | null
  createSession: (isRegularMarket?: boolean) => Promise<{ success: boolean; sessionId?: string; message?: string }>
  closeSession: () => Promise<{ success: boolean; message?: string }>
  setPhase: (phase: string) => Promise<{ success: boolean; message?: string }>
  updateTimer: (timerSeconds: number) => Promise<{ success: boolean; message?: string }>
  refresh: () => Promise<void>
}

/**
 * Hook for managing auction sessions
 * @param leagueId - The league ID
 */
export function useAuctionSession(leagueId: string | undefined): UseAuctionSessionResult {
  const [sessions, setSessions] = useState<AuctionSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setSessions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await auctionApi.getSessions(leagueId)

      if (response.success && response.data) {
        setSessions(response.data as AuctionSession[])
      } else {
        setError(response.message || 'Failed to load sessions')
      }
    } catch (err) {
      setError('Failed to load sessions')
      console.error('useAuctionSession error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  // Find active session
  const activeSession = sessions.find((s) => s.status === 'ACTIVE') || null

  const createSession = useCallback(
    async (isRegularMarket) => {
      if (!leagueId) {
        return { success: false, message: 'No league ID' }
      }

      try {
        const response = await auctionApi.createSession(leagueId, isRegularMarket)

        if (response.success) {
          await refresh()
          return {
            success: true,
            sessionId: (response.data as { id: string })?.id,
          }
        }

        return { success: false, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to create session' }
      }
    },
    [leagueId, refresh]
  )

  const closeSession = useCallback(async () => {
    if (!activeSession) {
      return { success: false, message: 'No active session' }
    }

    try {
      const response = await auctionApi.closeSession(activeSession.id)

      if (response.success) {
        await refresh()
        return { success: true }
      }

      return { success: false, message: response.message }
    } catch (err) {
      return { success: false, message: 'Failed to close session' }
    }
  }, [activeSession, refresh])

  const setPhase = useCallback(
    async (phase: string) => {
      if (!activeSession) {
        return { success: false, message: 'No active session' }
      }

      try {
        const response = await auctionApi.setPhase(activeSession.id, phase)

        if (response.success) {
          await refresh()
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to set phase' }
      }
    },
    [activeSession, refresh]
  )

  const updateTimer = useCallback(
    async (timerSeconds: number) => {
      if (!activeSession) {
        return { success: false, message: 'No active session' }
      }

      try {
        const response = await auctionApi.updateSessionTimer(activeSession.id, timerSeconds)

        if (response.success) {
          await refresh()
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to update timer' }
      }
    },
    [activeSession, refresh]
  )

  return {
    sessions,
    activeSession,
    isLoading,
    error,
    createSession,
    closeSession,
    setPhase,
    updateTimer,
    refresh,
  }
}
