/**
 * Identity Module - useAuth Hook
 *
 * Re-exports the existing useAuth hook for backward compatibility.
 * This allows gradual migration to the modular architecture.
 *
 * Future: This hook will be reimplemented using the new use cases:
 * - LoginUseCase
 * - RegisterUseCase
 * - RefreshTokenUseCase
 */

// Re-export from existing location for now
export { useAuth, AuthProvider } from '@/hooks/useAuth'

// Future implementation example:
// import { useCallback, useState } from 'react'
// import { LoginUseCase } from '../../application/use-cases/login.use-case'
// import { RegisterUseCase } from '../../application/use-cases/register.use-case'
//
// export function useAuth() {
//   const loginUseCase = new LoginUseCase(...)
//   const registerUseCase = new RegisterUseCase(...)
//
//   const login = useCallback(async (email: string, password: string) => {
//     return loginUseCase.execute({ email, password })
//   }, [])
//
//   const register = useCallback(async (data: RegisterDto) => {
//     return registerUseCase.execute(data)
//   }, [])
//
//   return { login, register, ... }
// }
