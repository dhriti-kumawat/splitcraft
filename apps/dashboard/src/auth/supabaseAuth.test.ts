import { AuthError, type User } from '@supabase/supabase-js';
import { MESSAGES } from './api';
import { messageFor, toAuthUser } from './supabaseAuth';

const authError = (message: string, code?: string) => {
  const e = new AuthError(message, 400, code);
  return e;
};

describe('messageFor', () => {
  it.each([
    [authError('Invalid login credentials', 'invalid_credentials'), MESSAGES.invalidLogin],
    [authError('Invalid login credentials'), MESSAGES.invalidLogin],
    [authError('Email not confirmed', 'email_not_confirmed'), MESSAGES.notConfirmed],
    [authError('Password is too weak', 'weak_password'), MESSAGES.weakPassword],
    [authError('Too many', 'over_email_send_rate_limit'), MESSAGES.rateLimited],
    [new Error('Failed to fetch'), MESSAGES.offline],
    [authError('Something odd', 'unexpected_failure'), MESSAGES.unknown],
  ])('%s', (error, expected) => {
    expect(messageFor(error)).toBe(expected);
  });
});

describe('toAuthUser', () => {
  const base = { id: 'u1', email: 'alex@mytrips.dev', user_metadata: {} } as unknown as User;

  it('uses the full name from sign-up', () => {
    expect(toAuthUser({ ...base, user_metadata: { full_name: ' Alex Morgan ' } })).toEqual({
      id: 'u1',
      email: 'alex@mytrips.dev',
      name: 'Alex Morgan',
    });
  });

  it('falls back to the email name', () => {
    expect(toAuthUser(base)?.name).toBe('alex');
  });

  it('returns null without a user', () => {
    expect(toAuthUser(null)).toBeNull();
  });
});
