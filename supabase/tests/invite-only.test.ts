import { as, createDb, type Db } from './db';

let db: Db;

beforeAll(async () => {
  db = await createDb({ inviteOnly: true });
});

afterAll(async () => {
  await db.close();
});

describe('invite-only accounts', () => {
  it('creates an account only for an email on the allowlist', async () => {
    await expect(
      db.query(
        `insert into auth.users (id, email) values (gen_random_uuid(), 'stranger@shop.test')`,
      ),
    ).rejects.toThrow(/invite-only/);
    await db.query(`insert into public.allowed_emails (email) values ('friend@shop.test')`);
    // Case and spaces don't matter.
    await db.query(
      `insert into auth.users (id, email) values (gen_random_uuid(), ' Friend@Shop.test ')`,
    );
    expect((await db.query('select 1 from auth.users')).rows).toHaveLength(1);
  });

  it('keeps the list out of reach of the API', async () => {
    const who = { role: 'authenticated', userId: '00000000-0000-0000-0000-0000000aa001' } as const;
    expect((await as(db, who, () => db.query('select * from allowed_emails'))).rows).toEqual([]);
    await expect(
      as(db, { role: 'anon' }, () =>
        db.query(`insert into allowed_emails (email) values ('me@x.test')`),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
