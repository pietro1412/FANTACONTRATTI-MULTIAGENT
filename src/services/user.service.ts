import { PrismaClient } from '@prisma/client'
import { hashPassword, verifyPassword } from '../utils/password'
import type { UpdateProfileInput, ChangePasswordInput } from '../utils/validation'
import type { ServiceResult } from '@/shared/types/service-result'

const prisma = new PrismaClient()

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      emailVerified: true,
      profilePhoto: true,
      createdAt: true,
      leagueMemberships: {
        select: {
          id: true,
          role: true,
          teamName: true,
          status: true,
          currentBudget: true,
          league: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        where: {
          status: 'ACTIVE',
        },
      },
    },
  })

  if (!user) {
    return { success: false, message: 'Utente non trovato' }
  }

  return { success: true, data: user }
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<ServiceResult> {
  const { email, username } = input

  // Check if email is being updated and already exists
  if (email) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: userId },
      },
    })
    if (existingEmail) {
      return { success: false, message: 'Email già in uso' }
    }
  }

  // Check if username is being updated and already exists
  if (username) {
    const existingUsername = await prisma.user.findFirst({
      where: {
        username,
        NOT: { id: userId },
      },
    })
    if (existingUsername) {
      return { success: false, message: 'Username già in uso' }
    }
  }

  const updateData: { email?: string; username?: string } = {}
  if (email) updateData.email = email
  if (username) updateData.username = username

  if (Object.keys(updateData).length === 0) {
    return { success: false, message: 'Nessun dato da aggiornare' }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
    },
  })

  return { success: true, message: 'Profilo aggiornato', data: user }
}

export async function updateProfilePhoto(userId: string, photoData: string): Promise<ServiceResult> {
  // photoData is a base64 encoded image string
  if (!photoData) {
    return { success: false, message: 'Nessuna foto fornita' }
  }

  // Validate it's a valid base64 image (basic check)
  if (!photoData.startsWith('data:image/')) {
    return { success: false, message: 'Formato immagine non valido' }
  }

  // Check size (max 500KB base64)
  if (photoData.length > 700000) {
    return { success: false, message: 'Immagine troppo grande (max 500KB)' }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { profilePhoto: photoData },
    select: {
      id: true,
      email: true,
      username: true,
      profilePhoto: true,
    },
  })

  return { success: true, message: 'Foto profilo aggiornata', data: user }
}

export async function removeProfilePhoto(userId: string): Promise<ServiceResult> {
  await prisma.user.update({
    where: { id: userId },
    data: { profilePhoto: null },
  })

  return { success: true, message: 'Foto profilo rimossa' }
}

export async function changePassword(
  userId: string,
  input: Omit<ChangePasswordInput, 'confirmNewPassword'>
): Promise<ServiceResult> {
  const { currentPassword, newPassword } = input

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { success: false, message: 'Utente non trovato' }
  }

  // Verify current password
  const isValidPassword = await verifyPassword(currentPassword, user.passwordHash)
  if (!isValidPassword) {
    return { success: false, message: 'Password attuale non corretta' }
  }

  // Hash new password and update
  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })

  return { success: true, message: 'Password aggiornata' }
}
