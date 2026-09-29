// Validation from PRODUCT_SPEC §8 and design/screens/01-auth-desktop.html.

export type Mode = 'login' | 'signup' | 'forgot' | 'reset';

export interface Fields {
  name: string;
  email: string;
  password: string;
  terms: boolean;
}

export type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'terms', string>>;

export function passwordRules(pw: string) {
  return [
    { label: '8+ characters', ok: pw.length >= 8 },
    { label: 'A number', ok: /\d/.test(pw) },
    { label: 'Upper and lower case', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: 'A symbol (optional)', ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export const STRENGTH = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;

export function strength(pw: string): number {
  return passwordRules(pw).filter((r) => r.ok).length;
}

function strongEnough(pw: string): boolean {
  const [length, number, cases] = passwordRules(pw);
  return Boolean(length?.ok && number?.ok && cases?.ok);
}

export function validate(mode: Mode, f: Fields): FieldErrors {
  const errors: FieldErrors = {};
  const email = f.email.trim();
  if (mode === 'signup' && f.name.trim().length < 2) errors.name = 'Enter your full name.';
  if (mode !== 'reset') {
    if (!email) errors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errors.email = 'This email is missing something. Check for typos.';
    }
  }
  if (mode === 'login' && !f.password) errors.password = 'Enter your password.';
  if (mode === 'signup' || mode === 'reset') {
    if (!strongEnough(f.password)) {
      errors.password = 'Use 8+ characters with a number and upper and lower case.';
    }
  }
  if (mode === 'signup' && !f.terms) errors.terms = 'Accept the terms to create your workspace.';
  return errors;
}
