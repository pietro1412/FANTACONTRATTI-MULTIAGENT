/**
 * League Routes - League Module
 *
 * Express router for league-related endpoints using modular use cases.
 * Handles league creation, joining, and details retrieval.
 */

import { Router } from 'express'
import { CreateLeagueUseCase } from '../../application/use-cases/create-league.use-case'
import { JoinLeagueUseCase } from '../../application/use-cases/join-league.use-case'
import { GetLeagueDetailsUseCase } from '../../application/use-cases/get-league-details.use-case'
import { LeaguePrismaRepository } from '../repositories/league.prisma-repository'
import { asyncHandler } from '@/shared/infrastructure/http/error-handler'
import { authMiddleware } from '@/api/middleware/auth'
import { eventBus } from '@/shared/infrastructure/events'

const router = Router()

// Initialize dependencies
const leagueRepository = new LeaguePrismaRepository()

/**
 * GET /api/leagues
 * List all leagues for the authenticated user
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const leagues = await leagueRepository.findByUserId(req.user!.userId)
  res.json({ success: true, data: leagues })
}))

/**
 * POST /api/leagues
 * Create a new league
 */
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const createUseCase = new CreateLeagueUseCase(leagueRepository, eventBus)
  const result = await createUseCase.execute({
    userId: req.user!.userId,
    data: req.body
  })

  if (result.isFailure) {
    return res.status(result.error.statusCode).json({
      success: false,
      error: result.error.message
    })
  }

  res.status(201).json({ success: true, data: result.value })
}))

/**
 * GET /api/leagues/:leagueId
 * Get league details with members
 */
router.get('/:leagueId', authMiddleware, asyncHandler(async (req, res) => {
  const { leagueId } = req.params
  if (!leagueId) {
    return res.status(400).json({
      success: false,
      error: 'ID lega non fornito'
    })
  }

  const getDetailsUseCase = new GetLeagueDetailsUseCase(leagueRepository)
  const result = await getDetailsUseCase.execute({
    leagueId,
    userId: req.user!.userId
  })

  if (result.isFailure) {
    return res.status(result.error.statusCode).json({
      success: false,
      error: result.error.message
    })
  }

  res.json({ success: true, data: result.value })
}))

/**
 * POST /api/leagues/join
 * Request to join a league by invite code
 */
router.post('/join', authMiddleware, asyncHandler(async (req, res) => {
  const { inviteCode, teamName } = req.body

  if (!inviteCode) {
    return res.status(400).json({
      success: false,
      error: 'Codice invito non fornito'
    })
  }

  // First, find the league by invite code
  const league = await leagueRepository.findByInviteCode(inviteCode)
  if (!league) {
    return res.status(404).json({
      success: false,
      error: 'Lega non trovata con questo codice invito'
    })
  }

  const joinUseCase = new JoinLeagueUseCase(leagueRepository, eventBus)
  const result = await joinUseCase.execute({
    leagueId: league.id,
    userId: req.user!.userId,
    teamName: teamName || req.user!.username
  })

  if (result.isFailure) {
    return res.status(result.error.statusCode).json({
      success: false,
      error: result.error.message
    })
  }

  res.json({ success: true, data: result.value })
}))

/**
 * POST /api/leagues/:leagueId/join
 * Request to join a specific league by ID
 */
router.post('/:leagueId/join', authMiddleware, asyncHandler(async (req, res) => {
  const { leagueId } = req.params
  if (!leagueId) {
    return res.status(400).json({
      success: false,
      error: 'ID lega non fornito'
    })
  }

  const { teamName } = req.body

  const joinUseCase = new JoinLeagueUseCase(leagueRepository, eventBus)
  const result = await joinUseCase.execute({
    leagueId,
    userId: req.user!.userId,
    teamName: teamName || req.user!.username
  })

  if (result.isFailure) {
    return res.status(result.error.statusCode).json({
      success: false,
      error: result.error.message
    })
  }

  res.json({ success: true, data: result.value })
}))

export default router
