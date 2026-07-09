import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type AuthUser } from '../api/client';

type AuthContextValue = {
  user: AuthUser | null;
  permissions: Set<string>;
  loading: boolean;
  login: (login: string, password: string) => Promise<AuthUser>;
  loginAsGuest: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (keys: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((u: AuthUser | null, perms: string[]) => {
    setUser(u);
    setPermissions(new Set(perms));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api.auth.me();
      applySession(r.user, r.permissions);
    } catch {
      applySession(null, []);
    }
  }, [applySession]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => applySession(null, []);
    window.addEventListener('capacity:unauthorized', onUnauthorized);
    return () => window.removeEventListener('capacity:unauthorized', onUnauthorized);
  }, [applySession]);

  const login = useCallback(
    async (loginId: string, password: string) => {
      const r = await api.auth.login({ login: loginId, password });
      applySession(r.user, r.permissions);
      return r.user;
    },
    [applySession]
  );

  const loginAsGuest = useCallback(async () => {
    const r = await api.auth.guestLogin();
    applySession(r.user, r.permissions);
    return r.user;
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      applySession(null, []);
    }
  }, [applySession]);

  const hasPermission = useCallback((key: string) => permissions.has(key), [permissions]);
  const hasAnyPermission = useCallback((keys: string[]) => keys.some((k) => permissions.has(k)), [permissions]);

  const value = useMemo(
    () => ({ user, permissions, loading, login, loginAsGuest, logout, refresh, hasPermission, hasAnyPermission }),
    [user, permissions, loading, login, loginAsGuest, logout, refresh, hasPermission, hasAnyPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth: brak AuthProvider');
  return ctx;
}
