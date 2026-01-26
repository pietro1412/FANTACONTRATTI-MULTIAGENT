/**
 * useAuctionObjectives Hook
 *
 * Custom hook for managing pre-auction objectives.
 * Allows managers to save target players with priority and max price.
 *
 * Creato il: 25/01/2026
 */

import { useCallback, useState, useEffect } from 'react'

// API URL from environment
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3003')

export interface ObjectivePlayer {
  id: string
  name: string
  team: string
  position: string
  quotation: number
}

export interface AuctionObjective {
  id: string
  sessionId: string
  memberId: string
  playerId: string
  player: ObjectivePlayer
  priority: 1 | 2 | 3
  notes: string | null
  maxPrice: number | null
  status: 'ACTIVE' | 'ACQUIRED' | 'MISSED' | 'REMOVED'
  createdAt: string
  updatedAt: string
}

export interface ObjectivesSummary {
  active: number
  acquired: number
  missed: number
  removed: number
  total: number
}

export interface CreateObjectiveInput {
  playerId: string
  priority?: number
  notes?: string
  maxPrice?: number
}

export interface UpdateObjectiveInput {
  priority?: number
  notes?: string
  maxPrice?: number
  status?: 'ACTIVE' | 'ACQUIRED' | 'MISSED' | 'REMOVED'
}

export interface UseAuctionObjectivesResult {
  // State
  objectives: AuctionObjective[]
  summary: ObjectivesSummary | null
  isLoading: boolean
  error: string | null

  // Actions
  createObjective: (input: CreateObjectiveInput) => Promise<{ success: boolean; message?: string }>
  updateObjective: (objectiveId: string, input: UpdateObjectiveInput) => Promise<{ success: boolean; message?: string }>
  deleteObjective: (objectiveId: string) => Promise<{ success: boolean; message?: string }>
  refresh: () => Promise<void>

  // Helpers
  isPlayerObjective: (playerId: string) => boolean
  getPlayerObjective: (playerId: string) => AuctionObjective | undefined
}

// Helper to get auth token
function getAuthToken(): string | null {
  // Try to get from localStorage first (set by auth context)
  return localStorage.getItem('accessToken')
}

/**
 * Hook for managing pre-auction objectives
 * @param sessionId - The auction session ID
 */
export function useAuctionObjectives(
  sessionId: string | undefined
): UseAuctionObjectivesResult {
  const [objectives, setObjectives] = useState<AuctionObjective[]>([])
  const [summary, setSummary] = useState<ObjectivesSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch objectives
  const fetchObjectives = useCallback(async () => {
    if (!sessionId) {
      setObjectives([])
      setSummary(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = getAuthToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Fetch objectives and summary in parallel
      const [objectivesRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/auctions/sessions/${sessionId}/objectives`, {
          headers,
          credentials: 'include'
        }),
        fetch(`${API_URL}/api/auctions/sessions/${sessionId}/objectives/summary`, {
          headers,
          credentials: 'include'
        })
      ])

      const objectivesData = await objectivesRes.json()
      const summaryData = await summaryRes.json()

      if (objectivesData.success) {
        setObjectives(objectivesData.data || [])
      } else {
        setError(objectivesData.message || 'Errore nel caricamento obiettivi')
      }

      if (summaryData.success) {
        setSummary(summaryData.data || null)
      }
    } catch (err) {
      console.error('Error fetching objectives:', err)
      setError('Errore di connessione')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  // Initial fetch
  useEffect(() => {
    fetchObjectives()
  }, [fetchObjectives])

  // Create objective
  const createObjective = useCallback(async (input: CreateObjectiveInput) => {
    if (!sessionId) {
      return { success: false, message: 'Sessione non valida' }
    }

    try {
      const token = getAuthToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${API_URL}/api/objectives`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          ...input
        })
      })

      const data = await response.json()

      if (data.success) {
        // Refresh to get updated list
        await fetchObjectives()
        return { success: true }
      } else {
        return { success: false, message: data.message }
      }
    } catch (err) {
      console.error('Error creating objective:', err)
      return { success: false, message: 'Errore di connessione' }
    }
  }, [sessionId, fetchObjectives])

  // Update objective
  const updateObjective = useCallback(async (
    objectiveId: string,
    input: UpdateObjectiveInput
  ) => {
    try {
      const token = getAuthToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${API_URL}/api/objectives/${objectiveId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(input)
      })

      const data = await response.json()

      if (data.success) {
        // Refresh to get updated list
        await fetchObjectives()
        return { success: true }
      } else {
        return { success: false, message: data.message }
      }
    } catch (err) {
      console.error('Error updating objective:', err)
      return { success: false, message: 'Errore di connessione' }
    }
  }, [fetchObjectives])

  // Delete objective
  const deleteObjective = useCallback(async (objectiveId: string) => {
    try {
      const token = getAuthToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${API_URL}/api/objectives/${objectiveId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        // Refresh to get updated list
        await fetchObjectives()
        return { success: true }
      } else {
        return { success: false, message: data.message }
      }
    } catch (err) {
      console.error('Error deleting objective:', err)
      return { success: false, message: 'Errore di connessione' }
    }
  }, [fetchObjectives])

  // Helper: check if player is in objectives
  const isPlayerObjective = useCallback((playerId: string): boolean => {
    return objectives.some(obj => obj.playerId === playerId && obj.status === 'ACTIVE')
  }, [objectives])

  // Helper: get objective for a player
  const getPlayerObjective = useCallback((playerId: string): AuctionObjective | undefined => {
    return objectives.find(obj => obj.playerId === playerId)
  }, [objectives])

  return {
    objectives,
    summary,
    isLoading,
    error,
    createObjective,
    updateObjective,
    deleteObjective,
    refresh: fetchObjectives,
    isPlayerObjective,
    getPlayerObjective
  }
}

export default useAuctionObjectives
