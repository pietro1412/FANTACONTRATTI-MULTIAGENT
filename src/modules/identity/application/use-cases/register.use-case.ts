/**
 * Register Use Case - Application Layer
 *
 * Handles new user registration.
 * Creates a new user account and returns tokens.
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { ConflictError } from '../../../../shared/infrastructure/http/errors'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import type { IPasswordService } from '../../domain/services/password.service'
import type { ITokenService } from '../../domain/services/token.service'
import type { RegisterDto, AuthResultDto } from '../dto/auth.dto'

export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService
  ) {}

  async execute(dto: RegisterDto): Promise<Result<AuthResultDto, ConflictError>> {
    // Normalize email to lowercase
    const normalizedEmail = dto.email.toLowerCase()

    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(normalizedEmail)

    if (existingUser) {
      return fail(new ConflictError('Email gia registrata'))
    }

    // Hash the password
    const passwordHash = await this.passwordService.hash(dto.password)

    // Create the new user
    const user = await this.userRepository.create({
      email: normalizedEmail,
      teamName: dto.teamName,
      passwordHash,
    })

    // Generate tokens
    const accessToken = this.tokenService.generateAccessToken(user.id)
    const refreshToken = this.tokenService.generateRefreshToken(user.id)

    return ok({
      user,
      accessToken,
      refreshToken,
    })
  }
}
