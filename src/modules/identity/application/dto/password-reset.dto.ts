/**
 * DTOs for Password Reset functionality
 */

/**
 * Request to initiate password reset
 */
export interface ForgotPasswordDto {
  email: string
}

/**
 * Request to complete password reset with new password
 */
export interface ResetPasswordDto {
  token: string
  newPassword: string
}

/**
 * Result of forgot password request
 */
export interface ForgotPasswordResultDto {
  message: string
}

/**
 * Result of reset password request
 */
export interface ResetPasswordResultDto {
  message: string
}
