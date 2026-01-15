/**
 * Authentication DTOs - Application Layer
 *
 * Data Transfer Objects for authentication operations.
 * These define the shape of data flowing in and out of use cases.
 */

import type { User } from '../../domain/entities/user.entity'

/**
 * DTO for user login request
 */
export interface LoginDto {
  email: string
  password: string
}

/**
 * DTO for user registration request
 */
export interface RegisterDto {
  email: string
  password: string
  teamName: string
}

/**
 * DTO for successful authentication result
 */
export interface AuthResultDto {
  user: User
  accessToken: string
  refreshToken: string
}

/**
 * DTO for token refresh request
 */
export interface RefreshTokenDto {
  refreshToken: string
}

/**
 * DTO for token refresh result
 */
export interface RefreshTokenResultDto {
  accessToken: string
  refreshToken: string
}
