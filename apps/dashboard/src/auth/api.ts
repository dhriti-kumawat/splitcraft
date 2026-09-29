export interface AuthUser {
  id: string;
  email: string;
  /** Full name from sign-up, or the part of the email before @. */
  name: string;
}

export type Provider = 'google' | 'github';

export type AuthResult = { ok: true } | { ok: false; error: string };
export type SignUpResult = { ok: true; needsConfirmation: boolean } | { ok: false; error: string };

/** Everything the dashboard needs from auth. Supabase implements it; tests use a fake. */
export interface AuthApi {
  getUser(): Promise<AuthUser | null>;
  onChange(fn: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string, keepLoggedIn: boolean): Promise<AuthResult>;
  signUp(name: string, email: string, password: string): Promise<SignUpResult>;
  sendPasswordReset(email: string): Promise<AuthResult>;
  updatePassword(password: string): Promise<AuthResult>;
  signInWithProvider(provider: Provider): Promise<AuthResult>;
  signOut(): Promise<void>;
}

// Messages from PRODUCT_SPEC §8, plus the cases Supabase can return.
export const MESSAGES = {
  invalidLogin: 'Email or password is incorrect. Try again or reset your password.',
  notConfirmed: 'Confirm your email first. Check your inbox for the link we sent.',
  weakPassword: 'Use 8+ characters with a number and upper and lower case.',
  rateLimited: 'Too many attempts. Wait a minute and try again.',
  providerOff: (provider: string) => `${provider} sign-in isn't set up yet. Use email for now.`,
  sso: "Single sign-on isn't available yet. Use email or another option.",
  offline: "Can't reach Splitcraft. Check your connection and try again.",
  unknown: 'Something went wrong. Try again.',
} as const;
