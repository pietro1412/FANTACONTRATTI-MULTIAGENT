/**
 * Roster Module - useContracts Hook
 *
 * Custom hook for managing player contracts.
 * Provides contract data, renewal, release, and consolidation functionality.
 */

import { useCallback, useState, useEffect } from 'react'
import { contractApi } from '@/services/api'
import { calculateRescissionClause, calculateReleaseCost } from '../../domain/services/contract-calculator.service'

export interface ContractPlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
}

export interface Contract {
  id: string
  salary: number
  duration: number
  initialSalary: number
  initialDuration: number
  rescissionClause: number
  canRenew: boolean
  canSpalmare: boolean
  // Draft values (staging area)
  draftSalary: number | null
  draftDuration: number | null
  draftReleased: boolean
  roster: {
    id: string
    player: ContractPlayer
    acquisitionPrice: number
    acquisitionType: string
  }
}

export interface PendingContract {
  rosterId: string
  player: ContractPlayer
  acquisitionPrice: number
  acquisitionType: string
  minSalary: number
  // Draft values
  draftSalary: number | null
  draftDuration: number | null
}

export interface UseContractsResult {
  contracts: Contract[]
  pendingContracts: PendingContract[]
  memberBudget: number
  inContrattiPhase: boolean
  isLoading: boolean
  error: string | null
  // Actions
  createContract: (
    rosterId: string,
    salary: number,
    duration: number
  ) => Promise<{ success: boolean; message?: string }>
  renewContract: (
    contractId: string,
    newSalary: number,
    newDuration: number
  ) => Promise<{ success: boolean; message?: string }>
  releasePlayer: (contractId: string) => Promise<{ success: boolean; message?: string }>
  saveDrafts: (
    renewals: { contractId: string; salary: number; duration: number }[],
    newContracts: { rosterId: string; salary: number; duration: number }[],
    releases: string[]
  ) => Promise<{ success: boolean; message?: string }>
  consolidate: (
    renewals: { contractId: string; salary: number; duration: number }[],
    newContracts: { rosterId: string; salary: number; duration: number }[]
  ) => Promise<{ success: boolean; message?: string }>
  refresh: () => Promise<void>
  // Utilities
  calculateRescissionClause: (salary: number, duration: number) => number
  calculateReleaseCost: (salary: number, duration: number) => number
}

/**
 * Hook to manage contracts for the current user
 * @param leagueId - The league ID
 */
export function useContracts(leagueId: string | undefined): UseContractsResult {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [pendingContracts, setPendingContracts] = useState<PendingContract[]>([])
  const [memberBudget, setMemberBudget] = useState(0)
  const [inContrattiPhase, setInContrattiPhase] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setContracts([])
      setPendingContracts([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await contractApi.getAll(leagueId)

      if (response.success && response.data) {
        const data = response.data as {
          contracts: Contract[]
          pendingContracts: PendingContract[]
          memberBudget: number
          inContrattiPhase: boolean
        }
        setContracts(data.contracts || [])
        setPendingContracts(data.pendingContracts || [])
        setMemberBudget(data.memberBudget || 0)
        setInContrattiPhase(data.inContrattiPhase || false)
      } else {
        setError(response.message || 'Failed to load contracts')
      }
    } catch (err) {
      setError('Failed to load contracts')
      console.error('useContracts error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  const createContract = useCallback(
    async (rosterId: string, salary: number, duration: number) => {
      try {
        const response = await contractApi.create(rosterId, salary, duration)

        if (response.success) {
          await refresh()
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to create contract' }
      }
    },
    [refresh]
  )

  const renewContract = useCallback(
    async (contractId: string, newSalary: number, newDuration: number) => {
      try {
        const response = await contractApi.renew(contractId, newSalary, newDuration)

        if (response.success) {
          await refresh()
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to renew contract' }
      }
    },
    [refresh]
  )

  const releasePlayer = useCallback(
    async (contractId: string) => {
      try {
        const response = await contractApi.release(contractId)

        if (response.success) {
          await refresh()
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to release player' }
      }
    },
    [refresh]
  )

  const saveDrafts = useCallback(
    async (
      renewals: { contractId: string; salary: number; duration: number }[],
      newContracts: { rosterId: string; salary: number; duration: number }[],
      releases: string[]
    ) => {
      if (!leagueId) {
        return { success: false, message: 'No league ID' }
      }

      try {
        const response = await contractApi.saveDrafts(leagueId, renewals, newContracts, releases)

        if (response.success) {
          await refresh()
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to save drafts' }
      }
    },
    [leagueId, refresh]
  )

  const consolidate = useCallback(
    async (
      renewals: { contractId: string; salary: number; duration: number }[],
      newContracts: { rosterId: string; salary: number; duration: number }[]
    ) => {
      if (!leagueId) {
        return { success: false, message: 'No league ID' }
      }

      try {
        const response = await contractApi.consolidateAll(leagueId, renewals, newContracts)

        if (response.success) {
          await refresh()
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (err) {
        return { success: false, message: 'Failed to consolidate contracts' }
      }
    },
    [leagueId, refresh]
  )

  return {
    contracts,
    pendingContracts,
    memberBudget,
    inContrattiPhase,
    isLoading,
    error,
    createContract,
    renewContract,
    releasePlayer,
    saveDrafts,
    consolidate,
    refresh,
    calculateRescissionClause,
    calculateReleaseCost,
  }
}

/**
 * Hook to get consolidation status for all managers (admin only)
 * @param leagueId - The league ID
 */
export function useConsolidationStatus(leagueId: string | undefined) {
  const [status, setStatus] = useState<{
    inContrattiPhase: boolean
    managers: Array<{
      memberId: string
      username: string
      playerCount: number
      isConsolidated: boolean
      consolidatedAt: string | null
    }>
    consolidatedCount: number
    totalCount: number
    allConsolidated: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leagueId) {
      setStatus(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await contractApi.getAllConsolidationStatus(leagueId)

      if (response.success && response.data) {
        setStatus(response.data as typeof status)
      } else {
        setError(response.message || 'Failed to load consolidation status')
      }
    } catch (err) {
      setError('Failed to load consolidation status')
      console.error('useConsolidationStatus error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [leagueId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return { status, isLoading, error, refresh }
}
