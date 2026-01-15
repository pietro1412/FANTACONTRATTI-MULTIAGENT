/**
 * Auction Module - useAuction Hook
 *
 * Custom hook for managing auction state and real-time updates.
 * Subscribes to Pusher events and provides auction actions.
 */

import { useCallback, useState, useEffect } from 'react'
import { auctionApi } from '@/services/api'
import {
  usePusherAuction,
  type BidPlacedData,
  type NominationPendingData,
  type NominationConfirmedData,
  type MemberReadyData,
  type AuctionClosedData,
  type TimerUpdateData,
} from '@/services/pusher.client'

export interface AuctionPlayer {
  id: string
  name: string
  team: string
  position: string
  quotation: number
}

export interface CurrentAuction {
  id: string
  playerId: string
  player: AuctionPlayer
  currentBid: number
  currentBidderId: string | null
  currentBidderName: string | null
  nominatorId: string
  nominatorName: string
  status: 'PENDING' | 'ACTIVE' | 'CLOSED'
  timerSeconds: number
  startedAt: string
}

export interface AuctionState {
  sessionId: string
  phase: string
  currentAuction: CurrentAuction | null
  pendingNomination: {
    playerId: string
    player: AuctionPlayer
    nominatorId: string
    nominatorName: string
  } | null
  readyMembers: string[]
  totalMembers: number
  timerRemaining: number
}

export interface UseAuctionOptions {
  onBidPlaced?: (data: BidPlacedData) => void
  onNominationPending?: (data: NominationPendingData) => void
  onNominationConfirmed?: (data: NominationConfirmedData) => void
  onMemberReady?: (data: MemberReadyData) => void
  onAuctionClosed?: (data: AuctionClosedData) => void
  onTimerUpdate?: (data: TimerUpdateData) => void
}

export interface UseAuctionResult {
  // State
  state: AuctionState | null
  isLoading: boolean
  error: string | null
  isConnected: boolean

  // Actions
  placeBid: (amount: number) => Promise<{ success: boolean; message?: string }>
  closeAuction: () => Promise<{ success: boolean; message?: string }>
  nominatePlayer: (playerId: string, basePrice?: number) => Promise<{ success: boolean; message?: string }>
  markReady: () => Promise<{ success: boolean; message?: string }>
  refresh: () => Promise<void>
}

/**
 * Hook for managing auction state with real-time updates
 * @param sessionId - The auction session ID
 * @param options - Event callbacks
 */
export function useAuction(
  sessionId: string | undefined,
  options: UseAuctionOptions = {}
): UseAuctionResult {
  const [state, setState] = useState<AuctionState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Subscribe to Pusher events
  const { isConnected } = usePusherAuction(sessionId, {
    onBidPlaced: (data) => {
      // Update local state with new bid
      setState((prev) =>
        prev && prev.currentAuction
          ? {
              ...prev,
              currentAuction: {
                ...prev.currentAuction,
                currentBid: data.amount,
                currentBidderId: data.memberId,
                currentBidderName: data.memberName,
              },
            }
          : prev
      )
      options.onBidPlaced?.(data)
    },
    onNominationPending: (data) => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              pendingNomination: {
                playerId: data.playerId,
                player: {
                  id: data.playerId,
                  name: data.playerName,
                  team: '',
                  position: data.playerRole,
                  quotation: data.startingPrice,
                },
                nominatorId: data.nominatorId,
                nominatorName: data.nominatorName,
              },
            }
          : prev
      )
      options.onNominationPending?.(data)
    },
    onNominationConfirmed: (data) => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              pendingNomination: null,
              currentAuction: {
                id: data.auctionId,
                playerId: data.playerId,
                player: {
                  id: data.playerId,
                  name: data.playerName,
                  team: '',
                  position: data.playerRole,
                  quotation: data.startingPrice,
                },
                currentBid: data.startingPrice,
                currentBidderId: null,
                currentBidderName: null,
                nominatorId: data.nominatorId,
                nominatorName: data.nominatorName,
                status: 'ACTIVE',
                timerSeconds: data.timerDuration,
                startedAt: data.timestamp,
              },
              timerRemaining: data.timerDuration,
              readyMembers: [],
            }
          : prev
      )
      options.onNominationConfirmed?.(data)
    },
    onMemberReady: (data) => {
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
      options.onMemberReady?.(data)
    },
    onAuctionClosed: (data) => {
      setState((prev) =>
        prev && prev.currentAuction
          ? {
              ...prev,
              currentAuction: {
                ...prev.currentAuction,
                status: 'CLOSED',
              },
            }
          : prev
      )
      options.onAuctionClosed?.(data)
    },
    onTimerUpdate: (data) => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              timerRemaining: data.remainingSeconds,
            }
          : prev
      )
      options.onTimerUpdate?.(data)
    },
  })

  // Fetch current auction state
  const refresh = useCallback(async () => {
    if (!sessionId) {
      setState(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await auctionApi.getCurrentAuction(sessionId)

      if (response.success && response.data) {
        const data = response.data as CurrentAuction | null
        setState({
          sessionId,
          phase: 'AUCTION',
          currentAuction: data,
          pendingNomination: null,
          readyMembers: [],
          totalMembers: 0,
          timerRemaining: data?.timerSeconds || 0,
        })
      }
    } catch (err) {
      setError('Failed to load auction state')
      console.error('useAuction refresh error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  // Actions
  const placeBid = useCallback(
    async (amount: number) => {
      if (!state?.currentAuction) {
        return { success: false, message: 'No active auction' }
      }

      try {
        const response = await auctionApi.placeBid(state.currentAuction.id, amount)
        return { success: response.success, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to place bid' }
      }
    },
    [state?.currentAuction]
  )

  const closeAuction = useCallback(async () => {
    if (!state?.currentAuction) {
      return { success: false, message: 'No active auction' }
    }

    try {
      const response = await auctionApi.closeAuction(state.currentAuction.id)
      return { success: response.success, message: response.message }
    } catch (err) {
      return { success: false, message: 'Failed to close auction' }
    }
  }, [state?.currentAuction])

  const nominatePlayer = useCallback(
    async (playerId: string, basePrice?: number) => {
      if (!sessionId) {
        return { success: false, message: 'No session ID' }
      }

      try {
        const response = await auctionApi.nominatePlayer(sessionId, playerId, basePrice)
        return { success: response.success, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to nominate player' }
      }
    },
    [sessionId]
  )

  const markReady = useCallback(async () => {
    if (!sessionId) {
      return { success: false, message: 'No session ID' }
    }

    try {
      const response = await auctionApi.markReady(sessionId)
      return { success: response.success, message: response.message }
    } catch (err) {
      return { success: false, message: 'Failed to mark ready' }
    }
  }, [sessionId])

  return {
    state,
    isLoading,
    error,
    isConnected,
    placeBid,
    closeAuction,
    nominatePlayer,
    markReady,
    refresh,
  }
}
