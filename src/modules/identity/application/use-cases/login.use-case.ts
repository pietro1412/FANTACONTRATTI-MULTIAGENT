/**
 * Login Use Case - Application Layer
 *
 * Handles user authentication by email and password.
 * Returns tokens on successful authentication.
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { UnauthorizedError } from '../../../../shared/infrastructure/http/errors'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import type { IPasswordService } from '../../domain/services/password.service'
import type { ITokenService } from '../../domain/services/token.service'
import type { LoginDto, AuthResultDto } from '../dto/auth.dto'
import type { User } from '../../domain/entities/user.entity'

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService
  ) {}

  async execute(dto: LoginDto): Promise<Result<AuthResultDto, UnauthorizedError>> {
    // Find user by email
    const userWithCredentials = await this.userRepository.findByEmail(dto.email)

    if (!userWithCredentials) {
      return fail(new UnauthorizedError('Credenziali non valide'))
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verify(
      dto.password,
      userWithCredentials.passwordHash
    )

    if (!isPasswordValid) {
      return fail(new UnauthorizedError('Credenziali non valide'))
    }

    // Generate tokens
    const accessToken = this.tokenService.generateAccessToken(userWithCredentials.id)
    const refreshToken = this.tokenService.generateRefreshToken(userWithCredentials.id)

    // Update last login timestamp
    await this.userRepository.updateLastLogin(userWithCredentials.id)

    // Remove sensitive data from user object
    const user: User = {
      id: userWithCredentials.id,
      email: userWithCredentials.email,
      teamName: userWithCredentials.teamName,
      createdAt: userWithCredentials.createdAt,
      updatedAt: userWithCredentials.updatedAt,
      isSuperAdmin: userWithCredentials.isSuperAdmin,
    }

    return ok({
      user,
      accessToken,
      refreshToken,
    })
  }
}
