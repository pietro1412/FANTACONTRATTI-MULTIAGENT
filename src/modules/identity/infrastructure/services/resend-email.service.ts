import { Resend } from 'resend'
import type { IEmailService } from '../../domain/services/email.service.interface'

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

  async sendJoinRequestNotificationEmail(
    adminEmail: string,
    leagueName: string,
    requesterUsername: string,
    teamName: string,
    adminPanelUrl: string
  ): Promise<void> {
    // If no API key, log to console (development mode)
    if (!process.env.RESEND_API_KEY) {
      console.log('[EmailService] === JOIN REQUEST NOTIFICATION ===')
      console.log(`[EmailService] To: ${adminEmail}`)
      console.log(`[EmailService] League: ${leagueName}`)
      console.log(`[EmailService] Requester: ${requesterUsername}`)
      console.log(`[EmailService] Team Name: ${teamName}`)
      console.log(`[EmailService] Admin Panel URL: ${adminPanelUrl}`)
      console.log('[EmailService] ==============================')
      return
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: adminEmail,
        subject: `📥 Nuova richiesta di partecipazione a "${leagueName}" - Fantacontratti`,
        html: this.getJoinRequestTemplate(leagueName, requesterUsername, teamName, adminPanelUrl),
      })
      console.log(`[EmailService] Join request notification sent to ${adminEmail}`)
    } catch (error) {
      console.error('[EmailService] Failed to send join request notification:', error)
      // Don't throw - notification failure shouldn't block the join request
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
   * Generate join request notification template for admin
   */
  private getJoinRequestTemplate(leagueName: string, requesterUsername: string, teamName: string, adminPanelUrl: string): string {
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
                Nuova Richiesta di Partecipazione
              </h2>
              <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 20px; text-align: center;">
                Un utente ha richiesto di unirsi alla tua lega
              </p>

              <!-- Info richiesta -->
              <div style="background-color: #111214; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #6b7280; font-size: 13px;">Lega:</span>
                      <span style="color: #fbbf24; font-size: 15px; font-weight: 600; float: right;">🏆 ${leagueName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #2d3139;">
                      <span style="color: #6b7280; font-size: 13px;">Utente:</span>
                      <span style="color: #ffffff; font-size: 15px; font-weight: 500; float: right;">${requesterUsername}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #2d3139;">
                      <span style="color: #6b7280; font-size: 13px;">Squadra proposta:</span>
                      <span style="color: #22c55e; font-size: 15px; font-weight: 500; float: right;">${teamName}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Pulsante CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px;">
                    <a href="${adminPanelUrl}"
                       style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                              color: #ffffff; font-size: 16px; font-weight: 600;
                              text-decoration: none; padding: 14px 32px; border-radius: 8px;
                              box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);">
                      👤 Gestisci Richiesta
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info -->
              <div style="background-color: #111214; border-radius: 8px; padding: 15px; border-left: 3px solid #3b82f6;">
                <p style="color: #60a5fa; font-size: 13px; margin: 0; font-weight: 500;">
                  ℹ️ Cosa puoi fare
                </p>
                <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;">
                  Accedi al pannello admin per approvare o rifiutare questa richiesta di partecipazione.
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

  async sendJoinRequestResponseEmail(
    managerEmail: string,
    leagueName: string,
    approved: boolean,
    leagueUrl?: string
  ): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log('[EmailService] === JOIN REQUEST RESPONSE EMAIL ===')
      console.log(`[EmailService] To: ${managerEmail}`)
      console.log(`[EmailService] League: ${leagueName}`)
      console.log(`[EmailService] Approved: ${approved}`)
      console.log('[EmailService] ==============================')
      return
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: managerEmail,
        subject: approved
          ? `✅ Sei stato accettato in "${leagueName}" - Fantacontratti`
          : `❌ Richiesta rifiutata per "${leagueName}" - Fantacontratti`,
        html: this.getJoinRequestResponseTemplate(leagueName, approved, leagueUrl),
      })
      console.log(`[EmailService] Join request response email sent to ${managerEmail}`)
    } catch (error) {
      console.error('[EmailService] Failed to send join request response email:', error)
    }
  }

  async sendInviteResponseNotificationEmail(
    adminEmail: string,
    leagueName: string,
    managerUsername: string,
    accepted: boolean,
    leagueUrl: string
  ): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log('[EmailService] === INVITE RESPONSE NOTIFICATION ===')
      console.log(`[EmailService] To: ${adminEmail}`)
      console.log(`[EmailService] League: ${leagueName}`)
      console.log(`[EmailService] Manager: ${managerUsername}`)
      console.log(`[EmailService] Accepted: ${accepted}`)
      console.log('[EmailService] ==============================')
      return
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: adminEmail,
        subject: accepted
          ? `✅ ${managerUsername} ha accettato l'invito a "${leagueName}" - Fantacontratti`
          : `❌ ${managerUsername} ha rifiutato l'invito a "${leagueName}" - Fantacontratti`,
        html: this.getInviteResponseTemplate(leagueName, managerUsername, accepted, leagueUrl),
      })
      console.log(`[EmailService] Invite response notification sent to ${adminEmail}`)
    } catch (error) {
      console.error('[EmailService] Failed to send invite response notification:', error)
    }
  }

  private getJoinRequestResponseTemplate(leagueName: string, approved: boolean, leagueUrl?: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0b;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #1a1c20; border-radius: 16px; border: 1px solid #2d3139;">
        <tr><td align="center" style="padding: 40px 40px 20px;">
          <div style="width: 70px; height: 70px; background: linear-gradient(135deg, ${approved ? '#22c55e, #16a34a' : '#ef4444, #dc2626'}); border-radius: 50%; line-height: 70px; font-size: 36px; text-align: center;">${approved ? '✅' : '❌'}</div>
          <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 20px 0 0;">Fantacontratti</h1>
        </td></tr>
        <tr><td style="padding: 20px 40px 30px;">
          <h2 style="color: #f3f4f6; font-size: 20px; font-weight: 600; margin: 0 0 15px; text-align: center;">${approved ? 'Richiesta Approvata!' : 'Richiesta Rifiutata'}</h2>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 10px; text-align: center;">La tua richiesta di partecipare alla lega</p>
          <p style="color: #fbbf24; font-size: 22px; font-weight: bold; margin: 0 0 25px; text-align: center;">🏆 ${leagueName}</p>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 25px; text-align: center;">
            ${approved ? 'è stata <strong style="color: #22c55e;">approvata</strong>! Ora fai parte della lega.' : 'è stata <strong style="color: #ef4444;">rifiutata</strong> dall\'amministratore.'}
          </p>
          ${approved && leagueUrl ? `<table role="presentation" width="100%"><tr><td align="center" style="padding: 10px 0 25px;"><a href="${leagueUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">🚀 Vai alla Lega</a></td></tr></table>` : ''}
        </td></tr>
        <tr><td style="padding: 20px 40px 30px; border-top: 1px solid #2d3139;"><p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Fantacontratti</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  }

  private getInviteResponseTemplate(leagueName: string, managerUsername: string, accepted: boolean, leagueUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0b;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #1a1c20; border-radius: 16px; border: 1px solid #2d3139;">
        <tr><td align="center" style="padding: 40px 40px 20px;">
          <div style="width: 70px; height: 70px; background: linear-gradient(135deg, ${accepted ? '#22c55e, #16a34a' : '#f59e0b, #d97706'}); border-radius: 50%; line-height: 70px; font-size: 36px; text-align: center;">${accepted ? '🎉' : '📭'}</div>
          <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 20px 0 0;">Fantacontratti</h1>
        </td></tr>
        <tr><td style="padding: 20px 40px 30px;">
          <h2 style="color: #f3f4f6; font-size: 20px; font-weight: 600; margin: 0 0 15px; text-align: center;">${accepted ? 'Invito Accettato!' : 'Invito Rifiutato'}</h2>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 20px; text-align: center;">
            <strong style="color: #ffffff;">${managerUsername}</strong> ha ${accepted ? '<strong style="color: #22c55e;">accettato</strong>' : '<strong style="color: #f59e0b;">rifiutato</strong>'} il tuo invito per la lega
          </p>
          <p style="color: #fbbf24; font-size: 22px; font-weight: bold; margin: 0 0 25px; text-align: center;">🏆 ${leagueName}</p>
          <table role="presentation" width="100%"><tr><td align="center" style="padding: 10px 0 25px;"><a href="${leagueUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">👀 Vai alla Lega</a></td></tr></table>
        </td></tr>
        <tr><td style="padding: 20px 40px 30px; border-top: 1px solid #2d3139;"><p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Fantacontratti</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  }

  async sendMemberExpelledEmail(
    managerEmail: string,
    leagueName: string
  ): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log('[EmailService] === MEMBER EXPELLED EMAIL ===')
      console.log(`[EmailService] To: ${managerEmail}`)
      console.log(`[EmailService] League: ${leagueName}`)
      console.log('[EmailService] ==============================')
      return
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: managerEmail,
        subject: `🚫 Sei stato rimosso da "${leagueName}" - Fantacontratti`,
        html: this.getMemberExpelledTemplate(leagueName),
      })
      console.log(`[EmailService] Member expelled email sent to ${managerEmail}`)
    } catch (error) {
      console.error('[EmailService] Failed to send member expelled email:', error)
    }
  }

  private getMemberExpelledTemplate(leagueName: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0b;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #1a1c20; border-radius: 16px; border: 1px solid #2d3139;">
        <tr><td align="center" style="padding: 40px 40px 20px;">
          <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50%; line-height: 70px; font-size: 36px; text-align: center;">🚫</div>
          <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 20px 0 0;">Fantacontratti</h1>
        </td></tr>
        <tr><td style="padding: 20px 40px 30px;">
          <h2 style="color: #f3f4f6; font-size: 20px; font-weight: 600; margin: 0 0 15px; text-align: center;">Sei stato rimosso dalla lega</h2>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 10px; text-align: center;">L'amministratore ti ha rimosso dalla lega</p>
          <p style="color: #fbbf24; font-size: 22px; font-weight: bold; margin: 0 0 25px; text-align: center;">🏆 ${leagueName}</p>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 25px; text-align: center;">Se ritieni che questo sia un errore, contatta l'amministratore della lega.</p>
        </td></tr>
        <tr><td style="padding: 20px 40px 30px; border-top: 1px solid #2d3139;"><p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Fantacontratti</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  }

  async sendContractRenewalReceipt(
    email: string,
    managerName: string,
    teamName: string,
    leagueName: string,
    pdfBuffer: Buffer,
    renewalCount: number,
    excelBuffer?: Buffer
  ): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0] ?? ''
    const safeTeamName = teamName.replace(/\s+/g, '_')
    const pdfFilename = `Ricevuta_Rinnovi_${safeTeamName}_${dateStr}.pdf`
    const excelFilename = `Contratti_${safeTeamName}_${dateStr}.xlsx`

    if (!process.env.RESEND_API_KEY) {
      console.log('[EmailService] === CONTRACT RENEWAL RECEIPT EMAIL ===')
      console.log(`[EmailService] To: ${email}`)
      console.log(`[EmailService] Manager: ${managerName}`)
      console.log(`[EmailService] Team: ${teamName}`)
      console.log(`[EmailService] League: ${leagueName}`)
      console.log(`[EmailService] Renewals: ${renewalCount}`)
      console.log(`[EmailService] PDF Size: ${pdfBuffer.length} bytes`)
      console.log(`[EmailService] PDF Attachment: ${pdfFilename}`)
      if (excelBuffer) {
        console.log(`[EmailService] Excel Size: ${excelBuffer.length} bytes`)
        console.log(`[EmailService] Excel Attachment: ${excelFilename}`)
      }
      console.log('[EmailService] ==============================')
      return
    }

    try {
      // Build attachments array
      const attachments: Array<{ filename: string; content: Buffer }> = [
        {
          filename: pdfFilename,
          content: pdfBuffer,
        },
      ]

      if (excelBuffer) {
        attachments.push({
          filename: excelFilename,
          content: excelBuffer,
        })
      }

      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: `📄 Ricevuta Rinnovi Contrattuali - ${teamName} - Fantacontratti`,
        html: this.getContractRenewalReceiptTemplate(managerName, teamName, leagueName, renewalCount),
        attachments,
      })
      console.log(`[EmailService] Contract renewal receipt sent to ${email} (PDF + ${excelBuffer ? 'Excel' : 'no Excel'})`)
    } catch (error) {
      console.error('[EmailService] Failed to send contract renewal receipt:', error)
    }
  }

  private getContractRenewalReceiptTemplate(managerName: string, teamName: string, leagueName: string, renewalCount: number): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0b;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #1a1c20; border-radius: 16px; border: 1px solid #2d3139;">
        <tr><td align="center" style="padding: 40px 40px 20px;">
          <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 50%; line-height: 70px; font-size: 36px; text-align: center;">✅</div>
          <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 20px 0 0;">Fantacontratti</h1>
        </td></tr>
        <tr><td style="padding: 20px 40px 30px;">
          <h2 style="color: #f3f4f6; font-size: 20px; font-weight: 600; margin: 0 0 15px; text-align: center;">Rinnovi Consolidati!</h2>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 20px; text-align: center;">
            Ciao <strong style="color: #ffffff;">${managerName}</strong>,<br>
            i tuoi rinnovi contrattuali sono stati consolidati con successo.
          </p>
          <div style="background-color: #111214; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
            <p style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Squadra</p>
            <p style="color: #22c55e; font-size: 18px; font-weight: bold; margin: 5px 0 15px;">⚽ ${teamName}</p>
            <p style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Lega</p>
            <p style="color: #fbbf24; font-size: 16px; font-weight: 600; margin: 5px 0 15px;">🏆 ${leagueName}</p>
            <p style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Contratti Rinnovati</p>
            <p style="color: #3b82f6; font-size: 24px; font-weight: bold; margin: 5px 0 0;">${renewalCount}</p>
          </div>
          <div style="background-color: #111214; border-radius: 8px; padding: 15px; border-left: 3px solid #3b82f6;">
            <p style="color: #60a5fa; font-size: 13px; margin: 0; font-weight: 500;">📎 Allegato: Ricevuta PDF</p>
            <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;">Trovi allegata la ricevuta completa dei tuoi rinnovi.</p>
          </div>
        </td></tr>
        <tr><td style="padding: 20px 40px 30px; border-top: 1px solid #2d3139;"><p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Fantacontratti</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  }
}
