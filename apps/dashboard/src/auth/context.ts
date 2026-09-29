import { createContext, useContext } from 'react';
import type { AuthApi, AuthUser } from './api';

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedIn'; user: AuthUser }
  | { status: 'signedOut'; user: null };

export const AuthContext = createContext<{ state: AuthState; api: AuthApi } | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
