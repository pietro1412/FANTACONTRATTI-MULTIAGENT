/**
 * Refresh Token Use Case - Application Layer
 *
 * Handles token refresh by validating the refresh token
 * and issuing new access and refresh tokens.
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { UnauthorizedError, NotFoundError } from '../../../../shared/infrastructure/http/errors'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import type { ITokenService } from '../../domain/services/token.service'
import type { RefreshTokenDto, RefreshTokenResultDto } from '../dto/auth.dto'

export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(dto: RefreshTokenDto): Promise<Result<RefreshTokenResultDto, UnauthorizedError | NotFoundError>> {
    // Verify the refresh token
    const payload = this.tokenService.verifyRefreshToken(dto.refreshToken)

    if (!payload) {
      return fail(new UnauthorizedError('Refresh token non valido o scaduto'))
    }

    // Verify the user still exists
    const user = await this.userRepository.findById(payload.userId)

    if (!user) {
      return fail(new NotFoundError('Utente non trovato'))
    }

    // Generate new tokens
    const accessToken = this.tokenService.generateAccessToken(user.id)
    const refreshToken = this.tokenService.generateRefreshToken(user.id)

    return ok({
      accessToken,
      refreshToken,
    })
  }
}
