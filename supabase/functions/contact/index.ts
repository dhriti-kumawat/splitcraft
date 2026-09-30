// POST /functions/v1/contact — a question from the marketing site's contact form.
import { supabase } from '../_shared/client.ts';
import { clientIp, MAX_CONTACT_BYTES, parseContact, senderHash } from '../_shared/contact.ts';
import { empty, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return empty(204);
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_CONTACT_BYTES)
    return json({ error: 'message too long' }, 413);

  const form = parseContact(await req.text());
  // Spam gets a normal-looking answer, so bots learn nothing.
  if (!form.ok) return form.spam ? json({ ok: true }) : json({ error: form.error }, 400);

  const sender = await senderHash(
    clientIp(req.headers),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await supabase.rpc('submit_contact_message', {
    p_email: form.email,
    p_message: form.message,
    p_sender: sender,
  });
  if (error) {
    console.error('submit_contact_message failed', error);
    return json({ error: 'Could not send your message. Please try again later.' }, 500);
  }
  if (data === -1 || data === -2)
    return json({ error: 'Too many messages. Please try again in an hour.' }, 429);
  return json({ ok: true });
});
