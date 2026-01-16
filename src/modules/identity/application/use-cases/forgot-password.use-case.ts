import { randomBytes } from 'crypto'
import { IUserRepository } from '../../domain/repositories/user.repository.interface'
import { IEmailService } from '../../domain/services/email.service.interface'
import { ForgotPasswordDto, ForgotPasswordResultDto } from '../dto/password-reset.dto'
import { Result, ok } from '../../../../shared/infrastructure/http/result'

/**
 * Use case for initiating password reset
 * Generates a reset token, stores it, and sends email
 */
export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService
  ) {}

  async execute(dto: ForgotPasswordDto): Promise<Result<ForgotPasswordResultDto, never>> {
    const { email } = dto

    // Always return success to prevent email enumeration attacks
    const successMessage = {
      message: 'Se l\'email esiste nel sistema, riceverai un link per reimpostare la password.'
    }

    // Find user by email
    const user = await this.userRepository.findByEmail(email)
    if (!user) {
      // Don't reveal that user doesn't exist
      return ok(successMessage)
    }

    // Generate secure reset token
    const resetToken = randomBytes(32).toString('hex')

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // Store token in database
    await this.userRepository.setPasswordResetToken(user.id, resetToken, expiresAt)

    // Build reset URL
    const baseUrl = process.env.APP_URL || 'http://localhost:5173'
    const resetUrl = `${baseUrl}/reset-password`

    // Send email (don't await to avoid timing attacks)
    this.emailService.sendPasswordResetEmail(email, resetToken, resetUrl).catch(err => {
      console.error('[ForgotPassword] Failed to send email:', err)
    })

    return ok(successMessage)
  }
}
