// POST /functions/v1/events — batches from the SDK (sendBeacon or fetch, text/plain JSON).
import { supabase } from '../_shared/client.ts';
import { hostFromOrigin, MAX_BODY_BYTES, parseBatch } from '../_shared/events.ts';
import { empty, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return empty(204);
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return json({ error: 'body too large' }, 413);

  const batch = parseBatch(await req.text());
  if (!batch.ok) return json({ error: batch.error }, 400);
  if (batch.events.length === 0) return empty(204);

  const { data, error } = await supabase.rpc('ingest_events', {
    p_public_key: batch.projectKey,
    p_host: hostFromOrigin(req.headers.get('origin')),
    p_events: batch.events,
  });
  if (error) {
    console.error('ingest_events failed', error);
    return json({ error: 'could not store events' }, 500);
  }
  if (data === -1) return json({ error: 'unknown project' }, 404);
  if (data === -2) return json({ error: 'origin not allowed for this project' }, 403);
  if (data === -3) return json({ error: 'monthly event limit reached' }, 429);
  if (data === -4)
    return json({ error: 'too many events, slow down' }, 429, { 'retry-after': '60' });
  return empty(204);
});
