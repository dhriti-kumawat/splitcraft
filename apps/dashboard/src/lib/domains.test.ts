import { isValidAllowedDomain, isValidMainDomain, normalizeDomain } from './domains';

describe('normalizeDomain', () => {
  it.each([
    ['larkspurtravel.com', 'larkspurtravel.com'],
    ['  https://www.LarkspurTravel.com/trips?x=1#top ', 'www.larkspurtravel.com'],
    ['http://localhost:5173/', 'localhost:5173'],
    ['shop.example.com.', 'shop.example.com'],
    ['*.Vercel.app', '*.vercel.app'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });
});

describe('isValidMainDomain', () => {
  it.each([
    'larkspurtravel.com',
    'staging.larkspurtravel.com',
    'localhost',
    'localhost:3000',
    'a-b.co.uk',
  ])('accepts %s', (d) => expect(isValidMainDomain(d)).toBe(true));
  it.each([
    '',
    'mytrips',
    '*.larkspurtravel.com',
    '-bad.dev',
    'my trips.dev',
    'larkspurtravel.com:abc',
    'a:1:2',
  ])('rejects %s', (d) => expect(isValidMainDomain(d)).toBe(false));
});

describe('isValidAllowedDomain', () => {
  it('also accepts subdomain wildcards', () => {
    expect(isValidAllowedDomain('*.vercel.app')).toBe(true);
    expect(isValidAllowedDomain('*.localhost')).toBe(false);
    expect(isValidAllowedDomain('*')).toBe(false);
    expect(isValidAllowedDomain('localhost:5173')).toBe(true);
  });
});
