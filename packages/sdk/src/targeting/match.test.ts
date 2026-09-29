import { matchNumber, matchString, matchUrl } from './match';

describe('matchString', () => {
  it('compares ignoring case', () => {
    expect(matchString('GB', { op: 'is', value: 'gb' })).toBe(true);
    expect(matchString('Summer-Sale', { op: 'contains', value: 'sale' })).toBe(true);
    expect(matchString('google', { op: 'starts_with', value: 'GOO' })).toBe(true);
    expect(matchString('newsletter', { op: 'ends_with', value: 'LETTER' })).toBe(true);
  });

  it('matches any entry of a list', () => {
    expect(matchString('FR', { op: 'is', value: ['GB', 'FR'] })).toBe(true);
    expect(matchString('DE', { op: 'is', value: ['GB', 'FR'] })).toBe(false);
  });

  it('negative operators match only when no entry matches', () => {
    expect(matchString('DE', { op: 'is_not', value: ['GB', 'FR'] })).toBe(true);
    expect(matchString('FR', { op: 'is_not', value: ['GB', 'FR'] })).toBe(false);
    expect(matchString('spring', { op: 'not_contains', value: 'sale' })).toBe(true);
  });

  it('treats a missing value as matching only negative operators', () => {
    expect(matchString(undefined, { op: 'is', value: 'x' })).toBe(false);
    expect(matchString(undefined, { op: 'contains', value: 'x' })).toBe(false);
    expect(matchString(undefined, { op: 'is_not', value: 'x' })).toBe(true);
    expect(matchString(undefined, { op: 'not_contains', value: 'x' })).toBe(true);
  });

  it('handles exists and not_exists', () => {
    expect(matchString('1', { op: 'exists' })).toBe(true);
    expect(matchString('', { op: 'exists' })).toBe(false);
    expect(matchString(undefined, { op: 'exists' })).toBe(false);
    expect(matchString(undefined, { op: 'not_exists' })).toBe(true);
  });

  it('uses regex as written and ignores invalid patterns', () => {
    expect(matchString('plan_pro_2026', { op: 'regex', value: '^plan_(pro|team)_' })).toBe(true);
    expect(matchString('PLAN_PRO', { op: 'regex', value: '^plan_pro' })).toBe(false);
    expect(matchString('x', { op: 'regex', value: '(' })).toBe(false);
  });
});

describe('matchNumber', () => {
  it('applies each operator', () => {
    expect(matchNumber(3, { op: 'eq', value: 3 })).toBe(true);
    expect(matchNumber(3, { op: 'neq', value: 3 })).toBe(false);
    expect(matchNumber(3, { op: 'gt', value: 2 })).toBe(true);
    expect(matchNumber(3, { op: 'gte', value: 3 })).toBe(true);
    expect(matchNumber(3, { op: 'lt', value: 3 })).toBe(false);
    expect(matchNumber(3, { op: 'lte', value: 3 })).toBe(true);
  });

  it('never matches missing or non-finite values', () => {
    expect(matchNumber(undefined, { op: 'neq', value: 1 })).toBe(false);
    expect(matchNumber(NaN, { op: 'neq', value: 1 })).toBe(false);
    expect(matchNumber(1, { op: 'lt', value: NaN })).toBe(false);
  });
});

describe('matchUrl', () => {
  const url = 'https://mytrips.dev/trips/lisbon/?ref=home#top';

  it('is: compares the path when the value starts with "/"', () => {
    expect(matchUrl(url, { op: 'is', value: '/trips/lisbon' })).toBe(true);
    expect(matchUrl(url, { op: 'is', value: '/trips/lisbon/' })).toBe(true);
    expect(matchUrl(url, { op: 'is', value: '/trips' })).toBe(false);
  });

  it('is: includes the query only when the rule has one', () => {
    expect(matchUrl(url, { op: 'is', value: '/trips/lisbon/?ref=home' })).toBe(true);
    expect(matchUrl(url, { op: 'is', value: '/trips/lisbon/?ref=ads' })).toBe(false);
  });

  it('is: compares the full URL for absolute values, ignoring host case', () => {
    expect(matchUrl(url, { op: 'is', value: 'https://MyTrips.dev/trips/lisbon' })).toBe(true);
    expect(matchUrl(url, { op: 'is', value: 'https://staging.mytrips.dev/trips/lisbon' })).toBe(
      false,
    );
  });

  it('matches: supports * wildcards', () => {
    expect(matchUrl(url, { op: 'matches', value: '/trips/*' })).toBe(true);
    expect(matchUrl('https://mytrips.dev/trips', { op: 'matches', value: '/trips/*' })).toBe(false);
    expect(matchUrl(url, { op: 'matches', value: '/*/lisbon' })).toBe(true);
    expect(matchUrl(url, { op: 'matches', value: 'https://*.dev/trips/*' })).toBe(true);
    expect(matchUrl(url, { op: 'matches', value: '/checkout/*' })).toBe(false);
  });

  it('matches: treats regex characters in the pattern literally', () => {
    expect(matchUrl('https://a.dev/p.html', { op: 'matches', value: '/p.html' })).toBe(true);
    expect(matchUrl('https://a.dev/pXhtml', { op: 'matches', value: '/p.html' })).toBe(false);
  });

  it('contains and regex test the full URL without the hash', () => {
    expect(matchUrl(url, { op: 'contains', value: 'ref=home' })).toBe(true);
    expect(matchUrl(url, { op: 'contains', value: '#top' })).toBe(false);
    expect(matchUrl(url, { op: 'regex', value: '/trips/[a-z]+/' })).toBe(true);
    expect(matchUrl(url, { op: 'regex', value: '[' })).toBe(false);
  });

  it('never matches an invalid URL', () => {
    expect(matchUrl('not a url', { op: 'contains', value: 'url' })).toBe(false);
  });
});
