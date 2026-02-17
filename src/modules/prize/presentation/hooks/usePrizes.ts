/**
 * Prize Module - usePrizes Hook
 *
 * Custom hook for managing prize phase state.
 * Handles prize categories, assignments, and finalization.
 */

import { useCallback, useState, useEffect } from 'react'
import { prizePhaseApi } from '@/services/api'

export interface PrizeMember {
  id: string
  username: string
  teamName: string
  currentBudget: number
  totalPrize: number
}

export interface PrizeCategory {
  id: string
  name: string
  members: Array<{
    memberId: string
    username: string
    teamName: string
    amount: number
  }>
}

export interface PrizePhaseState {
  sessionId: string
  status: 'ACTIVE' | 'FINALIZED'
  baseReincrement: number
  categories: PrizeCategory[]
  members: PrizeMember[]
  totalDistributed: number
}

export interface UsePrizesResult {
  state: PrizePhaseState | null
  isLoading: boolean
  error: string | null
  // Actions
  updateBaseReincrement: (amount: number) => Promise<{ success: boolean; message?: string }>
  createCategory: (name: string) => Promise<{ success: boolean; message?: string }>
  deleteCategory: (categoryId: string) => Promise<{ success: boolean; message?: string }>
  setMemberPrize: (
    categoryId: string,
    memberId: string,
    amount: number
  ) => Promise<{ success: boolean; message?: string }>
  finalize: () => Promise<{ success: boolean; message?: string }>
  refresh: () => Promise<void>
}

/**
 * Hook for managing prize phase state
 * @param sessionId - The market session ID
 */
export function usePrizes(sessionId: string | undefined): UsePrizesResult {
  const [state, setState] = useState<PrizePhaseState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setState(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await prizePhaseApi.getData(sessionId)

      if (response.success && response.data) {
        setState(response.data as PrizePhaseState)
      } else {
        setError(response.message || 'Failed to load prize data')
      }
    } catch (_err) {
      setError('Failed to load prize data')
      console.error('usePrizes error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  // Initial fetch
  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateBaseReincrement = useCallback(
    async (amount: number) => {
      if (!sessionId) return { success: false, message: 'No session ID' }

      try {
        const response = await prizePhaseApi.updateBaseReincrement(sessionId, amount)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to update base reincrement' }
      }
    },
    [sessionId, refresh]
  )

  const createCategory = useCallback(
    async (name: string) => {
      if (!sessionId) return { success: false, message: 'No session ID' }

      try {
        const response = await prizePhaseApi.createCategory(sessionId, name)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to create category' }
      }
    },
    [sessionId, refresh]
  )

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      try {
        const response = await prizePhaseApi.deleteCategory(categoryId)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to delete category' }
      }
    },
    [refresh]
  )

  const setMemberPrize = useCallback(
    async (categoryId: string, memberId: string, amount: number) => {
      try {
        const response = await prizePhaseApi.setMemberPrize(categoryId, memberId, amount)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (_err) {
        return { success: false, message: 'Failed to set member prize' }
      }
    },
    [refresh]
  )

  const finalize = useCallback(async () => {
    if (!sessionId) return { success: false, message: 'No session ID' }

    try {
      const response = await prizePhaseApi.finalize(sessionId)
      if (response.success) await refresh()
      return { success: response.success, message: response.message }
    } catch (_err) {
      return { success: false, message: 'Failed to finalize prize phase' }
    }
  }, [sessionId, refresh])

  return {
    state,
    isLoading,
    error,
    updateBaseReincrement,
    createCategory,
    deleteCategory,
    setMemberPrize,
    finalize,
    refresh,
  }
}
