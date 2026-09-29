import {
  createClient,
  type AuthError,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { MESSAGES, type AuthApi, type AuthUser } from './api';

const KEEP_KEY = 'splitcraft_keep_logged_in';

/**
 * Session storage that follows "Keep me logged in": localStorage survives closing the
 * browser, sessionStorage does not. The choice is made at log-in and remembered.
 */
const sessionStore = {
  current(): Storage {
    return localStorage.getItem(KEEP_KEY) === '0' ? sessionStorage : localStorage;
  },
  getItem: (key: string) => sessionStore.current().getItem(key),
  setItem: (key: string, value: string) => sessionStore.current().setItem(key, value),
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;
  const email = user.email ?? '';
  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  return { id: user.id, email, name: fullName.trim() || email.split('@')[0] || 'there' };
}

export function messageFor(error: AuthError | Error): string {
  const code = 'code' in error ? (error.code as string | undefined) : undefined;
  const text = error.message.toLowerCase();
  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return MESSAGES.invalidLogin;
  }
  if (code === 'email_not_confirmed') return MESSAGES.notConfirmed;
  if (code === 'weak_password') return MESSAGES.weakPassword;
  if (code?.startsWith('over_') || text.includes('rate limit')) return MESSAGES.rateLimited;
  if (text.includes('failed to fetch') || text.includes('network')) return MESSAGES.offline;
  return MESSAGES.unknown;
}

/** One client for auth and data, with the "keep me logged in" session storage. */
export function createSupabase(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { storage: sessionStore, persistSession: true, autoRefreshToken: true },
  });
}

export function createSupabaseAuth(supabase: SupabaseClient): AuthApi {
  const origin = window.location.origin;

  return {
    async getUser() {
      const { data } = await supabase.auth.getSession();
      return toAuthUser(data.session?.user);
    },
    onChange(fn) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) =>
        fn(toAuthUser(session?.user)),
      );
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password, keepLoggedIn) {
      localStorage.setItem(KEEP_KEY, keepLoggedIn ? '1' : '0');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { ok: false, error: messageFor(error) } : { ok: true };
    },
    async signUp(name, email, password) {
      localStorage.setItem(KEEP_KEY, '1');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: `${origin}/projects` },
      });
      if (error) return { ok: false, error: messageFor(error) };
      // No session means Supabase wants the email confirmed first. (It also returns no
      // session for an existing address, so the screen never reveals who has an account.)
      return { ok: true, needsConfirmation: !data.session };
    },
    async sendPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });
      return error ? { ok: false, error: messageFor(error) } : { ok: true };
    },
    async sendLoginLink(email, next) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: `${origin}${next}` },
      });
      // An unknown address fails with "Signups not allowed for otp"; answer as if sent, so
      // the screen never reveals who has an account (same as sign-up and password reset).
      if (error && !/signups? not allowed/i.test(error.message)) {
        return { ok: false, error: messageFor(error) };
      }
      return { ok: true };
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      return error ? { ok: false, error: messageFor(error) } : { ok: true };
    },
    async signInWithProvider(provider) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${origin}/projects` },
      });
      if (!error) return { ok: true };
      const label = provider === 'google' ? 'Google' : 'GitHub';
      return {
        ok: false,
        error: error.message.toLowerCase().includes('not enabled')
          ? MESSAGES.providerOff(label)
          : messageFor(error),
      };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };
}
