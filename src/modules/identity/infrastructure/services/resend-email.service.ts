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
        subject: '🔐 Reimposta la tua password - Fantacontratti',
        html: this.getPasswordResetTemplate(fullResetUrl),
      })
      console.log(`[EmailService] Password reset email sent to ${email}`)
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error)
      throw new Error('Errore nell\'invio dell\'email')
    }
  }

  async sendLeagueInviteEmail(
    email: string,
    leagueName: string,
    inviterName: string,
    inviteToken: string,
    inviteUrl: string,
    expiresAt: Date
  ): Promise<void> {
    const fullInviteUrl = `${inviteUrl}?token=${inviteToken}`

    // If no API key, log to console (development mode)
    if (!process.env.RESEND_API_KEY) {
      console.log('[EmailService] === LEAGUE INVITE EMAIL ===')
      console.log(`[EmailService] To: ${email}`)
      console.log(`[EmailService] League: ${leagueName}`)
      console.log(`[EmailService] Invited by: ${inviterName}`)
      console.log(`[EmailService] Invite URL: ${fullInviteUrl}`)
      console.log(`[EmailService] Expires: ${expiresAt.toISOString()}`)
      console.log('[EmailService] ==============================')
      return
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: `🏆 Sei stato invitato a "${leagueName}" - Fantacontratti`,
        html: this.getLeagueInviteTemplate(leagueName, inviterName, fullInviteUrl, expiresAt),
      })
      console.log(`[EmailService] League invite email sent to ${email}`)
    } catch (error) {
      console.error('[EmailService] Failed to send invite email:', error)
      throw new Error('Errore nell\'invio dell\'email di invito')
    }
  }

  /**
   * Generate password reset email template matching platform style
   */
  private getPasswordResetTemplate(resetUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0b;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #1a1c20; border-radius: 16px; border: 1px solid #2d3139;">

          <!-- Header con logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px;">
              <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; display: inline-block; line-height: 70px; font-size: 36px; text-align: center;">
                ⚽
              </div>
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 20px 0 0; letter-spacing: -0.5px;">
                Fantacontratti
              </h1>
              <p style="color: #9ca3af; font-size: 14px; margin: 5px 0 0;">
                Dynasty Fantasy Football
              </p>
            </td>
          </tr>

          <!-- Contenuto -->
          <tr>
            <td style="padding: 20px 40px 30px;">
              <h2 style="color: #f3f4f6; font-size: 20px; font-weight: 600; margin: 0 0 15px; text-align: center;">
                Reimposta la tua password
              </h2>
              <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 25px; text-align: center;">
                Hai richiesto di reimpostare la password del tuo account. Clicca il pulsante qui sotto per scegliere una nuova password.
              </p>

              <!-- Pulsante CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px;">
                    <a href="${resetUrl}"
                       style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a);
                              color: #ffffff; font-size: 16px; font-weight: 600;
                              text-decoration: none; padding: 14px 32px; border-radius: 8px;
                              box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);">
                      🔐 Reimposta Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info scadenza -->
              <div style="background-color: #111214; border-radius: 8px; padding: 15px; border-left: 3px solid #f59e0b;">
                <p style="color: #fbbf24; font-size: 13px; margin: 0; font-weight: 500;">
                  ⏱️ Il link scade tra 1 ora
                </p>
                <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;">
                  Se non hai richiesto tu il reset, puoi ignorare questa email in sicurezza.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; border-top: 1px solid #2d3139;">
              <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">
                Questa email è stata inviata automaticamente da Fantacontratti.<br>
                Non rispondere a questa email.
              </p>
              <p style="color: #4b5563; font-size: 11px; text-align: center; margin: 15px 0 0;">
                © ${new Date().getFullYear()} Fantacontratti. Tutti i diritti riservati.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  }

  /**
   * Generate league invite email template matching platform style
   */
  private getLeagueInviteTemplate(leagueName: string, inviterName: string, inviteUrl: string, expiresAt: Date): string {
    const expiresFormatted = expiresAt.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0b;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #1a1c20; border-radius: 16px; border: 1px solid #2d3139;">

          <!-- Header con logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px;">
              <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; display: inline-block; line-height: 70px; font-size: 36px; text-align: center;">
                ⚽
              </div>
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 20px 0 0; letter-spacing: -0.5px;">
                Fantacontratti
              </h1>
              <p style="color: #9ca3af; font-size: 14px; margin: 5px 0 0;">
                Dynasty Fantasy Football
              </p>
            </td>
          </tr>

          <!-- Contenuto -->
          <tr>
            <td style="padding: 20px 40px 30px;">
              <h2 style="color: #f3f4f6; font-size: 20px; font-weight: 600; margin: 0 0 15px; text-align: center;">
                Sei stato invitato!
              </h2>
              <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 10px; text-align: center;">
                <strong style="color: #ffffff;">${inviterName}</strong> ti ha invitato a unirti alla lega
              </p>
              <p style="color: #fbbf24; font-size: 22px; font-weight: bold; margin: 0 0 25px; text-align: center;">
                🏆 ${leagueName}
              </p>

              <!-- Pulsante CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px;">
                    <a href="${inviteUrl}"
                       style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a);
                              color: #ffffff; font-size: 16px; font-weight: 600;
                              text-decoration: none; padding: 14px 32px; border-radius: 8px;
                              box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);">
                      🎯 Accetta Invito
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info scadenza -->
              <div style="background-color: #111214; border-radius: 8px; padding: 15px; border-left: 3px solid #f59e0b;">
                <p style="color: #fbbf24; font-size: 13px; margin: 0; font-weight: 500;">
                  ⏱️ L'invito scade il ${expiresFormatted}
                </p>
                <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;">
                  Se non conosci chi ti ha invitato, puoi ignorare questa email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; border-top: 1px solid #2d3139;">
              <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">
                Questa email è stata inviata automaticamente da Fantacontratti.<br>
                Non rispondere a questa email.
              </p>
              <p style="color: #4b5563; font-size: 11px; text-align: center; margin: 15px 0 0;">
                © ${new Date().getFullYear()} Fantacontratti. Tutti i diritti riservati.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  }
}
