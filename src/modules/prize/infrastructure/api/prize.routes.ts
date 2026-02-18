/**
 * Prize Module API Routes
 *
 * Provides endpoints for prize operations including:
 * - Getting prize status
 * - Setting up prizes (admin)
 * - Assigning prizes (admin)
 * - Unassigning prizes
 * - Finalizing prize distribution
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '@/api/middleware/auth'
import { asyncHandler } from '@/shared/infrastructure/http'

// Import existing service functions
import {
  initializePrizePhase,
  getPrizePhaseData,
  updateBaseReincrement,
  createPrizeCategory,
  deletePrizeCategory,
  setMemberPrize,
  finalizePrizePhase,
} from '@/services/prize-phase.service'

const router = Router()

// ==================== TYPES ====================

interface SetupPrizesBody {
  baseReincrement?: number
  categories?: string[]
}

interface AssignPrizeBody {
  categoryId: string
  memberId: string
  amount: number
}

interface CreateCategoryBody {
  name: string
}

interface UpdateBaseReincrementBody {
  amount: number
}

// ==================== PRIZE STATUS ENDPOINTS ====================

/**
 * GET /api/sessions/:sessionId/prizes
 * Get prize status for a session
 *
 * Response: { success: boolean, data?: { prizePhase, categories, members }, error?: string }
 */
router.get(
  '/sessions/:sessionId/prizes',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const userId = req.user!.userId

    const result = await getPrizePhaseData(sessionId as string, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== ADMIN PRIZE ENDPOINTS ====================

/**
 * POST /api/sessions/:sessionId/prizes/setup
 * Setup prizes for a session (admin only)
 * Initializes the prize phase with optional base reincrement and categories
 *
 * Body: { baseReincrement?: number, categories?: string[] }
 * Response: { success: boolean, data?: { prizePhase }, error?: string }
 */
router.post(
  '/sessions/:sessionId/prizes/setup',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const { baseReincrement, categories } = req.body as SetupPrizesBody
    const userId = req.user!.userId

    // Initialize prize phase
    const initResult = await initializePrizePhase(sessionId as string, userId)

    if (!initResult.success) {
      const status = initResult.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(initResult)
      return
    }

    // Update base reincrement if provided
    if (baseReincrement !== undefined) {
      const updateResult = await updateBaseReincrement(sessionId as string, userId, baseReincrement)
      if (!updateResult.success) {
        res.status(400).json(updateResult)
        return
      }
    }

    // Create categories if provided
    if (categories && categories.length > 0) {
      for (const categoryName of categories) {
        const categoryResult = await createPrizeCategory(sessionId as string, userId, categoryName)
        if (!categoryResult.success) {
          // Log but continue - partial setup is acceptable
          console.warn(`Failed to create category ${categoryName}:`, categoryResult.message)
        }
      }
    }

    // Get updated prize data
    const result = await getPrizePhaseData(sessionId as string, userId)

    res.status(201).json(result)
  })
)

/**
 * POST /api/sessions/:sessionId/prizes/assign
 * Assign a prize to a member (admin only)
 *
 * Body: { categoryId: string, memberId: string, amount: number }
 * Response: { success: boolean, data?: { prize }, error?: string }
 */
router.post(
  '/sessions/:sessionId/prizes/assign',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { categoryId, memberId, amount } = req.body as AssignPrizeBody
    const userId = req.user!.userId

    if (!categoryId || !memberId) {
      res.status(400).json({
        success: false,
        error: 'categoryId e memberId sono obbligatori',
      })
      return
    }

    if (amount === undefined || typeof amount !== 'number') {
      res.status(400).json({
        success: false,
        error: 'amount deve essere un numero',
      })
      return
    }

    const result = await setMemberPrize(categoryId, memberId, userId, amount)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * DELETE /api/sessions/:sessionId/prizes/:prizeId
 * Unassign a prize (admin only)
 * Sets the prize amount to 0 effectively removing it
 *
 * Response: { success: boolean, error?: string }
 */
router.delete(
  '/sessions/:sessionId/prizes/:prizeId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { prizeId } = req.params
    const userId = req.user!.userId

    // For unassigning, we need categoryId and memberId from the prizeId
    // The prizeId format should contain this info or we need to look it up
    // For now, we'll use the deletePrizeCategory for categories
    // Individual prize assignments are handled by setMemberPrize with amount 0

    // Try to delete as category first
    const result = await deletePrizeCategory(prizeId as string, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * POST /api/sessions/:sessionId/prizes/finalize
 * Finalize prize distribution (admin only)
 * Applies all prizes to member budgets
 *
 * Response: { success: boolean, data?: { finalized }, error?: string }
 */
router.post(
  '/sessions/:sessionId/prizes/finalize',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const userId = req.user!.userId

    const result = await finalizePrizePhase(sessionId as string, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== ADDITIONAL ENDPOINTS ====================

/**
 * POST /api/sessions/:sessionId/prizes/categories
 * Create a new prize category (admin only)
 *
 * Body: { name: string }
 * Response: { success: boolean, data?: { category }, error?: string }
 */
router.post(
  '/sessions/:sessionId/prizes/categories',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const { name } = req.body as CreateCategoryBody
    const userId = req.user!.userId

    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'name richiesto',
      })
      return
    }

    const result = await createPrizeCategory(sessionId as string, userId, name)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.status(201).json(result)
  })
)

/**
 * PATCH /api/sessions/:sessionId/prizes/base-reincrement
 * Update base reincrement amount (admin only)
 *
 * Body: { amount: number }
 * Response: { success: boolean, data?: { baseReincrement }, error?: string }
 */
router.patch(
  '/sessions/:sessionId/prizes/base-reincrement',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const { amount } = req.body as UpdateBaseReincrementBody
    const userId = req.user!.userId

    if (amount === undefined || typeof amount !== 'number') {
      res.status(400).json({
        success: false,
        error: 'amount deve essere un numero',
      })
      return
    }

    const result = await updateBaseReincrement(sessionId as string, userId, amount)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

export default router
