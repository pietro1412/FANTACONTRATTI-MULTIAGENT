/**
 * Identity Module - Public API
 *
 * This file exports the public API of the Identity module.
 * External modules should only import from this file.
 */

// Domain Entities
export type { User, UserWithCredentials, CreateUserData } from './domain/entities/user.entity'

// Domain Repository Interfaces
export type { IUserRepository } from './domain/repositories/user.repository.interface'

// Domain Service Interfaces
export type { IPasswordService } from './domain/services/password.service'
export type { ITokenService, TokenPayload } from './domain/services/token.service'

// Application DTOs
export type {
  LoginDto,
  RegisterDto,
  AuthResultDto,
  RefreshTokenDto,
  RefreshTokenResultDto,
} from './application/dto/auth.dto'

// Application Use Cases
export { LoginUseCase } from './application/use-cases/login.use-case'
export { RegisterUseCase } from './application/use-cases/register.use-case'
export { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case'

// Infrastructure (re-export for convenience)
export { authRoutes } from './infrastructure'

// =====================================================
// PRESENTATION LAYER EXPORTS
// =====================================================

// Re-export presentation layer
export * from './presentation'
