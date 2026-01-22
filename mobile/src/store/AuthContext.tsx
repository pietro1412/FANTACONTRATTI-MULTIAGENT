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
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { User, AuthState, LoginCredentials, AuthResponse } from '../types';

// =============================================================================
// Storage Abstraction (SecureStore for native, localStorage for web)
// =============================================================================

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// =============================================================================
// Constants
// =============================================================================

const TOKEN_KEY = 'fantacontratti_auth_token';
const USER_KEY = 'fantacontratti_user';

// API base URL - should be configured via environment variables in production
// TODO: Use environment variable in production
const API_BASE_URL = 'http://10.93.249.172:3003';

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
  await storage.setItem(TOKEN_KEY, token);
}

/**
 * Retrieve authentication token from secure storage
 */
async function getToken(): Promise<string | null> {
  return await storage.getItem(TOKEN_KEY);
}

/**
 * Remove authentication token from secure storage
 */
async function removeToken(): Promise<void> {
  await storage.deleteItem(TOKEN_KEY);
}

/**
 * Store user data securely
 */
async function storeUser(user: User): Promise<void> {
  await storage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Retrieve user data from secure storage
 */
async function getStoredUser(): Promise<User | null> {
  const userJson = await storage.getItem(USER_KEY);
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
  await storage.deleteItem(USER_KEY);
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
    console.log('[AuthContext] checkAuth - starting');
    setIsLoading(true);
    try {
      const token = await getToken();
      console.log('[AuthContext] checkAuth - token:', token ? 'exists' : 'null');

      if (!token) {
        console.log('[AuthContext] checkAuth - no token, setting unauthenticated');
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Validate token with server
      console.log('[AuthContext] checkAuth - validating token with server...');
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('[AuthContext] checkAuth - server response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[AuthContext] checkAuth - user data received:', data.username);
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
        console.log('[AuthContext] checkAuth - authenticated successfully');
      } else {
        // Token is invalid, clear storage
        console.log('[AuthContext] checkAuth - token invalid, clearing');
        await removeToken();
        await removeUser();
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[AuthContext] checkAuth - error:', error);
      // On network error, try to use cached user data
      const cachedUser = await getStoredUser();
      if (cachedUser) {
        console.log('[AuthContext] checkAuth - using cached user');
        setUser(cachedUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      console.log('[AuthContext] checkAuth - done, setting isLoading false');
      setIsLoading(false);
    }
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      console.log('[AuthContext] login called with email:', email);
      console.log('[AuthContext] API_BASE_URL:', API_BASE_URL);
      setIsLoading(true);
      try {
        console.log('[AuthContext] fetching:', `${API_BASE_URL}/api/auth/login`);
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emailOrUsername: email, password }),
        });
        console.log('[AuthContext] response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log('[AuthContext] error data:', errorData);
          throw new Error(
            errorData.error || errorData.message || 'Login failed'
          );
        }

        const responseData = await response.json();
        console.log('Login response:', JSON.stringify(responseData, null, 2));

        // API returns { success: true, data: { user, accessToken } }
        const authData = responseData.data;
        const accessToken = authData?.accessToken;
        const apiUser = authData?.user;

        console.log('Token:', accessToken);
        console.log('User:', JSON.stringify(apiUser, null, 2));

        if (!accessToken || typeof accessToken !== 'string') {
          throw new Error('Invalid token received from server');
        }

        // Store token and user data
        await storeToken(accessToken);

        const userData: User = {
          id: apiUser.id,
          email: apiUser.email,
          username: apiUser.username,
          isSuperAdmin: apiUser.isSuperAdmin || false,
          profilePhoto: apiUser.profilePhoto,
          emailVerified: apiUser.emailVerified,
        };

        await storeUser(userData);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.log('[AuthContext] login error:', error);
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
