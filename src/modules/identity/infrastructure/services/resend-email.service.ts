import { Resend } from 'resend'
import { IEmailService } from '../../domain/services/email.service.interface'

/**
 * Resend Email Service Implementation
 * Uses Resend API to send transactional emails
 */
export class ResendEmailService implements IEmailService {
  private resend: Resend
  private fromEmail: string

  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn('[EmailService] RESEND_API_KEY not configured - emails will be logged to console')
    }
    this.resend = new Resend(apiKey || 'dummy')
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@fantacontratti.it'
  }

  async sendPasswordResetEmail(email: string, resetToken: string, resetUrl: string): Promise<void> {
    const fullResetUrl = `${resetUrl}?token=${resetToken}`

    // If no API key, log to console (development mode)
    if (!process.env.RESEND_API_KEY) {
      console.log('[EmailService] === PASSWORD RESET EMAIL ===')
      console.log(`[EmailService] To: ${email}`)
      console.log(`[EmailService] Reset URL: ${fullResetUrl}`)
      console.log('[EmailService] ==============================')
      return
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Reimposta la tua password - FantaContratti',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; text-align: center;">FantaContratti</h1>
            <h2 style="color: #666;">Richiesta di reset password</h2>
            <p>Hai richiesto di reimpostare la tua password. Clicca sul link qui sotto per procedere:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${fullResetUrl}"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reimposta Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Se non hai richiesto tu il reset della password, puoi ignorare questa email.
            </p>
            <p style="color: #666; font-size: 14px;">
              Il link scadrà tra 1 ora.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px; text-align: center;">
              Questa email è stata inviata automaticamente da FantaContratti.
            </p>
          </div>
        `,
      })
      console.log(`[EmailService] Password reset email sent to ${email}`)
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error)
      throw new Error('Errore nell\'invio dell\'email')
    }
  }
}
