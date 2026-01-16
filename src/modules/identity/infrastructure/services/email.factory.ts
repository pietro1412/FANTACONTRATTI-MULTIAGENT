import { IEmailService } from '../../domain/services/email.service.interface'
import { ResendEmailService } from './resend-email.service'
import { GmailEmailService } from './gmail-email.service'

/**
 * Email Service Factory
 * Creates the appropriate email service based on environment configuration
 *
 * Priority:
 * 1. EMAIL_PROVIDER env var (explicit choice)
 * 2. Auto-detect based on available credentials
 */
export function createEmailService(): IEmailService {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase()

  // Explicit provider selection
  if (provider === 'gmail') {
    console.log('[EmailFactory] Using Gmail provider')
    return new GmailEmailService()
  }

  if (provider === 'resend') {
    console.log('[EmailFactory] Using Resend provider')
    return new ResendEmailService()
  }

  // Auto-detect based on available credentials
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    console.log('[EmailFactory] Auto-detected Gmail credentials, using Gmail provider')
    return new GmailEmailService()
  }

  if (process.env.RESEND_API_KEY) {
    console.log('[EmailFactory] Auto-detected Resend credentials, using Resend provider')
    return new ResendEmailService()
  }

  // Default to Gmail (will log to console if not configured)
  console.log('[EmailFactory] No email provider configured, defaulting to Gmail (console mode)')
  return new GmailEmailService()
}
