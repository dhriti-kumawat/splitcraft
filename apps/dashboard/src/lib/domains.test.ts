import { isValidAllowedDomain, isValidMainDomain, normalizeDomain } from './domains';

describe('normalizeDomain', () => {
  it.each([
    ['mytrips.dev', 'mytrips.dev'],
    ['  https://www.MyTrips.dev/trips?x=1#top ', 'www.mytrips.dev'],
    ['http://localhost:5173/', 'localhost:5173'],
    ['shop.example.com.', 'shop.example.com'],
    ['*.Vercel.app', '*.vercel.app'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });
});

describe('isValidMainDomain', () => {
  it.each(['mytrips.dev', 'staging.mytrips.dev', 'localhost', 'localhost:3000', 'a-b.co.uk'])(
    'accepts %s',
    (d) => expect(isValidMainDomain(d)).toBe(true),
  );
  it.each(['', 'mytrips', '*.mytrips.dev', '-bad.dev', 'my trips.dev', 'mytrips.dev:abc', 'a:1:2'])(
    'rejects %s',
    (d) => expect(isValidMainDomain(d)).toBe(false),
  );
});

describe('isValidAllowedDomain', () => {
  it('also accepts subdomain wildcards', () => {
    expect(isValidAllowedDomain('*.vercel.app')).toBe(true);
    expect(isValidAllowedDomain('*.localhost')).toBe(false);
    expect(isValidAllowedDomain('*')).toBe(false);
    expect(isValidAllowedDomain('localhost:5173')).toBe(true);
  });
});
