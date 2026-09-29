import {
  clearCountryCache,
  clientIp,
  lookupCountry,
  usesCountry,
} from '../functions/_shared/country.ts';

const reply = (body: unknown, ok = true) =>
  vi.fn<(url: string) => Promise<Response>>(
    async () => ({ ok, json: async () => body }) as Response,
  );

beforeEach(() => clearCountryCache());

describe('clientIp', () => {
  it('takes the first forwarded address', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe(
      '203.0.113.7',
    );
    expect(clientIp(new Headers({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIp(new Headers({ 'x-forwarded-for': 'not an ip<script>' }))).toBe('');
    expect(clientIp(new Headers())).toBe('');
  });
});

describe('usesCountry', () => {
  it('spots a country condition anywhere in the targeting', () => {
    expect(usesCountry([{ targeting: { how: [{ mode: 'all', items: [] }] } }])).toBe(false);
    expect(
      usesCountry([
        {
          targeting: {
            who: [{ mode: 'any', items: [{ type: 'country', op: 'is', value: 'IN' }] }],
          },
        },
      ]),
    ).toBe(true);
  });
});

describe('lookupCountry', () => {
  it('asks the lookup service and caches the answer', async () => {
    const fetcher = reply({ ip: '203.0.113.7', country: 'IN' });
    expect(await lookupCountry('203.0.113.7', fetcher as unknown as typeof fetch)).toBe('IN');
    expect(await lookupCountry('203.0.113.7', fetcher as unknown as typeof fetch)).toBe('IN');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]![0]).toBe('https://api.country.is/203.0.113.7');
  });

  it('gives up quietly on errors, odd answers or no IP', async () => {
    expect(
      await lookupCountry('198.51.100.1', reply({}, false) as unknown as typeof fetch),
    ).toBeUndefined();
    expect(
      await lookupCountry('198.51.100.2', reply({ country: 'India' }) as unknown as typeof fetch),
    ).toBeUndefined();
    const failing = vi.fn(async () => {
      throw new Error('timeout');
    });
    expect(await lookupCountry('198.51.100.3', failing as unknown as typeof fetch)).toBeUndefined();
    const unused = reply({ country: 'IN' });
    expect(await lookupCountry('', unused as unknown as typeof fetch)).toBeUndefined();
    expect(unused).not.toHaveBeenCalled();
  });

  it('looks again after an hour', async () => {
    const fetcher = reply({ country: 'GB' });
    await lookupCountry('192.0.2.9', fetcher as unknown as typeof fetch, 0);
    await lookupCountry('192.0.2.9', fetcher as unknown as typeof fetch, 61 * 60 * 1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
