/**
 * Roster Module - useRoster Hook
 *
 * Custom hook for managing player roster state.
 * Provides roster data and player information.
 */

import { useCallback, useState, useEffect } from 'react'
import { auctionApi } from '@/services/api'

export interface RosterPlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
}

export interface RosterEntry {
  id: string
  playerId: string
  player: RosterPlayer
  acquisitionPrice: number
  acquisitionType: 'FIRST_MARKET' | 'REGULAR_MARKET' | 'TRADE' | 'RUBATA' | 'FREE_AGENT'
  contract: {
    id: string
    salary: number
    duration: number
    rescissionClause: number
    signedAt: string
  } | null
}

export interface UseRosterResult {
  roster: RosterEntry[]
  isLoading: boolean
  error: string | null
  totalPlayers: number
  playersByPosition: {
    goalkeepers: RosterEntry[]
    defenders: RosterEntry[]
    midfielders: RosterEntry[]
    forwards: RosterEntry[]
  }
  budget: number
  refresh: () => Promise<void>
}

/**
 * Hook to fetch and manage roster data for the current user
 * @param leagueId - The league ID
 */
export function useRoster(leagueId: string | undefined): UseRosterResult {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [budget, setBudget] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setRoster([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await auctionApi.getRoster(leagueId)

      if (response.success && response.data) {
        const data = response.data as {
          roster: RosterEntry[]
          currentBudget: number
        }
        setRoster(data.roster || [])
        setBudget(data.currentBudget || 0)
      } else {
        setError(response.message || 'Failed to load roster')
      }
    } catch (err) {
      setError('Failed to load roster')
      console.error('useRoster error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  // Initial fetch
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Derived state - players by position
  const playersByPosition = {
    goalkeepers: roster.filter((r) => r.player.position === 'P'),
    defenders: roster.filter((r) => r.player.position === 'D'),
    midfielders: roster.filter((r) => r.player.position === 'C'),
    forwards: roster.filter((r) => r.player.position === 'A'),
  }

  return {
    roster,
    isLoading,
    error,
    totalPlayers: roster.length,
    playersByPosition,
    budget,
    refresh,
  }
}

/**
 * Hook to fetch roster for a specific member
 * @param leagueId - The league ID
 * @param memberId - The member ID
 */
export function useMemberRoster(
  leagueId: string | undefined,
  memberId: string | undefined
): UseRosterResult {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [budget, setBudget] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId || !memberId) {
      setRoster([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await auctionApi.getMemberRoster(leagueId, memberId)

      if (response.success && response.data) {
        const data = response.data as {
          roster: RosterEntry[]
          currentBudget: number
        }
        setRoster(data.roster || [])
        setBudget(data.currentBudget || 0)
      } else {
        setError(response.message || 'Failed to load roster')
      }
    } catch (err) {
      setError('Failed to load roster')
      console.error('useMemberRoster error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId, memberId])

  // Initial fetch
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Derived state - players by position
  const playersByPosition = {
    goalkeepers: roster.filter((r) => r.player.position === 'P'),
    defenders: roster.filter((r) => r.player.position === 'D'),
    midfielders: roster.filter((r) => r.player.position === 'C'),
    forwards: roster.filter((r) => r.player.position === 'A'),
  }

  return {
    roster,
    isLoading,
    error,
    totalPlayers: roster.length,
    playersByPosition,
    budget,
    refresh,
  }
}

/**
 * Hook to fetch all rosters in a league
 * @param leagueId - The league ID
 */
export function useAllRosters(leagueId: string | undefined) {
  const [rosters, setRosters] = useState<
    Array<{
      memberId: string
      teamName: string
      username: string
      currentBudget: number
      roster: RosterEntry[]
    }>
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setRosters([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await auctionApi.getLeagueRosters(leagueId)

      if (response.success && response.data) {
        setRosters(response.data as typeof rosters)
      } else {
        setError(response.message || 'Failed to load rosters')
      }
    } catch (err) {
      setError('Failed to load rosters')
      console.error('useAllRosters error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  // Initial fetch
  useEffect(() => {
    void refresh()
  }, [refresh])

  return { rosters, isLoading, error, refresh }
}
