// POST /functions/v1/contact — a question from the marketing site's contact form, or an access
// request from /request-access/. Stores it, then emails the owner (and confirms access requests).
import { supabase } from '../_shared/client.ts';
import { clientIp, MAX_CONTACT_BYTES, parseContact, senderHash } from '../_shared/contact.ts';
import { empty, json } from '../_shared/http.ts';
import { mailsFor, sendMail, type MailEnv } from '../_shared/mail.ts';

const ACCESS_PREFIX = 'Access request';

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
  // Has this address asked for access in the last day? Then don't send the confirmation again,
  // so the form can't be used to fill someone's inbox.
  let firstRequest = false;
  if (form.kind === 'access') {
    const { count } = await supabase
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .eq('email', form.email.toLowerCase())
      .like('message', `${ACCESS_PREFIX}%`)
      .gt('created_at', new Date(Date.now() - 86_400_000).toISOString());
    firstRequest = count === 0;
  }

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

  // Stored; now the emails. They never fail the form (sendMail logs and returns false).
  const env: MailEnv = {
    RESEND_API_KEY: Deno.env.get('RESEND_API_KEY'),
    NOTIFY_EMAIL: Deno.env.get('NOTIFY_EMAIL'),
    MAIL_FROM: Deno.env.get('MAIL_FROM'),
  };
  await Promise.all(
    mailsFor(form.kind, form.email, form.message, env, firstRequest).map((m) => sendMail(m, env)),
  );
  return json({ ok: true });
});
