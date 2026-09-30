import { splitTarget } from './split';

describe('splitTarget', () => {
  it('sends the visitor to the variant URL', () => {
    expect(splitTarget('https://shop.test/pricing-b', 'https://shop.test/pricing')).toBe(
      'https://shop.test/pricing-b',
    );
  });

  it('keeps the query string and hash, with the variant URL params winning', () => {
    expect(
      splitTarget(
        'https://shop.test/b?layout=2&utm_source=x',
        'https://shop.test/a?utm_source=ad&splitcraft_force=exp:b#plans',
      ),
    ).toBe('https://shop.test/b?layout=2&utm_source=x&splitcraft_force=exp%3Ab#plans');
  });

  it('keeps the variant URL hash when it has one', () => {
    expect(splitTarget('https://shop.test/b#top', 'https://shop.test/a#plans')).toBe(
      'https://shop.test/b#top',
    );
  });

  it('returns null when already on the variant page', () => {
    expect(splitTarget('https://shop.test/b', 'https://shop.test/b?utm_source=ad')).toBeNull();
    expect(splitTarget('/b', 'https://shop.test/b')).toBeNull();
  });

  it('redirects across domains', () => {
    expect(splitTarget('https://new.shop.test/', 'https://shop.test/')).toBe(
      'https://new.shop.test/',
    );
  });
});
