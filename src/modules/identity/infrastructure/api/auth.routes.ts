/**
 * Authentication Routes - Identity Module
 *
 * Express router for authentication endpoints using modular use cases.
 * Handles login, register, token refresh, logout, and current user retrieval.
 */

import { Router } from 'express'
import { LoginUseCase } from '../../application/use-cases/login.use-case'
import { RegisterUseCase } from '../../application/use-cases/register.use-case'
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case'
import { UserPrismaRepository } from '../repositories/user.prisma-repository'
import { BcryptPasswordService } from '../services/bcrypt-password.service'
import { JwtTokenService } from '../services/jwt-token.service'
import { asyncHandler } from '@/shared/infrastructure/http/error-handler'
import { authMiddleware } from '@/api/middleware/auth'

const router = Router()

// Initialize dependencies
const userRepository = new UserPrismaRepository()
const passwordService = new BcryptPasswordService()
const tokenService = new JwtTokenService()

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
router.post('/login', asyncHandler(async (req, res) => {
  const loginUseCase = new LoginUseCase(userRepository, passwordService, tokenService)
  const result = await loginUseCase.execute(req.body)

  if (result.isFailure) {
    return res.status(result.error.statusCode).json({
      success: false,
      error: result.error.message
    })
  }

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.value.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  })

  res.json({
    success: true,
    data: {
      user: result.value.user,
      accessToken: result.value.accessToken,
    }
  })
}))

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', asyncHandler(async (req, res) => {
  const registerUseCase = new RegisterUseCase(userRepository, passwordService, tokenService)
  const result = await registerUseCase.execute(req.body)

  if (result.isFailure) {
    return res.status(result.error.statusCode).json({
      success: false,
      error: result.error.message
    })
  }

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.value.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  })

  res.status(201).json({
    success: true,
    data: {
      user: result.value.user,
      accessToken: result.value.accessToken,
    }
  })
}))

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const refreshUseCase = new RefreshTokenUseCase(userRepository, tokenService)
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token non fornito'
    })
  }

  const result = await refreshUseCase.execute({ refreshToken })

  if (result.isFailure) {
    res.clearCookie('refreshToken')
    return res.status(result.error.statusCode).json({
      success: false,
      error: result.error.message
    })
  }

  // Update refresh token cookie
  res.cookie('refreshToken', result.value.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  })

  res.json({
    success: true,
    accessToken: result.value.accessToken,
  })
}))

/**
 * POST /api/auth/logout
 * Clear authentication cookies
 */
router.post('/logout', (_req, res) => {
  res.clearCookie('refreshToken')
  res.json({ success: true, message: 'Logout effettuato' })
})

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user?.userId

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Non autenticato'
    })
  }

  const user = await userRepository.findById(userId)

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'Utente non trovato'
    })
  }

  res.json({ success: true, data: user })
}))

export default router
