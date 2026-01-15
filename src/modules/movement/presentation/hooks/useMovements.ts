/**
 * Movement Module - useMovements Hook
 *
 * Custom hook for fetching and managing movement history.
 * Movements track all player transactions (purchases, trades, releases, etc.)
 */

import { useCallback, useState, useEffect } from 'react'
import { movementApi } from '@/services/api'

export interface MovementPlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
}

export interface MovementMember {
  id: string
  username: string
  teamName: string
}

export interface Movement {
  id: string
  player: MovementPlayer
  movementType:
    | 'FIRST_MARKET'
    | 'REGULAR_MARKET'
    | 'FREE_AGENT'
    | 'TRADE'
    | 'RUBATA'
    | 'RELEASE'
    | 'CONTRACT_RENEW'
  fromMember: MovementMember | null
  toMember: MovementMember | null
  price: number | null
  semester: number
  prophecy: string | null
  prophecyAuthor: MovementMember | null
  oldSalary: number | null
  oldDuration: number | null
  oldClause: number | null
  newSalary: number | null
  newDuration: number | null
  newClause: number | null
  createdAt: string
}

export interface UseMovementsOptions {
  limit?: number
  offset?: number
  movementType?: string
  playerId?: string
  semester?: number
}

export interface UseMovementsResult {
  movements: Movement[]
  totalCount: number
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  addProphecy: (movementId: string, content: string) => Promise<{ success: boolean; message?: string }>
}

/**
 * Hook for fetching movement history
 * @param leagueId - The league ID
 * @param options - Filter options
 */
export function useMovements(
  leagueId: string | undefined,
  options: UseMovementsOptions = {}
): UseMovementsResult {
  const [movements, setMovements] = useState<Movement[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentOffset, setCurrentOffset] = useState(0)

  const limit = options.limit || 20

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setMovements([])
      setTotalCount(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    setCurrentOffset(0)

    try {
      const response = await movementApi.getLeagueMovements(leagueId, {
        limit,
        offset: 0,
        movementType: options.movementType,
        playerId: options.playerId,
        semester: options.semester,
      })

      if (response.success && response.data) {
        const data = response.data as {
          movements: Movement[]
          total: number
        }
        setMovements(data.movements || [])
        setTotalCount(data.total || 0)
      } else {
        setError(response.message || 'Failed to load movements')
      }
    } catch (err) {
      setError('Failed to load movements')
      console.error('useMovements error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId, limit, options.movementType, options.playerId, options.semester])

  const loadMore = useCallback(async () => {
    if (!leagueId || isLoading) return

    const newOffset = currentOffset + limit

    try {
      const response = await movementApi.getLeagueMovements(leagueId, {
        limit,
        offset: newOffset,
        movementType: options.movementType,
        playerId: options.playerId,
        semester: options.semester,
      })

      if (response.success && response.data) {
        const data = response.data as {
          movements: Movement[]
          total: number
        }
        setMovements((prev) => [...prev, ...(data.movements || [])])
        setCurrentOffset(newOffset)
      }
    } catch (err) {
      console.error('useMovements loadMore error:', err)
    }
  }, [leagueId, isLoading, currentOffset, limit, options.movementType, options.playerId, options.semester])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  const hasMore = movements.length < totalCount

  const addProphecy = useCallback(
    async (movementId: string, content: string) => {
      try {
        const response = await movementApi.addProphecy(movementId, content)
        if (response.success) await refresh()
        return { success: response.success, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to add prophecy' }
      }
    },
    [refresh]
  )

  return {
    movements,
    totalCount,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    addProphecy,
  }
}

/**
 * Hook for fetching player history in a league
 * @param leagueId - The league ID
 * @param playerId - The player ID
 */
export function usePlayerHistory(leagueId: string | undefined, playerId: string | undefined) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [prophecies, setProphecies] = useState<
    Array<{
      id: string
      content: string
      author: MovementMember
      createdAt: string
    }>
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId || !playerId) {
      setMovements([])
      setProphecies([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [historyRes, propheciesRes] = await Promise.all([
        movementApi.getPlayerHistory(leagueId, playerId),
        movementApi.getPlayerProphecies(leagueId, playerId),
      ])

      if (historyRes.success && historyRes.data) {
        setMovements((historyRes.data as { movements: Movement[] }).movements || [])
      }

      if (propheciesRes.success && propheciesRes.data) {
        setProphecies((propheciesRes.data as { prophecies: typeof prophecies }).prophecies || [])
      }
    } catch (err) {
      setError('Failed to load player history')
      console.error('usePlayerHistory error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId, playerId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return { movements, prophecies, isLoading, error, refresh }
}
