/**
 * League Module - useLeague Hook
 *
 * Custom hook for managing league state and operations.
 * Provides access to league data, members, and refresh functionality.
 */

import { useCallback, useState, useEffect } from 'react'
import { leagueApi } from '@/services/api'

export interface LeagueMember {
  id: string
  userId: string
  role: 'ADMIN' | 'MANAGER'
  status: 'ACTIVE' | 'PENDING' | 'LEFT'
  teamName: string
  currentBudget: number
  user: {
    id: string
    username: string
    email: string
    profilePhoto?: string | null
  }
}

export interface League {
  id: string
  name: string
  description?: string | null
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED'
  inviteCode: string
  minParticipants: number
  maxParticipants: number
  initialBudget: number
  goalkeeperSlots: number
  defenderSlots: number
  midfielderSlots: number
  forwardSlots: number
  createdAt: string
}

export interface UseLeagueResult {
  league: League | null
  members: LeagueMember[]
  isLoading: boolean
  error: string | null
  isAdmin: boolean
  userMembership: LeagueMember | null
  refresh: () => Promise<void>
}

/**
 * Hook to fetch and manage league data
 * @param leagueId - The ID of the league to fetch
 */
export function useLeague(leagueId: string | undefined): UseLeagueResult {
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userMembership, setUserMembership] = useState<LeagueMember | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setLeague(null)
      setMembers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await leagueApi.getById(leagueId)

      if (response.success && response.data) {
        const data = response.data as {
          league: League & { members: LeagueMember[] }
          userMembership: LeagueMember | null
          isAdmin: boolean
        }

        setLeague(data.league)
        setMembers(data.league.members || [])
        setIsAdmin(data.isAdmin)
        setUserMembership(data.userMembership)
      } else {
        setError(response.message || 'Failed to load league')
      }
    } catch (err) {
      setError('Failed to load league data')
      console.error('useLeague error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    league,
    members,
    isLoading,
    error,
    isAdmin,
    userMembership,
    refresh,
  }
}

/**
 * Hook to fetch all leagues for the current user
 */
export function useUserLeagues() {
  const [leagues, setLeagues] = useState<Array<{
    membership: { id: string; role: string; status: string; currentBudget: number }
    league: League
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await leagueApi.getAll()

      if (response.success && response.data) {
        setLeagues(response.data as typeof leagues)
      } else {
        setError(response.message || 'Failed to load leagues')
      }
    } catch (err) {
      setError('Failed to load leagues')
      console.error('useUserLeagues error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { leagues, isLoading, error, refresh }
}
