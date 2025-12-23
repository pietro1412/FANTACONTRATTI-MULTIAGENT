import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'La password deve essere di almeno 8 caratteri' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'La password deve contenere almeno una lettera maiuscola' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'La password deve contenere almeno un numero' }
  }
  return { valid: true }
}
