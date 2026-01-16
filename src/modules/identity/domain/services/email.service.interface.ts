/**
 * Email Service Interface
 * Abstracts email sending functionality for password reset and other notifications
 */
export interface IEmailService {
  /**
   * Send password reset email with a reset link
   * @param email - Recipient email address
   * @param resetToken - The password reset token
   * @param resetUrl - Full URL for password reset page
   */
  sendPasswordResetEmail(email: string, resetToken: string, resetUrl: string): Promise<void>
}
