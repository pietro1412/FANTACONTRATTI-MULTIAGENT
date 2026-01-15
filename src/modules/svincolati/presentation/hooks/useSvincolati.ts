/**
 * Svincolati Module - useSvincolati Hook
 *
 * Custom hook for managing free agent (svincolati) auction state.
 * Handles turn-based nominations and bidding.
 */

import { useCallback, useState, useEffect } from 'react'
import { svincolatiApi } from '@/services/api'

export interface SvincolatiPlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
}

export interface TurnOrderMember {
  memberId: string
  username: string
  teamName: string
  currentBudget: number
  hasPassed: boolean
  hasFinished: boolean
  isCurrentTurn: boolean
}

export interface SvincolatiBoardState {
  sessionId: string
  status: 'ACTIVE' | 'CLOSED'
  currentPhase: 'WAITING' | 'NOMINATING' | 'AUCTION' | 'ACKNOWLEDGMENT'
  turnOrder: TurnOrderMember[]
  currentTurnMemberId: string | null
  currentRound: number
  maxRounds: number
  timerSeconds: number
  pendingNomination: {
    playerId: string
    player: SvincolatiPlayer
    nominatorId: string
    nominatorName: string
  } | null
  activeAuction: {
    id: string
    playerId: string
    player: SvincolatiPlayer
    currentBid: number
    currentBidderId: string | null
    currentBidderName: string | null
    timerRemaining: number
  } | null
  readyMembers: string[]
}

export interface UseSvincolatiResult {
  state: SvincolatiBoardState | null
  freeAgents: SvincolatiPlayer[]
  isLoading: boolean
  error: string | null
  // Actions
  nominate: (playerId: string) => Promise<{ success: boolean; message?: string }>
  confirmNomination: () => Promise<{ success: boolean; message?: string }>
  cancelNomination: () => Promise<{ success: boolean; message?: string }>
  bid: (auctionId: string, amount: number) => Promise<{ success: boolean; message?: string }>
  markReady: () => Promise<{ success: boolean; message?: string }>
  passTurn: () => Promise<{ success: boolean; message?: string }>
  declareFinished: () => Promise<{ success: boolean; message?: string }>
  undoFinished: () => Promise<{ success: boolean; message?: string }>
  refresh: () => Promise<void>
}

/**
 * Hook for managing svincolati (free agent) auction state
 * @param leagueId - The league ID
 */
export function useSvincolati(leagueId: string | undefined): UseSvincolatiResult {
  const [state, setState] = useState<SvincolatiBoardState | null>(null)
  const [freeAgents, setFreeAgents] = useState<SvincolatiPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setState(null)
      setFreeAgents([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [boardRes, playersRes] = await Promise.all([
        svincolatiApi.getBoard(leagueId),
        svincolatiApi.getAll(leagueId),
      ])

      if (boardRes.success && boardRes.data) {
        setState(boardRes.data as SvincolatiBoardState)
      }

      if (playersRes.success && playersRes.data) {
        setFreeAgents((playersRes.data as { players: SvincolatiPlayer[] }).players || [])
      }
    } catch (err) {
      setError('Failed to load svincolati state')
      console.error('useSvincolati error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  const nominate = useCallback(
    async (playerId: string) => {
      if (!leagueId) return { success: false, message: 'No league ID' }

      try {
        const response = await svincolatiApi.nominate(leagueId, playerId)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to nominate player' }
      }
    },
    [leagueId, refresh]
  )

  const confirmNomination = useCallback(async () => {
    if (!leagueId) return { success: false, message: 'No league ID' }

    try {
      const response = await svincolatiApi.confirmNomination(leagueId)
      if (response.success) await refresh()
      return { success: response.success, message: response.message }
    } catch (err) {
      return { success: false, message: 'Failed to confirm nomination' }
    }
  }, [leagueId, refresh])

  const cancelNomination = useCallback(async () => {
    if (!leagueId) return { success: false, message: 'No league ID' }

    try {
      const response = await svincolatiApi.cancelNomination(leagueId)
      if (response.success) await refresh()
      return { success: response.success, message: response.message }
    } catch (err) {
      return { success: false, message: 'Failed to cancel nomination' }
    }
  }, [leagueId, refresh])

  const bid = useCallback(
    async (auctionId: string, amount: number) => {
      try {
        const response = await svincolatiApi.bid(auctionId, amount)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to place bid' }
      }
    },
    [refresh]
  )

  const markReady = useCallback(async () => {
    if (!leagueId) return { success: false, message: 'No league ID' }

    try {
      const response = await svincolatiApi.markReady(leagueId)
      if (response.success) await refresh()
      return { success: response.success, message: response.message }
    } catch (err) {
      return { success: false, message: 'Failed to mark ready' }
    }
  }, [leagueId, refresh])

  const passTurn = useCallback(async () => {
    if (!leagueId) return { success: false, message: 'No league ID' }

    try {
      const response = await svincolatiApi.passTurn(leagueId)
      if (response.success) await refresh()
      return { success: response.success, message: response.message }
    } catch (err) {
      return { success: false, message: 'Failed to pass turn' }
    }
  }, [leagueId, refresh])

  const declareFinished = useCallback(async () => {
    if (!leagueId) return { success: false, message: 'No league ID' }

    try {
      const response = await svincolatiApi.declareFinished(leagueId)
      if (response.success) await refresh()
      return { success: response.success, message: response.message }
    } catch (err) {
      return { success: false, message: 'Failed to declare finished' }
    }
  }, [leagueId, refresh])

  const undoFinished = useCallback(async () => {
    if (!leagueId) return { success: false, message: 'No league ID' }

    try {
      const response = await svincolatiApi.undoFinished(leagueId)
      if (response.success) await refresh()
      return { success: response.success, message: response.message }
    } catch (err) {
      return { success: false, message: 'Failed to undo finished' }
    }
  }, [leagueId, refresh])

  return {
    state,
    freeAgents,
    isLoading,
    error,
    nominate,
    confirmNomination,
    cancelNomination,
    bid,
    markReady,
    passTurn,
    declareFinished,
    undoFinished,
    refresh,
  }
}
