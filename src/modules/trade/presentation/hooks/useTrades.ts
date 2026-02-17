/**
 * Trade Module - useTrades Hook
 *
 * Custom hook for managing trade offers.
 * Handles creating, accepting, rejecting, and counter-offering trades.
 */

import { useCallback, useState, useEffect } from 'react'
import { tradeApi } from '@/services/api'

export interface TradePlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
}

export interface TradeMember {
  id: string
  username: string
  teamName: string
}

export interface TradeOffer {
  id: string
  fromMember: TradeMember
  toMember: TradeMember
  offeredPlayers: TradePlayer[]
  requestedPlayers: TradePlayer[]
  offeredBudget: number
  requestedBudget: number
  message: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COUNTER'
  expiresAt: string
  createdAt: string
  counterOfferId: string | null
}

export interface UseTradesResult {
  receivedOffers: TradeOffer[]
  sentOffers: TradeOffer[]
  history: TradeOffer[]
  isLoading: boolean
  error: string | null
  // Actions
  createOffer: (data: {
    toMemberId: string
    offeredPlayerIds: string[]
    requestedPlayerIds: string[]
    offeredBudget?: number
    requestedBudget?: number
    message?: string
    durationHours?: number
  }) => Promise<{ success: boolean; message?: string }>
  acceptOffer: (tradeId: string) => Promise<{ success: boolean; message?: string }>
  rejectOffer: (tradeId: string) => Promise<{ success: boolean; message?: string }>
  cancelOffer: (tradeId: string) => Promise<{ success: boolean; message?: string }>
  counterOffer: (
    tradeId: string,
    data: {
      offeredPlayerIds: string[]
      requestedPlayerIds: string[]
      offeredBudget?: number
      requestedBudget?: number
      message?: string
    }
  ) => Promise<{ success: boolean; message?: string }>
  refresh: () => Promise<void>
}

/**
 * Hook for managing trade offers
 * @param leagueId - The league ID
 */
export function useTrades(leagueId: string | undefined): UseTradesResult {
  const [receivedOffers, setReceivedOffers] = useState<TradeOffer[]>([])
  const [sentOffers, setSentOffers] = useState<TradeOffer[]>([])
  const [history, setHistory] = useState<TradeOffer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setReceivedOffers([])
      setSentOffers([])
      setHistory([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [receivedRes, sentRes, historyRes] = await Promise.all([
        tradeApi.getReceived(leagueId),
        tradeApi.getSent(leagueId),
        tradeApi.getHistory(leagueId),
      ])

      if (receivedRes.success && receivedRes.data) {
        setReceivedOffers((receivedRes.data as { offers: TradeOffer[] }).offers || [])
      }

      if (sentRes.success && sentRes.data) {
        setSentOffers((sentRes.data as { offers: TradeOffer[] }).offers || [])
      }

      if (historyRes.success && historyRes.data) {
        setHistory((historyRes.data as { offers: TradeOffer[] }).offers || [])
      }
    } catch (_err) {
      setError('Failed to load trades')
      console.error('useTrades error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  // Initial fetch
  useEffect(() => {
    void refresh()
  }, [refresh])

  const createOffer = useCallback(
    async (data: {
      toMemberId: string
      offeredPlayerIds: string[]
      requestedPlayerIds: string[]
      offeredBudget?: number
      requestedBudget?: number
      message?: string
      durationHours?: number
    }) => {
      if (!leagueId) return { success: false, message: 'No league ID' }

      try {
        const response = await tradeApi.create(leagueId, data)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to create trade offer' }
      }
    },
    [leagueId, refresh]
  )

  const acceptOffer = useCallback(
    async (tradeId: string) => {
      try {
        const response = await tradeApi.accept(tradeId)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to accept trade' }
      }
    },
    [refresh]
  )

  const rejectOffer = useCallback(
    async (tradeId: string) => {
      try {
        const response = await tradeApi.reject(tradeId)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to reject trade' }
      }
    },
    [refresh]
  )

  const cancelOffer = useCallback(
    async (tradeId: string) => {
      try {
        const response = await tradeApi.cancel(tradeId)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to cancel trade' }
      }
    },
    [refresh]
  )

  const counterOffer = useCallback(
    async (
      tradeId: string,
      data: {
        offeredPlayerIds: string[]
        requestedPlayerIds: string[]
        offeredBudget?: number
        requestedBudget?: number
        message?: string
      }
    ) => {
      try {
        const response = await tradeApi.counter(tradeId, data)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to counter trade' }
      }
    },
    [refresh]
  )

  return {
    receivedOffers,
    sentOffers,
    history,
    isLoading,
    error,
    createOffer,
    acceptOffer,
    rejectOffer,
    cancelOffer,
    counterOffer,
    refresh,
  }
}
