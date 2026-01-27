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

  /**
   * Send league invite email with invite link
   * @param email - Recipient email address
   * @param leagueName - Name of the league
   * @param inviterName - Name of who sent the invite
   * @param inviteToken - The invite token
   * @param inviteUrl - Base URL for invite acceptance page
   * @param expiresAt - When the invite expires
   */
  sendLeagueInviteEmail(
    email: string,
    leagueName: string,
    inviterName: string,
    inviteToken: string,
    inviteUrl: string,
    expiresAt: Date
  ): Promise<void>

  /**
   * Send notification to league admin when someone requests to join
   * @param adminEmail - Admin's email address
   * @param leagueName - Name of the league
   * @param requesterUsername - Username of who requested to join
   * @param teamName - Proposed team name
   * @param adminPanelUrl - Direct link to admin panel members section
   */
  sendJoinRequestNotificationEmail(
    adminEmail: string,
    leagueName: string,
    requesterUsername: string,
    teamName: string,
    adminPanelUrl: string
  ): Promise<void>

  /**
   * Send notification to manager when admin approves or rejects their join request
   * @param managerEmail - Manager's email address
   * @param leagueName - Name of the league
   * @param approved - Whether the request was approved or rejected
   * @param leagueUrl - Direct link to the league (if approved)
   */
  sendJoinRequestResponseEmail(
    managerEmail: string,
    leagueName: string,
    approved: boolean,
    leagueUrl?: string
  ): Promise<void>

  /**
   * Send notification to admin when a manager accepts or rejects their invite
   * @param adminEmail - Admin's email address
   * @param leagueName - Name of the league
   * @param managerUsername - Username of the manager who responded
   * @param accepted - Whether the invite was accepted or rejected
   * @param leagueUrl - Direct link to the league
   */
  sendInviteResponseNotificationEmail(
    adminEmail: string,
    leagueName: string,
    managerUsername: string,
    accepted: boolean,
    leagueUrl: string
  ): Promise<void>

  /**
   * Send notification to manager when they are expelled (kicked) from a league
   * @param managerEmail - Manager's email address
   * @param leagueName - Name of the league
   */
  sendMemberExpelledEmail(
    managerEmail: string,
    leagueName: string
  ): Promise<void>
}
