/**
 * League Module - useLeagueMembers Hook
 *
 * Custom hook for managing league members.
 * Provides member list and admin actions (accept, reject, kick).
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
  joinType: 'CREATOR' | 'INVITE' | 'REQUEST'
  joinedAt: string
  user: {
    id: string
    username: string
    email: string
    profilePhoto?: string | null
  }
}

export interface UseLeagueMembersResult {
  members: LeagueMember[]
  pendingMembers: LeagueMember[]
  activeMembers: LeagueMember[]
  isLoading: boolean
  error: string | null
  isAdmin: boolean
  refresh: () => Promise<void>
  acceptMember: (memberId: string) => Promise<boolean>
  rejectMember: (memberId: string) => Promise<boolean>
  kickMember: (memberId: string) => Promise<boolean>
}

/**
 * Hook to manage league members
 * @param leagueId - The ID of the league
 */
export function useLeagueMembers(leagueId: string | undefined): UseLeagueMembersResult {
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setMembers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await leagueApi.getMembers(leagueId)

      if (response.success && response.data) {
        const data = response.data as { members: LeagueMember[]; isAdmin: boolean }
        setMembers(data.members || [])
        setIsAdmin(data.isAdmin)
      } else {
        setError(response.message || 'Failed to load members')
      }
    } catch (err) {
      setError('Failed to load members')
      console.error('useLeagueMembers error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  const updateMemberStatus = useCallback(
    async (memberId: string, action: 'accept' | 'reject' | 'kick'): Promise<boolean> => {
      if (!leagueId) return false

      try {
        const response = await leagueApi.updateMember(leagueId, memberId, action)

        if (response.success) {
          await refresh()
          return true
        } else {
          setError(response.message || `Failed to ${action} member`)
          return false
        }
      } catch (err) {
        setError(`Failed to ${action} member`)
        console.error(`useLeagueMembers ${action} error:`, err)
        return false
      }
    },
    [leagueId, refresh]
  )

  const acceptMember = useCallback(
    (memberId: string) => updateMemberStatus(memberId, 'accept'),
    [updateMemberStatus]
  )

  const rejectMember = useCallback(
    (memberId: string) => updateMemberStatus(memberId, 'reject'),
    [updateMemberStatus]
  )

  const kickMember = useCallback(
    (memberId: string) => updateMemberStatus(memberId, 'kick'),
    [updateMemberStatus]
  )

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  // Derived state
  const pendingMembers = members.filter((m) => m.status === 'PENDING')
  const activeMembers = members.filter((m) => m.status === 'ACTIVE')

  return {
    members,
    pendingMembers,
    activeMembers,
    isLoading,
    error,
    isAdmin,
    refresh,
    acceptMember,
    rejectMember,
    kickMember,
  }
}
