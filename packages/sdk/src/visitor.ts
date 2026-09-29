export const VISITOR_COOKIE = 'splitly_vid';
export const VISITOR_STORAGE_KEY = 'splitly_vid';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const VALID_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Return this browser's visitor id, creating one on first visit.
 *
 * The cookie is the primary store; localStorage mirrors it and is the
 * fallback when cookies are blocked or cleared. Every call refreshes both,
 * so the cookie's one-year expiry rolls forward on each visit.
 */
export function getVisitorId(): string {
  const id = readCookie(VISITOR_COOKIE) ?? readStorage(VISITOR_STORAGE_KEY) ?? createVisitorId();
  writeCookie(VISITOR_COOKIE, id, ONE_YEAR_SECONDS);
  writeStorage(VISITOR_STORAGE_KEY, id);
  return id;
}

export function createVisitorId(): string {
  const bytes = new Uint8Array(12);
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return `v_${hex}`;
}

function readCookie(name: string): string | null {
  try {
    for (const part of document.cookie.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      return VALID_ID.test(value) ? value : null;
    }
  } catch {
    // Cookie access can throw in sandboxed iframes.
  }
  return null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookies blocked; localStorage still holds the id.
  }
}

function readStorage(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    return value !== null && VALID_ID.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full, disabled or private mode.
  }
}
