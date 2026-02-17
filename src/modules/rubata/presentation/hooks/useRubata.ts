/**
 * Rubata Module - useRubata Hook
 *
 * Custom hook for managing rubata (recurring market) auction state.
 * Handles player stealing and board-based auctions.
 */

import { useCallback, useState, useEffect } from 'react'
import { rubataApi } from '@/services/api'
import {
  usePusherAuction,
  type RubataStealDeclaredData,
  type RubataBidPlacedData,
  type RubataReadyChangedData,
} from '@/services/pusher.client'

export interface RubataPlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  ownerId: string
  ownerUsername: string
  ownerTeamName: string
}

export interface RubataBoardEntry {
  id: string
  player: RubataPlayer
  status: 'PENDING' | 'OFFERED' | 'AUCTION' | 'SOLD' | 'UNSOLD' | 'SKIPPED'
  currentIndex: number
  offerId: string | null
  offerMemberId: string | null
  offerMemberUsername: string | null
  offerTimerRemaining: number | null
  auctionId: string | null
  auctionCurrentBid: number | null
  auctionCurrentBidderId: string | null
  auctionCurrentBidderUsername: string | null
  auctionTimerRemaining: number | null
}

export interface RubataBoardState {
  sessionId: string
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED'
  currentPhase: 'READY_CHECK' | 'OFFERING' | 'AUCTION' | 'ACKNOWLEDGMENT'
  board: RubataBoardEntry[]
  currentIndex: number
  currentEntry: RubataBoardEntry | null
  offerTimerSeconds: number
  auctionTimerSeconds: number
  readyMembers: string[]
  totalMembers: number
}

export interface UseRubataOptions {
  onStealDeclared?: (data: RubataStealDeclaredData) => void
  onBidPlaced?: (data: RubataBidPlacedData) => void
  onReadyChanged?: (data: RubataReadyChangedData) => void
}

export interface UseRubataResult {
  state: RubataBoardState | null
  isLoading: boolean
  error: string | null
  isConnected: boolean
  // Actions
  makeOffer: () => Promise<{ success: boolean; message?: string }>
  bid: (amount: number) => Promise<{ success: boolean; message?: string }>
  setReady: () => Promise<{ success: boolean; message?: string }>
  acknowledge: (prophecy?: string) => Promise<{ success: boolean; message?: string }>
  refresh: () => Promise<void>
}

/**
 * Hook for managing rubata (recurring market) state with real-time updates
 * @param leagueId - The league ID
 * @param sessionId - The session ID for Pusher subscription
 * @param options - Event callbacks
 */
export function useRubata(
  leagueId: string | undefined,
  sessionId: string | undefined,
  options: UseRubataOptions = {}
): UseRubataResult {
  const [state, setState] = useState<RubataBoardState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Subscribe to Pusher events
  const { isConnected } = usePusherAuction(sessionId, {
    onRubataStealDeclared: (data) => {
      // Handle steal declared event
      options.onStealDeclared?.(data)
      void refresh()
    },
    onRubataBidPlaced: (data) => {
      // Update local state with new bid
      setState((prev) =>
        prev && prev.currentEntry
          ? {
              ...prev,
              currentEntry: {
                ...prev.currentEntry,
                auctionCurrentBid: data.amount,
                auctionCurrentBidderId: data.bidderId,
                auctionCurrentBidderUsername: data.bidderUsername,
              },
            }
          : prev
      )
      options.onBidPlaced?.(data)
    },
    onRubataReadyChanged: (data) => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              readyMembers: data.isReady
                ? [...new Set([...prev.readyMembers, data.memberId])]
                : prev.readyMembers.filter((id) => id !== data.memberId),
              totalMembers: data.totalMembers,
            }
          : prev
      )
      options.onReadyChanged?.(data)
    },
  })

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setState(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await rubataApi.getBoard(leagueId)

      if (response.success && response.data) {
        setState(response.data as RubataBoardState)
      } else {
        setError(response.message || 'Failed to load rubata state')
      }
    } catch (_err) {
      setError('Failed to load rubata state')
      console.error('useRubata error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  // Initial fetch
  useEffect(() => {
    void refresh()
  }, [refresh])

  const makeOffer = useCallback(async () => {
    if (!leagueId) return { success: false, message: 'No league ID' }

    try {
      const response = await rubataApi.makeOffer(leagueId)
      if (response.success) await refresh()
      return { success: response.success, message: response.message }
    } catch (_err) {
      return { success: false, message: 'Failed to make offer' }
    }
  }, [leagueId, refresh])

  const bid = useCallback(
    async (amount: number) => {
      if (!leagueId) return { success: false, message: 'No league ID' }

      try {
        const response = await rubataApi.bidOnAuction(leagueId, amount)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to place bid' }
      }
    },
    [leagueId, refresh]
  )

  const setReady = useCallback(async () => {
    if (!leagueId) return { success: false, message: 'No league ID' }

    try {
      const response = await rubataApi.setReady(leagueId)
      if (response.success) await refresh()
      return { success: response.success, message: response.message }
    } catch (_err) {
      return { success: false, message: 'Failed to set ready' }
    }
  }, [leagueId, refresh])

  const acknowledge = useCallback(
    async (prophecy?: string) => {
      if (!leagueId) return { success: false, message: 'No league ID' }

      try {
        const response = await rubataApi.acknowledge(leagueId, prophecy)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to acknowledge' }
      }
    },
    [leagueId, refresh]
  )

  return {
    state,
    isLoading,
    error,
    isConnected,
    makeOffer,
    bid,
    setReady,
    acknowledge,
    refresh,
  }
}
