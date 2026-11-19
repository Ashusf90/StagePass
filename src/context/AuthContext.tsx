import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  apiRequest,
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from '../api/client.ts';
import type { UserProfile } from '../types/api.ts';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    role: 'attendee' | 'organizer';
    organizationName?: string;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { accessToken, refreshToken } = getStoredTokens();
    if (!accessToken && !refreshToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ user: UserProfile }>('/api/auth/me');
      setUser(data.user);
    } catch {
      clearStoredTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: UserProfile;
    }>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    setStoredTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      role: 'attendee' | 'organizer';
      organizationName?: string;
    }) => {
      const data = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: UserProfile;
      }>('/api/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(input),
      });
      setStoredTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return data.user;
    },
    []
  );

  const logout = useCallback(async () => {
    const { refreshToken } = getStoredTokens();
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        skipRefresh: true,
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore logout network error when clearing client tokens
    } finally {
      clearStoredTokens();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
