import { clientIp, parseContact, senderHash } from '../functions/_shared/contact.ts';
import { as, createDb, type Db } from './db';

const form = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    email: 'ana@shop.test',
    message: 'Does it work with Vue?',
    website: '',
    elapsedMs: 9000,
    ...over,
  });

describe('parseContact', () => {
  it('accepts a question and trims it', () => {
    expect(parseContact(form({ email: '  ana@shop.test ', message: ' Hi \n' }))).toEqual({
      ok: true,
      email: 'ana@shop.test',
      message: 'Hi',
    });
  });

  it('explains what is wrong', () => {
    expect(parseContact(form({ email: 'nope' }))).toMatchObject({
      ok: false,
      error: 'Enter a valid email address.',
    });
    expect(parseContact(form({ message: '   ' }))).toMatchObject({
      ok: false,
      error: 'Write your question.',
    });
    expect(parseContact(form({ message: 'x'.repeat(2001) }))).toMatchObject({ ok: false });
    expect(parseContact('{')).toMatchObject({ ok: false, error: 'invalid JSON' });
  });

  it('flags bots: the hidden field filled, or sent too fast', () => {
    expect(parseContact(form({ website: 'http://spam.test' }))).toMatchObject({ spam: true });
    expect(parseContact(form({ elapsedMs: 300 }))).toMatchObject({ spam: true });
  });
});

describe('senderHash and clientIp', () => {
  it('hashes the IP with a secret, so the IP is not stored', async () => {
    const a = await senderHash('203.0.113.9', 'secret');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203');
    expect(await senderHash('203.0.113.9', 'secret')).toBe(a);
    expect(await senderHash('203.0.113.9', 'other')).not.toBe(a);
  });

  it('reads the first forwarded address', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe(
      '203.0.113.9',
    );
    expect(clientIp(new Headers())).toBe('unknown');
  });
});

describe('contact_messages', () => {
  let db: Db;
  const service = { role: 'service_role' } as const;
  const anon = { role: 'anon' } as const;
  const submit = (sender: string, email = 'ana@shop.test') =>
    as(
      db,
      service,
      async () =>
        (
          await db.query<{ r: number }>('select public.submit_contact_message($1, $2, $3) as r', [
            email,
            ' Question ',
            sender,
          ])
        ).rows[0]!.r,
    );

  beforeAll(async () => {
    db = await createDb();
  });
  afterAll(async () => {
    await db.close();
  });

  it('stores messages and limits each sender to 5 an hour', async () => {
    for (let i = 0; i < 5; i++) expect(await submit('sender-a', 'Ana@Shop.test')).toBe(1);
    expect(await submit('sender-a')).toBe(-1);
    expect(await submit('sender-b')).toBe(1);
    const rows = await as(
      db,
      service,
      async () =>
        (
          await db.query<{ email: string; message: string }>(
            'select email, message from contact_messages limit 1',
          )
        ).rows,
    );
    expect(rows[0]).toEqual({ email: 'ana@shop.test', message: 'Question' });
  });

  it('is closed to the public: no reading, no writing, no calling the function', async () => {
    await expect(
      as(db, anon, () =>
        db.query('select public.submit_contact_message($1, $2, $3)', ['a@b.co', 'x', 's']),
      ),
    ).rejects.toThrow();
    const seen = await as(
      db,
      anon,
      async () => (await db.query('select * from contact_messages')).rows,
    );
    expect(seen).toEqual([]);
    await expect(
      as(db, anon, () =>
        db.query(
          `insert into contact_messages (email, message, sender_hash) values ('a@b.co', 'x', 's')`,
        ),
      ),
    ).rejects.toThrow();
  });
});
