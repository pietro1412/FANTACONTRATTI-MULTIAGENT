import { IUserRepository } from '../../domain/repositories/user.repository.interface'
import { IPasswordService } from '../../domain/services/password.service.interface'
import { ResetPasswordDto, ResetPasswordResultDto } from '../dto/password-reset.dto'
import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { ValidationError, NotFoundError } from '../../../../shared/infrastructure/http/errors'

/**
 * Use case for completing password reset
 * Validates token and updates password
 */
export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService
  ) {}

  async execute(dto: ResetPasswordDto): Promise<Result<ResetPasswordResultDto, ValidationError | NotFoundError>> {
    const { token, newPassword } = dto

    // Validate password strength
    if (!newPassword || newPassword.length < 8) {
      return fail(new ValidationError('La password deve essere di almeno 8 caratteri'))
    }

    // Check for uppercase
    if (!/[A-Z]/.test(newPassword)) {
      return fail(new ValidationError('La password deve contenere almeno una lettera maiuscola'))
    }

    // Check for number
    if (!/[0-9]/.test(newPassword)) {
      return fail(new ValidationError('La password deve contenere almeno un numero'))
    }

    // Find user by reset token
    const user = await this.userRepository.findByPasswordResetToken(token)
    if (!user) {
      return fail(new NotFoundError('Token non valido o scaduto'))
    }

    // Check if token is expired
    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      // Clear expired token
      await this.userRepository.clearPasswordResetToken(user.id)
      return fail(new NotFoundError('Token scaduto. Richiedi un nuovo reset.'))
    }

    // Hash new password
    const passwordHash = await this.passwordService.hash(newPassword)

    // Update password and clear reset token
    await this.userRepository.updatePassword(user.id, passwordHash)
    await this.userRepository.clearPasswordResetToken(user.id)

    return ok({
      message: 'Password aggiornata con successo. Puoi ora effettuare il login.'
    })
  }
}
