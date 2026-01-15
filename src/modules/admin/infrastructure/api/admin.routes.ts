/**
 * Admin Module API Routes
 *
 * Provides endpoints for admin operations including:
 * - Getting league statistics
 * - Changing market phase
 * - Importing players
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import multer from 'multer'
import { authMiddleware } from '@/api/middleware/auth'
import { asyncHandler } from '@/shared/infrastructure/http'

// Import existing service functions
import {
  getLeagueStatistics,
  exportAllRosters,
  getAuditLog,
  assignPrize,
  getPrizeHistory,
  getMembersForPrizes,
  resetFirstMarket,
  migrateProphecies,
} from '@/services/admin.service'
import { setMarketPhase } from '@/services/auction.service'
import { importQuotazioni } from '@/services/superadmin.service'

const router = Router()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept only xlsx files
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true)
    } else {
      cb(new Error('Solo file .xlsx sono accettati'))
    }
  },
})

// ==================== TYPES ====================

interface ChangePhaseBody {
  phase: string
}

interface GetAuditQuery {
  limit?: string
  offset?: string
  action?: string
}

interface AssignPrizeBody {
  memberId: string
  amount: number
  reason?: string
}

// ==================== STATISTICS ENDPOINTS ====================

/**
 * GET /api/leagues/:leagueId/admin/stats
 * Get league statistics (admin or member)
 *
 * Response: { success: boolean, data?: { stats }, error?: string }
 */
router.get(
  '/leagues/:leagueId/admin/stats',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const userId = req.user!.userId

    const result = await getLeagueStatistics(leagueId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * GET /api/leagues/:leagueId/admin/export/rosters
 * Export all rosters for a league (admin only)
 *
 * Response: { success: boolean, data?: { rosters }, error?: string }
 */
router.get(
  '/leagues/:leagueId/admin/export/rosters',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const userId = req.user!.userId

    const result = await exportAllRosters(leagueId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * GET /api/leagues/:leagueId/admin/audit
 * Get audit log for a league (admin only)
 *
 * Query: { limit?, offset?, action? }
 * Response: { success: boolean, data?: { logs, total }, error?: string }
 */
router.get(
  '/leagues/:leagueId/admin/audit',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const { limit, offset, action } = req.query as GetAuditQuery
    const userId = req.user!.userId

    const result = await getAuditLog(leagueId, userId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      action,
    })

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== PHASE MANAGEMENT ====================

/**
 * POST /api/sessions/:sessionId/phase
 * Change market phase (admin only)
 *
 * Body: { phase: string }
 * Response: { success: boolean, data?: { session }, error?: string }
 */
router.post(
  '/sessions/:sessionId/phase',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const { phase } = req.body as ChangePhaseBody
    const userId = req.user!.userId

    if (!phase) {
      res.status(400).json({
        success: false,
        error: 'phase richiesto',
      })
      return
    }

    // Valid phases based on MarketPhase enum
    const validPhases = [
      'PREMI',
      'OFFERTE_PRE_RINNOVO',
      'CONTRATTI',
      'RUBATA',
      'ASTA_SVINCOLATI',
      'OFFERTE_POST_ASTA_SVINCOLATI',
      'ASTA_LIBERA',
    ]

    if (!validPhases.includes(phase)) {
      res.status(400).json({
        success: false,
        error: `Fase non valida. Fasi valide: ${validPhases.join(', ')}`,
      })
      return
    }

    const result = await setMarketPhase(sessionId, userId, phase)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== PLAYER IMPORT ====================

/**
 * POST /api/admin/players/import
 * Import players from xlsx file (superadmin only)
 *
 * Body: FormData with 'file' (xlsx) and optional 'sheetName'
 * Response: { success: boolean, data?: { imported, updated, errors }, error?: string }
 */
router.post(
  '/admin/players/import',
  authMiddleware,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Nessun file caricato',
      })
      return
    }

    const sheetName = (req.body.sheetName as string) || 'Tutti'
    const fileName = req.file.originalname || 'players.xlsx'

    const result = await importQuotazioni(userId, req.file.buffer, sheetName, fileName)

    if (!result.success) {
      const status = result.message?.includes('Non autorizzato') ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== PRIZE MANAGEMENT (Legacy) ====================

/**
 * GET /api/leagues/:leagueId/admin/prizes
 * Get prize history for a league (admin only)
 *
 * Response: { success: boolean, data?: { prizes }, error?: string }
 */
router.get(
  '/leagues/:leagueId/admin/prizes',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const userId = req.user!.userId

    const result = await getPrizeHistory(leagueId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * GET /api/leagues/:leagueId/admin/prizes/members
 * Get all members for prize assignment (admin only)
 *
 * Response: { success: boolean, data?: { members }, error?: string }
 */
router.get(
  '/leagues/:leagueId/admin/prizes/members',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const userId = req.user!.userId

    const result = await getMembersForPrizes(leagueId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * POST /api/leagues/:leagueId/admin/prizes
 * Assign a prize to a member (admin only)
 *
 * Body: { memberId: string, amount: number, reason?: string }
 * Response: { success: boolean, data?: { prize }, error?: string }
 */
router.post(
  '/leagues/:leagueId/admin/prizes',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const { memberId, amount, reason } = req.body as AssignPrizeBody
    const userId = req.user!.userId

    if (!memberId || amount === undefined) {
      res.status(400).json({
        success: false,
        error: 'memberId e amount sono obbligatori',
      })
      return
    }

    const result = await assignPrize(leagueId, userId, memberId, amount, reason)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== MAINTENANCE ENDPOINTS ====================

/**
 * POST /api/leagues/:leagueId/admin/reset-first-market
 * Reset first market to initial state (admin only)
 *
 * Response: { success: boolean, error?: string }
 */
router.post(
  '/leagues/:leagueId/admin/reset-first-market',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const userId = req.user!.userId

    const result = await resetFirstMarket(leagueId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * POST /api/leagues/:leagueId/admin/migrate-prophecies
 * Migrate prophecies from old format (admin only)
 *
 * Response: { success: boolean, data?: { migrated }, error?: string }
 */
router.post(
  '/leagues/:leagueId/admin/migrate-prophecies',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const userId = req.user!.userId

    const result = await migrateProphecies(leagueId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

export default router
