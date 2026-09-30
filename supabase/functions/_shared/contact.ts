// Validation for the marketing site's contact form (POST /functions/v1/contact).

export const MAX_CONTACT_BYTES = 8 * 1024;
export const MAX_MESSAGE = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Humans take longer than this to type a question; bots post at once. */
export const MIN_FILL_MS = 2000;

export type ParsedContact =
  { ok: true; email: string; message: string } | { ok: false; error: string; spam?: true };

/**
 * `{ email, message, website, elapsedMs }`. `website` is a hidden field people never fill
 * in; a filled one, or a form sent within two seconds of loading, is treated as spam.
 */
export function parseContact(body: string): ParsedContact {
  if (body.length > MAX_CONTACT_BYTES) return { ok: false, error: 'message too long' };
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return { ok: false, error: 'invalid form' };
  const { email, message, website, elapsedMs } = data as Record<string, unknown>;
  if (typeof website === 'string' && website.trim())
    return { ok: false, error: 'spam', spam: true };
  if (typeof elapsedMs === 'number' && elapsedMs < MIN_FILL_MS)
    return { ok: false, error: 'spam', spam: true };
  const e = typeof email === 'string' ? email.trim() : '';
  const m = typeof message === 'string' ? message.trim() : '';
  if (!e || e.length > 254 || !EMAIL.test(e))
    return { ok: false, error: 'Enter a valid email address.' };
  if (!m) return { ok: false, error: 'Write your question.' };
  if (m.length > MAX_MESSAGE)
    return { ok: false, error: `Keep it under ${MAX_MESSAGE} characters.` };
  return { ok: true, email: e, message: m };
}

/** HMAC-SHA-256 of the sender's IP, hex. Keeps the IP itself out of the database. */
export async function senderHash(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The client IP from the proxy headers Supabase sets. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  );
}
