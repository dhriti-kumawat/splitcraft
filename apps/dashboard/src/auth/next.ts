/** Only allow same-app paths as a redirect target, never another site. */
export function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/projects';
}
