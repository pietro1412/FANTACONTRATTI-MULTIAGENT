/**
 * Watchlist Plans API Routes
 * Endpoints for managing multiple strategy plans (Plan A/B)
 */

import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

/**
 * GET /api/leagues/:leagueId/plans
 * List all plans for the authenticated member in a league
 */
router.get('/leagues/:leagueId/plans', authMiddleware, async (req, res) => {
  try {
    const leagueId = req.params.leagueId
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non autenticato' })
    }

    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId, status: 'ACTIVE' },
    })

    if (!member) {
      return res.status(403).json({ success: false, message: 'Non autorizzato' })
    }

    const plans = await prisma.watchlistPlan.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: plans })
  } catch (error) {
    console.error('Error fetching plans:', error)
    res.status(500).json({ success: false, message: 'Errore nel recupero dei piani' })
  }
})

/**
 * GET /api/leagues/:leagueId/plans/:planId
 * Get a specific plan by ID
 */
router.get('/leagues/:leagueId/plans/:planId', authMiddleware, async (req, res) => {
  try {
    const { leagueId, planId } = req.params
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non autenticato' })
    }

    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId, status: 'ACTIVE' },
    })

    if (!member) {
      return res.status(403).json({ success: false, message: 'Non autorizzato' })
    }

    const plan = await prisma.watchlistPlan.findFirst({
      where: { id: planId, memberId: member.id },
    })

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Piano non trovato' })
    }

    res.json({ success: true, data: plan })
  } catch (error) {
    console.error('Error fetching plan:', error)
    res.status(500).json({ success: false, message: 'Errore nel recupero del piano' })
  }
})

/**
 * POST /api/leagues/:leagueId/plans
 * Create a new plan
 */
router.post('/leagues/:leagueId/plans', authMiddleware, async (req, res) => {
  try {
    const leagueId = req.params.leagueId
    const { name, description, playerIds } = req.body
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non autenticato' })
    }

    if (!name || !playerIds || !Array.isArray(playerIds)) {
      return res.status(400).json({
        success: false,
        message: 'Nome e lista giocatori sono obbligatori',
      })
    }

    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId, status: 'ACTIVE' },
    })

    if (!member) {
      return res.status(403).json({ success: false, message: 'Non autorizzato' })
    }

    // Check if plan name already exists
    const existingPlan = await prisma.watchlistPlan.findFirst({
      where: { memberId: member.id, name },
    })

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: 'Esiste già un piano con questo nome',
      })
    }

    // Calculate total budget from player clauses
    const players = await prisma.serieAPlayer.findMany({
      where: { id: { in: playerIds } },
      include: {
        rosters: {
          where: { status: 'ACTIVE' },
          include: { contract: true },
        },
      },
    })

    const totalBudget = players.reduce((sum, p) => {
      const clause = p.rosters[0]?.contract?.clause || p.quotation
      return sum + clause
    }, 0)

    const plan = await prisma.watchlistPlan.create({
      data: {
        memberId: member.id,
        name,
        description,
        playerIds,
        totalBudget,
      },
    })

    res.status(201).json({ success: true, data: plan })
  } catch (error) {
    console.error('Error creating plan:', error)
    res.status(500).json({ success: false, message: 'Errore nella creazione del piano' })
  }
})

/**
 * PUT /api/leagues/:leagueId/plans/:planId
 * Update an existing plan
 */
router.put('/leagues/:leagueId/plans/:planId', authMiddleware, async (req, res) => {
  try {
    const { leagueId, planId } = req.params
    const { name, description, playerIds } = req.body
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non autenticato' })
    }

    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId, status: 'ACTIVE' },
    })

    if (!member) {
      return res.status(403).json({ success: false, message: 'Non autorizzato' })
    }

    const existingPlan = await prisma.watchlistPlan.findFirst({
      where: { id: planId, memberId: member.id },
    })

    if (!existingPlan) {
      return res.status(404).json({ success: false, message: 'Piano non trovato' })
    }

    // If name is changing, check for duplicates
    if (name && name !== existingPlan.name) {
      const duplicatePlan = await prisma.watchlistPlan.findFirst({
        where: { memberId: member.id, name, id: { not: planId } },
      })

      if (duplicatePlan) {
        return res.status(400).json({
          success: false,
          message: 'Esiste già un piano con questo nome',
        })
      }
    }

    // Recalculate total budget if playerIds changed
    let totalBudget = existingPlan.totalBudget
    if (playerIds && Array.isArray(playerIds)) {
      const players = await prisma.serieAPlayer.findMany({
        where: { id: { in: playerIds } },
        include: {
          rosters: {
            where: { status: 'ACTIVE' },
            include: { contract: true },
          },
        },
      })

      totalBudget = players.reduce((sum, p) => {
        const clause = p.rosters[0]?.contract?.clause || p.quotation
        return sum + clause
      }, 0)
    }

    const plan = await prisma.watchlistPlan.update({
      where: { id: planId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(playerIds && { playerIds, totalBudget }),
      },
    })

    res.json({ success: true, data: plan })
  } catch (error) {
    console.error('Error updating plan:', error)
    res.status(500).json({ success: false, message: 'Errore nell\'aggiornamento del piano' })
  }
})

/**
 * DELETE /api/leagues/:leagueId/plans/:planId
 * Delete a plan
 */
router.delete('/leagues/:leagueId/plans/:planId', authMiddleware, async (req, res) => {
  try {
    const { leagueId, planId } = req.params
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non autenticato' })
    }

    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId, status: 'ACTIVE' },
    })

    if (!member) {
      return res.status(403).json({ success: false, message: 'Non autorizzato' })
    }

    const existingPlan = await prisma.watchlistPlan.findFirst({
      where: { id: planId, memberId: member.id },
    })

    if (!existingPlan) {
      return res.status(404).json({ success: false, message: 'Piano non trovato' })
    }

    await prisma.watchlistPlan.delete({
      where: { id: planId },
    })

    res.json({ success: true, message: 'Piano eliminato' })
  } catch (error) {
    console.error('Error deleting plan:', error)
    res.status(500).json({ success: false, message: 'Errore nell\'eliminazione del piano' })
  }
})

/**
 * POST /api/leagues/:leagueId/plans/:planId/activate
 * Set a plan as active (deactivates all others)
 */
router.post('/leagues/:leagueId/plans/:planId/activate', authMiddleware, async (req, res) => {
  try {
    const { leagueId, planId } = req.params
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non autenticato' })
    }

    const member = await prisma.leagueMember.findFirst({
      where: { leagueId, userId, status: 'ACTIVE' },
    })

    if (!member) {
      return res.status(403).json({ success: false, message: 'Non autorizzato' })
    }

    const existingPlan = await prisma.watchlistPlan.findFirst({
      where: { id: planId, memberId: member.id },
    })

    if (!existingPlan) {
      return res.status(404).json({ success: false, message: 'Piano non trovato' })
    }

    // Deactivate all other plans
    await prisma.watchlistPlan.updateMany({
      where: { memberId: member.id },
      data: { isActive: false },
    })

    // Activate this plan
    const plan = await prisma.watchlistPlan.update({
      where: { id: planId },
      data: { isActive: true },
    })

    res.json({ success: true, data: plan })
  } catch (error) {
    console.error('Error activating plan:', error)
    res.status(500).json({ success: false, message: 'Errore nell\'attivazione del piano' })
  }
})

export default router
