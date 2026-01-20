// =============================================================================
// AuthContext - Authentication Context for FantaContratti Mobile App
// =============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { User, AuthState, LoginCredentials, AuthResponse } from '../types';

// =============================================================================
// Constants
// =============================================================================

const TOKEN_KEY = 'fantacontratti_auth_token';
const USER_KEY = 'fantacontratti_user';

// API base URL - should be configured via environment variables in production
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3003';

// =============================================================================
// Context Types
// =============================================================================

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// =============================================================================
// Context Creation
// =============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Store authentication token securely
 */
async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/**
 * Retrieve authentication token from secure storage
 */
async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

/**
 * Remove authentication token from secure storage
 */
async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * Store user data securely
 */
async function storeUser(user: User): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

/**
 * Retrieve user data from secure storage
 */
async function getStoredUser(): Promise<User | null> {
  const userJson = await SecureStore.getItemAsync(USER_KEY);
  if (userJson) {
    try {
      return JSON.parse(userJson) as User;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Remove user data from secure storage
 */
async function removeUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

// =============================================================================
// AuthProvider Component
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Check authentication status on app start
   * Validates the stored token with the server
   */
  const checkAuth = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const token = await getToken();

      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Validate token with server
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const userData: User = {
          id: data.id,
          email: data.email,
          username: data.username,
          isSuperAdmin: data.isSuperAdmin || false,
          profilePhoto: data.profilePhoto,
          emailVerified: data.emailVerified,
        };
        setUser(userData);
        setIsAuthenticated(true);
        await storeUser(userData);
      } else {
        // Token is invalid, clear storage
        await removeToken();
        await removeUser();
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // On network error, try to use cached user data
      const cachedUser = await getStoredUser();
      if (cachedUser) {
        setUser(cachedUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password } as LoginCredentials),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || errorData.message || 'Login failed'
          );
        }

        const data: AuthResponse = await response.json();

        // Store token and user data
        await storeToken(data.token);

        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          isSuperAdmin: data.user.isSuperAdmin || false,
          profilePhoto: data.user.profilePhoto,
          emailVerified: data.user.emailVerified,
        };

        await storeUser(userData);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        // Re-throw the error so the calling component can handle it
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Logout the current user
   */
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const token = await getToken();

      // Optionally notify the server about logout
      if (token) {
        try {
          await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch {
          // Ignore server errors during logout
          // We still want to clear local state
        }
      }

      // Clear storage
      await removeToken();
      await removeUser();

      // Reset state
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Even on error, clear local state
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // =============================================================================
  // Context Value
  // =============================================================================

  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// =============================================================================
// useAuth Hook
// =============================================================================

/**
 * Custom hook to access the authentication context
 * Must be used within an AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

// =============================================================================
// Exports
// =============================================================================

export { AuthContext };
export type { AuthContextType };
