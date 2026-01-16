import { Router } from 'express'
import type { Request, Response } from 'express'
import { registerSchema, loginSchema } from '../../utils/validation'
import { registerUser, loginUser, getUserById } from '../../services/auth.service'
import { generateTokens, verifyRefreshToken } from '../../utils/jwt'
import { authMiddleware } from '../middleware/auth'
import { ForgotPasswordUseCase } from '../../modules/identity/application/use-cases/forgot-password.use-case'
import { ResetPasswordUseCase } from '../../modules/identity/application/use-cases/reset-password.use-case'
import { UserPrismaRepository } from '../../modules/identity/infrastructure/repositories/user.prisma-repository'
import { BcryptPasswordService } from '../../modules/identity/infrastructure/services/bcrypt-password.service'
import { createEmailService } from '../../modules/identity/infrastructure/services/email.factory'

const router = Router()

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body)

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Dati non validi',
        errors: validation.error.issues,
      })
      return
    }

    const { confirmPassword: _, ...input } = validation.data
    const result = await registerUser(input)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body)

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Dati non validi',
        errors: validation.error.issues,
      })
      return
    }

    const result = await loginUser(validation.data)

    if (!result.success || !result.tokens) {
      res.status(401).json({ success: false, message: result.message || 'Credenziali non valide' })
      return
    }

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('refreshToken')
  res.json({ success: true, message: 'Logout effettuato' })
})

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined

    if (!refreshToken) {
      res.status(401).json({ success: false, message: 'Refresh token non trovato' })
      return
    }

    const payload = verifyRefreshToken(refreshToken)

    if (!payload) {
      res.clearCookie('refreshToken')
      res.status(401).json({ success: false, message: 'Refresh token non valido o scaduto' })
      return
    }

    // Generate new tokens
    const tokens = generateTokens({
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
    })

    // Update refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.json({
      success: true,
      accessToken: tokens.accessToken,
    })
  } catch (error) {
    console.error('Refresh error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.userId)

    if (!user) {
      res.status(404).json({ success: false, message: 'Utente non trovato' })
      return
    }

    res.json({ success: true, data: user })
  } catch (error) {
    console.error('Get me error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const userRepository = new UserPrismaRepository()
    const emailService = createEmailService()
    const forgotPasswordUseCase = new ForgotPasswordUseCase(userRepository, emailService)

    const result = await forgotPasswordUseCase.execute(req.body)

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: result.value?.message || 'Se l\'email esiste, riceverai un link per reimpostare la password'
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    // Still return success to prevent enumeration
    res.json({
      success: true,
      message: 'Se l\'email esiste, riceverai un link per reimpostare la password'
    })
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const userRepository = new UserPrismaRepository()
    const passwordService = new BcryptPasswordService()
    const resetPasswordUseCase = new ResetPasswordUseCase(userRepository, passwordService)

    const result = await resetPasswordUseCase.execute(req.body)

    if (result.isFailure) {
      res.status(result.error.statusCode).json({
        success: false,
        error: result.error.message
      })
      return
    }

    res.json({
      success: true,
      message: result.value.message
    })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ success: false, error: 'Errore durante il reset della password' })
  }
})

export default router
