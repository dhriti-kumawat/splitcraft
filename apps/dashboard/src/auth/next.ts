/** Only allow same-app paths as a redirect target, never another site. */
export function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/projects';
}

/**
 * The reason a GitHub or Google login failed, if Supabase sent the browser back with one.
 * Supabase puts it in the query or, for the implicit flow, in the hash.
 */
export function oauthError(search: string, hash: string): string | null {
  for (const raw of [search, hash.replace(/^#/, '?')]) {
    const params = new URLSearchParams(raw);
    const message = params.get('error_description') ?? params.get('error');
    if (message) return message.slice(0, 300);
  }
  return null;
}
