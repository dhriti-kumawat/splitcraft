import { createVisitorId, getVisitorId, VISITOR_COOKIE, VISITOR_STORAGE_KEY } from './visitor';

/** Minimal cookie jar: stores name=value and the attributes of the last write. */
function fakeDocument(opts: { blocked?: boolean } = {}) {
  const jar = new Map<string, string>();
  let lastWrite = '';
  return {
    get lastWrite() {
      return lastWrite;
    },
    jar,
    get cookie() {
      if (opts.blocked) throw new Error('SecurityError');
      return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set cookie(raw: string) {
      if (opts.blocked) throw new Error('SecurityError');
      lastWrite = raw;
      const [pair = ''] = raw.split(';');
      const eq = pair.indexOf('=');
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    },
  };
}

function fakeStorage(opts: { blocked?: boolean } = {}) {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key: string) {
      if (opts.blocked) throw new Error('SecurityError');
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (opts.blocked) throw new Error('SecurityError');
      store.set(key, value);
    },
  };
}

function setup(opts: { cookiesBlocked?: boolean; storageBlocked?: boolean; https?: boolean } = {}) {
  const doc = fakeDocument({ blocked: opts.cookiesBlocked });
  const storage = fakeStorage({ blocked: opts.storageBlocked });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('location', { protocol: opts.https === false ? 'http:' : 'https:' });
  return { doc, storage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createVisitorId', () => {
  it('creates a prefixed 24-char hex id', () => {
    expect(createVisitorId()).toMatch(/^v_[0-9a-f]{24}$/);
  });

  it('creates unique ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, createVisitorId));
    expect(ids.size).toBe(1000);
  });
});

describe('getVisitorId', () => {
  it('creates an id on first visit and stores it in cookie and localStorage', () => {
    const { doc, storage } = setup();
    const id = getVisitorId();
    expect(id).toMatch(/^v_[0-9a-f]{24}$/);
    expect(doc.jar.get(VISITOR_COOKIE)).toBe(id);
    expect(storage.store.get(VISITOR_STORAGE_KEY)).toBe(id);
  });

  it('returns the same id on later calls', () => {
    setup();
    expect(getVisitorId()).toBe(getVisitorId());
  });

  it('writes a one-year, site-wide, SameSite=Lax cookie', () => {
    const { doc } = setup();
    getVisitorId();
    expect(doc.lastWrite).toContain('Max-Age=31536000');
    expect(doc.lastWrite).toContain('Path=/');
    expect(doc.lastWrite).toContain('SameSite=Lax');
    expect(doc.lastWrite).toContain('Secure');
  });

  it('omits Secure on plain http so localhost still works', () => {
    const { doc } = setup({ https: false });
    getVisitorId();
    expect(doc.lastWrite).not.toContain('Secure');
  });

  it('prefers the cookie over localStorage', () => {
    const { doc, storage } = setup();
    doc.jar.set(VISITOR_COOKIE, 'v_cookie_id_123');
    storage.store.set(VISITOR_STORAGE_KEY, 'v_storage_id_456');
    expect(getVisitorId()).toBe('v_cookie_id_123');
    expect(storage.store.get(VISITOR_STORAGE_KEY)).toBe('v_cookie_id_123');
  });

  it('restores the cookie from localStorage when the cookie was cleared', () => {
    const { doc, storage } = setup();
    storage.store.set(VISITOR_STORAGE_KEY, 'v_storage_id_456');
    expect(getVisitorId()).toBe('v_storage_id_456');
    expect(doc.jar.get(VISITOR_COOKIE)).toBe('v_storage_id_456');
  });

  it('falls back to localStorage when cookies are blocked', () => {
    const { storage } = setup({ cookiesBlocked: true });
    const id = getVisitorId();
    expect(storage.store.get(VISITOR_STORAGE_KEY)).toBe(id);
    expect(getVisitorId()).toBe(id);
  });

  it('still works with cookies only when localStorage is blocked', () => {
    setup({ storageBlocked: true });
    expect(getVisitorId()).toBe(getVisitorId());
  });

  it('returns a fresh id each call when all storage is blocked', () => {
    setup({ cookiesBlocked: true, storageBlocked: true });
    expect(getVisitorId()).toMatch(/^v_[0-9a-f]{24}$/);
  });

  it('ignores malformed stored values', () => {
    const { doc } = setup();
    doc.jar.set(VISITOR_COOKIE, encodeURIComponent('<script>'));
    const id = getVisitorId();
    expect(id).toMatch(/^v_[0-9a-f]{24}$/);
    expect(doc.jar.get(VISITOR_COOKIE)).toBe(id);
  });

  it('reads the right cookie among others', () => {
    const { doc } = setup();
    doc.jar.set('other', 'x');
    doc.jar.set(`${VISITOR_COOKIE}_old`, 'v_wrong_cookie');
    doc.jar.set(VISITOR_COOKIE, 'v_right_cookie');
    expect(getVisitorId()).toBe('v_right_cookie');
  });
});
