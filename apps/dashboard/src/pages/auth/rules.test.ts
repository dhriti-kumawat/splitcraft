import { passwordRules, strength, validate } from './rules';

const empty = { name: '', email: '', password: '', terms: false };

describe('validate', () => {
  it('uses the spec messages for login', () => {
    expect(validate('login', empty)).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
    expect(validate('login', { ...empty, email: 'maya@site', password: 'x' })).toEqual({
      email: 'This email is missing something. Check for typos.',
    });
    expect(validate('login', { ...empty, email: ' maya@site.dev ', password: 'x' })).toEqual({});
  });

  it('checks name, password rules and terms for sign-up', () => {
    expect(validate('signup', { ...empty, email: 'a@b.co', password: 'short' })).toEqual({
      name: 'Enter your full name.',
      password: 'Use 8+ characters with a number and upper and lower case.',
      terms: 'Accept the terms to create your workspace.',
    });
    expect(
      validate('signup', { name: 'Alex', email: 'a@b.co', password: 'Tripdemo1', terms: true }),
    ).toEqual({});
  });

  it('only needs the email to reset, and only the password to set a new one', () => {
    expect(validate('forgot', { ...empty, email: 'a@b.co' })).toEqual({});
    expect(validate('reset', { ...empty, password: 'Tripdemo1' })).toEqual({});
    expect(validate('reset', { ...empty, password: 'tripdemo' })).toHaveProperty('password');
  });
});

describe('password strength', () => {
  it('counts the four rules, symbol optional', () => {
    expect(strength('')).toBe(0);
    expect(strength('abcdefgh')).toBe(1);
    expect(strength('abcdefg1')).toBe(2);
    expect(strength('Abcdefg1')).toBe(3);
    expect(strength('Abcdefg1!')).toBe(4);
    expect(passwordRules('a!').map((r) => r.ok)).toEqual([false, false, false, true]);
  });
});
