// Visitor country for targeting (PRODUCT_SPEC §4). Supabase Edge Functions don't get a
// country header, so the config endpoint asks a free lookup service (api.country.is),
// and only when a live experiment has a country condition. The IP is sent to that
// service and not stored (decision #23).

const LOOKUP = 'https://api.country.is/';
const TIMEOUT_MS = 800;
const CACHE_MS = 60 * 60 * 1000;
const CACHE_MAX = 5000;
const COUNTRY = /^[A-Z]{2}$/;

const cache = new Map<string, { country: string | undefined; at: number }>();

/** The client's IP from the proxy headers, or '' when unknown. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || headers.get('x-real-ip')?.trim() || '';
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : '';
}

/** Does any live experiment target by country? (Only then is a lookup worth it.) */
export function usesCountry(config: unknown): boolean {
  return JSON.stringify(config).includes('"type":"country"');
}

/**
 * ISO 3166-1 alpha-2 country for an IP, or undefined when unknown, slow or failing:
 * targeting then treats the country as unknown instead of delaying the page.
 */
export async function lookupCountry(
  ip: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<string | undefined> {
  if (!ip) return undefined;
  const hit = cache.get(ip);
  if (hit && now - hit.at < CACHE_MS) return hit.country;
  let country: string | undefined;
  try {
    const res = await fetcher(LOOKUP + encodeURIComponent(ip), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const body = (await res.json()) as { country?: unknown };
      if (typeof body.country === 'string' && COUNTRY.test(body.country)) country = body.country;
    }
  } catch {
    // Timeout or network error: no country this time.
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(ip, { country, at: now });
  return country;
}

export function clearCountryCache(): void {
  cache.clear();
}
