import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authApi, setAccessToken } from '../services/api'

interface User {
  id: string
  email: string
  username: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (emailOrUsername: string, password: string) => Promise<{ success: boolean; message?: string }>
  register: (email: string, username: string, password: string, confirmPassword: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check auth status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const response = await authApi.me()
      if (response.success && response.data) {
        setUser(response.data)
      }
    } catch {
      // Not authenticated
    } finally {
      setIsLoading(false)
    }
  }

  async function login(emailOrUsername: string, password: string) {
    const response = await authApi.login({ emailOrUsername, password })

    if (response.success && response.data) {
      setAccessToken(response.data.accessToken)
      setUser(response.data.user)
      return { success: true }
    }

    return { success: false, message: response.message || 'Errore durante il login' }
  }

  async function register(email: string, username: string, password: string, confirmPassword: string) {
    const response = await authApi.register({ email, username, password, confirmPassword })

    if (response.success) {
      return { success: true }
    }

    return { success: false, message: response.message || 'Errore durante la registrazione' }
  }

  async function logout() {
    await authApi.logout()
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
