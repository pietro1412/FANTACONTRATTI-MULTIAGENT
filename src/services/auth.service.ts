import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '../utils/password'
import { generateTokens, type TokenPayload } from '../utils/jwt'
import type { RegisterInput, LoginInput } from '../utils/validation'

export interface AuthResult {
  success: boolean
  message?: string
  user?: {
    id: string
    email: string
    username: string
  }
  tokens?: {
    accessToken: string
    refreshToken: string
  }
}

export async function registerUser(input: Omit<RegisterInput, 'confirmPassword'>): Promise<AuthResult> {
  const { email, username, password } = input

  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({ where: { email } })
  if (existingEmail) {
    return { success: false, message: 'Email già registrata' }
  }

  // Check if username already exists
  const existingUsername = await prisma.user.findUnique({ where: { username } })
  if (existingUsername) {
    return { success: false, message: 'Username già in uso' }
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      username: true,
    },
  })

  return {
    success: true,
    message: 'Registrazione completata',
    user,
  }
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const { emailOrUsername, password } = input

  // Find user by email or username
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrUsername },
        { username: emailOrUsername },
      ],
    },
  })

  if (!user) {
    return { success: false, message: 'Credenziali non valide' }
  }

  // Check account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return { success: false, message: `Account bloccato. Riprova tra ${minutesLeft} minuti.` }
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash)
  if (!isValidPassword) {
    // Increment failed attempts
    const attempts = (user.failedLoginAttempts || 0) + 1
    let lockedUntil: Date | null = null

    if (attempts >= 20) {
      lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 ore
    } else if (attempts >= 10) {
      lockedUntil = new Date(Date.now() + 60 * 60 * 1000) // 1 ora
    } else if (attempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000) // 15 minuti
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lastFailedLogin: new Date(),
        lockedUntil,
      },
    })

    if (lockedUntil) {
      const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
      return { success: false, message: `Troppi tentativi falliti. Account bloccato per ${mins} minuti.` }
    }
    return { success: false, message: 'Credenziali non valide' }
  }

  // Reset failed attempts on successful login
  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastFailedLogin: null },
    })
  }

  // Generate tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
  }
  const tokens = generateTokens(tokenPayload)

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    tokens,
  }
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      emailVerified: true,
      createdAt: true,
    },
  })
}
