import { PrismaClient } from '@prisma/client'
import { hashPassword, verifyPassword } from '../utils/password'
import { generateTokens, type TokenPayload } from '../utils/jwt'
import type { RegisterInput, LoginInput } from '../utils/validation'

const prisma = new PrismaClient()

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

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash)
  if (!isValidPassword) {
    return { success: false, message: 'Credenziali non valide' }
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
