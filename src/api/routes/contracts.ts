import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getContracts,
  getContractById,
  createContract,
  renewContract,
  releasePlayer,
  previewRenewal,
  previewContract,
  getConsolidationStatus,
  consolidateContracts,
  getAllConsolidationStatus,
  saveDrafts,
  simulateAllConsolidation,
} from '../../services/contract.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// GET /api/leagues/:leagueId/contracts - Get all contracts and pending contracts
router.get('/leagues/:leagueId/contracts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getContracts(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get contracts error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/contracts/:contractId - Get contract detail
router.get('/contracts/:contractId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId as string
    const result = await getContractById(contractId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei il proprietario di questo contratto' ? 403 : 404).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get contract error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/create - Create initial contract for a player
router.post('/contracts/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { rosterId, salary, duration } = req.body as { rosterId?: string; salary?: number; duration?: number }

    if (!rosterId || salary === undefined || duration === undefined) {
      res.status(400).json({ success: false, message: 'rosterId, salary e duration richiesti' })
      return
    }

    if (typeof salary !== 'number' || typeof duration !== 'number') {
      res.status(400).json({ success: false, message: 'salary e duration devono essere numeri' })
      return
    }

    const result = await createContract(rosterId, req.user!.userId, salary, duration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Create contract error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/preview-create - Preview contract creation
router.post('/contracts/preview-create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { rosterId, salary, duration } = req.body as { rosterId?: string; salary?: number; duration?: number }

    if (!rosterId || salary === undefined || duration === undefined) {
      res.status(400).json({ success: false, message: 'rosterId, salary e duration richiesti' })
      return
    }

    const result = await previewContract(rosterId, req.user!.userId, salary, duration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Preview contract error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/:contractId/preview - Preview renewal cost
router.post('/contracts/:contractId/preview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId as string
    const { newSalary, newDuration } = req.body as { newSalary?: number; newDuration?: number }

    if (!newSalary || !newDuration) {
      res.status(400).json({ success: false, message: 'newSalary e newDuration richiesti' })
      return
    }

    const result = await previewRenewal(contractId, req.user!.userId, newSalary, newDuration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Preview renewal error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/:contractId/renew - Renew contract
router.post('/contracts/:contractId/renew', authMiddleware, async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId as string
    const { newSalary, newDuration } = req.body as { newSalary?: number; newDuration?: number }

    if (!newSalary || !newDuration) {
      res.status(400).json({ success: false, message: 'newSalary e newDuration richiesti' })
      return
    }

    if (typeof newSalary !== 'number' || typeof newDuration !== 'number') {
      res.status(400).json({ success: false, message: 'newSalary e newDuration devono essere numeri' })
      return
    }

    const result = await renewContract(contractId, req.user!.userId, newSalary, newDuration)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Renew contract error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/contracts/:contractId/release - Release player (svincola)
router.post('/contracts/:contractId/release', authMiddleware, async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId as string
    const result = await releasePlayer(contractId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Release player error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== CONTRACT CONSOLIDATION ====================

// GET /api/leagues/:leagueId/contracts/consolidation - Get consolidation status for current manager
router.get('/leagues/:leagueId/contracts/consolidation', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getConsolidationStatus(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get consolidation status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/contracts/save-drafts - Save draft renewals, new contracts, and releases
router.post('/leagues/:leagueId/contracts/save-drafts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { renewals, newContracts, releases } = req.body as {
      renewals?: { contractId: string; salary: number; duration: number }[]
      newContracts?: { rosterId: string; salary: number; duration: number }[]
      releases?: string[]  // Contract IDs to mark for release
    }

    const result = await saveDrafts(
      leagueId,
      req.user!.userId,
      renewals || [],
      newContracts || [],
      releases || []
    )

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Save drafts error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/contracts/consolidate - Consolidate contracts with optional renewals/new contracts
router.post('/leagues/:leagueId/contracts/consolidate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { renewals, newContracts } = req.body as {
      renewals?: { contractId: string; salary: number; duration: number }[]
      newContracts?: { rosterId: string; salary: number; duration: number }[]
    }

    const result = await consolidateContracts(leagueId, req.user!.userId, renewals, newContracts)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Consolidate contracts error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/contracts/consolidation-all - Get all managers' consolidation status (admin only)
router.get('/leagues/:leagueId/contracts/consolidation-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getAllConsolidationStatus(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Solo gli admin possono vedere lo stato di consolidamento' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get all consolidation status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/contracts/simulate-consolidation - Simulate all managers consolidated (admin test only)
router.post('/leagues/:leagueId/contracts/simulate-consolidation', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await simulateAllConsolidation(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Solo gli admin possono simulare il consolidamento' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Simulate consolidation error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
