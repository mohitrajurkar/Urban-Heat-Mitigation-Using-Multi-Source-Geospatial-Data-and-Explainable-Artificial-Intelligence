import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, TOKEN_KEY, USER_KEY } from '../services/api';
import type { LoginResponse, Role, User } from '../types';

interface AuthCtx {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: Role[]) => boolean;
  canEdit: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw && localStorage.getItem(TOKEN_KEY) ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUser);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { username, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(data));
    setUser(data);
  }, []);

  const value = useMemo<AuthCtx>(() => {
    const can = (...roles: Role[]) => !!user && roles.includes(user.role);
    return { user, login, logout, can, canEdit: can('ADMIN', 'ANALYST'), isAdmin: can('ADMIN'), refreshUser };
  }, [user, login, logout, refreshUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
