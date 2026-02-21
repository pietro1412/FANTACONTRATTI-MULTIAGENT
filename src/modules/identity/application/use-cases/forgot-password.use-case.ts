import { randomBytes } from 'crypto'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import type { IEmailService } from '../../domain/services/email.service.interface'
import type { ForgotPasswordDto, ForgotPasswordResultDto } from '../dto/password-reset.dto'
import type { Result} from '@/shared/infrastructure/http/result';
import { ok } from '@/shared/infrastructure/http/result'

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
    console.log(`[ForgotPassword] Looking for user with email: ${email}`)
    const user = await this.userRepository.findByEmail(email)
    if (!user) {
      console.log(`[ForgotPassword] User not found: ${email}`)
      // Don't reveal that user doesn't exist
      return ok(successMessage)
    }
    console.log(`[ForgotPassword] User found: ${user.id}`)

    // Generate secure reset token
    const resetToken = randomBytes(32).toString('hex')

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // Store token in database
    await this.userRepository.setPasswordResetToken(user.id, resetToken, expiresAt)
    console.log(`[ForgotPassword] Token stored for user: ${user.id}`)

    // Build reset URL - use FRONTEND_URL for production, fallback to localhost
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const resetUrl = `${baseUrl}/reset-password`
    console.log(`[ForgotPassword] Reset URL base: ${baseUrl}`)

    // Send email - await to ensure it completes in serverless environment
    try {
      await this.emailService.sendPasswordResetEmail(email, resetToken, resetUrl)
      console.log(`[ForgotPassword] Email sent successfully to: ${email}`)
    } catch (err) {
      console.error('[ForgotPassword] Failed to send email:', err)
    }

    return ok(successMessage)
  }
}
