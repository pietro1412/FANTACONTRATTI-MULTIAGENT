/**
 * User Prisma Repository - Infrastructure Layer
 *
 * Implements IUserRepository interface using Prisma ORM.
 * Maps between Prisma database models and domain entities.
 */

import { prisma } from '@/lib/prisma'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import type { User, UserWithCredentials, CreateUserData } from '../../domain/entities/user.entity'

export class UserPrismaRepository implements IUserRepository {
  /**
   * Find a user by their unique ID
   */
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id } })
    return user ? this.mapToUser(user) : null
  }

  /**
   * Find a user by their email address
   * Includes password hash for authentication purposes
   */
  async findByEmail(email: string): Promise<UserWithCredentials | null> {
    const user = await prisma.user.findUnique({ where: { email } })
    return user ? this.mapToUserWithCredentials(user) : null
  }

  /**
   * Create a new user in the system
   */
  async create(data: CreateUserData): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.email, // Use email as username for now
        passwordHash: data.passwordHash,
        // Note: teamName is stored in LeagueMember, not User model
        // We track it in domain entity but don't persist at User level
      }
    })
    return this.mapToUser(user, data.teamName)
  }

  /**
   * Update the last login timestamp for a user
   */
  async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { updatedAt: new Date() }
    })
  }

  /**
   * Set password reset token for a user
   */
  async setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt
      }
    })
  }

  /**
   * Find a user by their password reset token
   */
  async findByPasswordResetToken(token: string): Promise<(UserWithCredentials & { passwordResetExpires: Date | null }) | null> {
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token }
    })
    if (!user) return null
    return {
      ...this.mapToUserWithCredentials(user),
      passwordResetExpires: user.passwordResetExpires
    }
  }

  /**
   * Clear password reset token for a user
   */
  async clearPasswordResetToken(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: null,
        passwordResetExpires: null
      }
    })
  }

  /**
   * Update user's password
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    })
  }

  /**
   * Map Prisma User model to domain User entity
   */
  private mapToUser(prismaUser: {
    id: string
    email: string
    username: string
    createdAt: Date
    updatedAt: Date
    isSuperAdmin: boolean
  }, teamName?: string): User {
    return {
      id: prismaUser.id,
      email: prismaUser.email,
      teamName: teamName || prismaUser.username, // Fallback to username if no teamName
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      isSuperAdmin: prismaUser.isSuperAdmin
    }
  }

  /**
   * Map Prisma User model to domain UserWithCredentials entity
   */
  private mapToUserWithCredentials(prismaUser: {
    id: string
    email: string
    username: string
    passwordHash: string
    createdAt: Date
    updatedAt: Date
    isSuperAdmin: boolean
  }): UserWithCredentials {
    return {
      ...this.mapToUser(prismaUser),
      passwordHash: prismaUser.passwordHash
    }
  }
}
