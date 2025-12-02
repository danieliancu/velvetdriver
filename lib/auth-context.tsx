'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Role, type User } from '@/types';

type AuthContextType = {
  user: User | null;
  login: (role: Role, info?: Partial<User>) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const STORAGE_KEY = 'velvet-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (role: Role, info?: Partial<User>) => {
    const fallbackName = role === Role.ADMIN ? 'Administrator' : 'Client';
    const fallbackEmail = info?.email || 'client@example.com';
    const payload: User = {
      id: info?.id,
      name: info?.name || fallbackName,
      email: fallbackEmail,
      phone: info?.phone ?? null,
      role,
    };
    setUser(payload);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as User;
        if (parsed?.email) setUser(parsed);
      }
    } catch {
      // ignore malformed data
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (!event.newValue) {
        setUser(null);
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue) as User;
        setUser(parsed);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
