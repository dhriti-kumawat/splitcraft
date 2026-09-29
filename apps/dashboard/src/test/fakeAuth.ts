import { MESSAGES, type AuthApi, type AuthUser } from '../auth/api';

export const DHRITI: AuthUser = { id: 'u_1', email: 'dhriti@mytrips.dev', name: 'Dhriti Kumawat' };
export const PASSWORD = 'Tripdemo1';

/** In-memory AuthApi: one known account, everything else behaves like Supabase would. */
export function fakeAuth(opts: { signedIn?: boolean; confirmSignUps?: boolean } = {}) {
  let user: AuthUser | null = opts.signedIn ? DHRITI : null;
  const listeners = new Set<(u: AuthUser | null) => void>();
  const set = (u: AuthUser | null) => {
    user = u;
    for (const fn of listeners) fn(u);
  };
  const calls: string[] = [];

  const api: AuthApi = {
    getUser: async () => user,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async signIn(email, password, keep) {
      calls.push(`signIn:${email}:${keep}`);
      if (email !== DHRITI.email || password !== PASSWORD) {
        return { ok: false, error: MESSAGES.invalidLogin };
      }
      set(DHRITI);
      return { ok: true };
    },
    async signUp(name, email) {
      calls.push(`signUp:${name}:${email}`);
      if (opts.confirmSignUps) return { ok: true, needsConfirmation: true };
      set({ id: 'u_new', email, name });
      return { ok: true, needsConfirmation: false };
    },
    async sendPasswordReset(email) {
      calls.push(`reset:${email}`);
      return { ok: true };
    },
    async updatePassword() {
      calls.push('updatePassword');
      return { ok: true };
    },
    async signInWithProvider(provider) {
      calls.push(`oauth:${provider}`);
      return {
        ok: false,
        error: MESSAGES.providerOff(provider === 'google' ? 'Google' : 'GitHub'),
      };
    },
    async signOut() {
      calls.push('signOut');
      set(null);
    },
  };
  return { api, calls };
}
