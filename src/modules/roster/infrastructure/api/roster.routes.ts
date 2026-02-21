/**
 * Roster Module API Routes
 *
 * Provides endpoints for roster operations including:
 * - Getting user's roster
 * - Getting all rosters in a league
 * - Contract renewal
 * - Calculating rescission cost
 * - Contract consolidation
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '@/api/middleware/auth'
import { asyncHandler } from '@/shared/infrastructure/http'

// Import existing service functions
import {
  getContracts,
  renewContract,
  calculateRescissionClause,
  consolidateContracts,
  getContractById,
} from '@/services/contract.service'
import { getAllRosters } from '@/services/league.service'

const router = Router()

// ==================== TYPES ====================

interface RenewContractBody {
  newSalary: number
  newDuration: number
}

interface ConsolidateContractsBody {
  renewals?: { contractId: string; salary: number; duration: number }[]
  newContracts?: { rosterId: string; salary: number; duration: number }[]
}

// ==================== ROSTER ENDPOINTS ====================

/**
 * GET /api/leagues/:leagueId/roster
 * Get user's roster for a league
 *
 * Response: { success: boolean, data?: { contracts, pendingContracts }, error?: string }
 */
router.get(
  '/leagues/:leagueId/roster',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const userId = req.user!.userId

    const result = await getContracts(leagueId as string, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * GET /api/leagues/:leagueId/rosters
 * Get all rosters in a league
 *
 * Response: { success: boolean, data?: { rosters }, error?: string }
 */
router.get(
  '/leagues/:leagueId/rosters',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const userId = req.user!.userId

    const result = await getAllRosters(leagueId as string, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== CONTRACT ENDPOINTS ====================

/**
 * POST /api/contracts/:contractId/renew
 * Renew a contract
 *
 * Body: { newSalary: number, newDuration: number }
 * Response: { success: boolean, data?: { contract }, error?: string }
 */
router.post(
  '/contracts/:contractId/renew',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { contractId } = req.params
    const { newSalary, newDuration } = req.body as RenewContractBody
    const userId = req.user!.userId

    if (!newSalary || !newDuration) {
      res.status(400).json({
        success: false,
        error: 'newSalary e newDuration sono obbligatori',
      })
      return
    }

    if (typeof newSalary !== 'number' || typeof newDuration !== 'number') {
      res.status(400).json({
        success: false,
        error: 'newSalary e newDuration devono essere numeri',
      })
      return
    }

    const result = await renewContract(contractId as string, userId, newSalary, newDuration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * GET /api/contracts/:contractId/rescission
 * Calculate rescission cost for a contract
 *
 * Response: { success: boolean, data?: { rescissionCost, contract }, error?: string }
 */
router.get(
  '/contracts/:contractId/rescission',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { contractId } = req.params
    const userId = req.user!.userId

    // First get the contract to calculate rescission
    const contractResult = await getContractById(contractId as string, userId)

    if (!contractResult.success) {
      const status = contractResult.message === 'Non sei il proprietario di questo contratto' ? 403 : 404
      res.status(status).json(contractResult)
      return
    }

    const contract = contractResult.data as Record<string, unknown>
    const rescissionCost = calculateRescissionClause(contract.salary as number, contract.duration as number)
    const roster = contract.roster as Record<string, unknown> | undefined
    const player = roster?.player as Record<string, unknown> | undefined

    res.json({
      success: true,
      data: {
        rescissionCost,
        contract: {
          id: contract.id,
          salary: contract.salary,
          duration: contract.duration,
          playerName: player?.name,
        },
      },
    })
  })
)

/**
 * POST /api/contracts/consolidate
 * Consolidate year 4+ contracts with optional renewals and new contracts
 *
 * Body: { renewals?: [...], newContracts?: [...] }
 * Response: { success: boolean, data?: { consolidated, released, renewed }, error?: string }
 */
router.post(
  '/contracts/consolidate',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { renewals, newContracts } = req.body as ConsolidateContractsBody
    const userId = req.user!.userId

    // Get leagueId from query parameter
    const leagueId = req.query.leagueId as string
    if (!leagueId) {
      res.status(400).json({
        success: false,
        error: 'leagueId richiesto come query parameter',
      })
      return
    }

    const result = await consolidateContracts(leagueId, userId, renewals, newContracts)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

export default router
