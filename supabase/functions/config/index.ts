// GET /functions/v1/config/<public key>.json — the config the SDK fetches on every page.
// Public and cacheable: it only contains what live experiments need.
import { functionsUrl, supabase } from '../_shared/client.ts';
import { toSdkConfig } from '../_shared/config.ts';
import { clientIp, lookupCountry, usesCountry } from '../_shared/country.ts';
import { empty, json } from '../_shared/http.ts';
import type { ConfigSource } from '../_shared/types.ts';

const PUBLIC_KEY = /^prj_[0-9a-f]{32}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return empty(204);
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const key = (new URL(req.url).pathname.split('/').pop() ?? '').replace(/\.json$/, '');
  if (!PUBLIC_KEY.test(key)) return json({ error: 'unknown project' }, 404);

  const { data, error } = await supabase.rpc('sdk_config_source', { p_public_key: key });
  if (error) {
    console.error('sdk_config_source failed', error);
    return json({ error: 'config unavailable' }, 500);
  }
  if (!data) return json({ error: 'unknown project' }, 404);

  const config = toSdkConfig(data as ConfigSource, key, `${functionsUrl}/events`);
  // Country only when a live experiment targets by it (segments are resolved into the
  // targeting by now); then the response is per visitor.
  const perVisitor = usesCountry(config.experiments);
  const country = perVisitor ? await lookupCountry(clientIp(req.headers)) : undefined;
  return json(country ? { ...config, country } : config, 200, {
    // Short cache so launches and pauses reach visitors within a minute. With a country
    // in it, only the visitor's own browser may cache it.
    'cache-control': `${perVisitor ? 'private' : 'public'}, max-age=60`,
  });
});
