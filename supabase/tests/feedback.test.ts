import { as, createDb, type Db } from './db';

const ANA = '00000000-0000-0000-0000-0000000fb001';
const BEN = '00000000-0000-0000-0000-0000000fb002';
const ana = { role: 'authenticated', userId: ANA } as const;
const ben = { role: 'authenticated', userId: BEN } as const;

let db: Db;
let anasWs: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
const send = (who: { role: 'authenticated'; userId: string }, ...args: unknown[]) =>
  as(db, who, () =>
    q<{ n: number }>('select send_feedback($1, $2, $3, $4) as n', [
      args[0],
      args[1],
      args[2] ?? null,
      args[3] ?? null,
    ]),
  ).then((r) => r[0]!.n);

beforeAll(async () => {
  db = await createDb();
  await q(
    `insert into auth.users (id, email) values ($1, 'ana@shop.test'), ($2, 'ben@shop.test')`,
    [ANA, BEN],
  );
  [{ id: anasWs }] = (await as(db, ana, () =>
    q<{ id: string }>(`insert into workspaces (name) values ('Ana co') returning id`),
  )) as [{ id: string }];
});

afterAll(async () => {
  await db.close();
});

describe('send_feedback', () => {
  it('stores the message with the account email, the page and the workspace', async () => {
    expect(await send(ana, 'help', '  How do I add a goal?  ', '/p/x/goals', anasWs)).toBe(1);
    const [row] = await q('select * from feedback where user_id = $1', [ANA]);
    expect(row).toMatchObject({
      email: 'ana@shop.test',
      kind: 'help',
      message: 'How do I add a goal?',
      page: '/p/x/goals',
      workspace_id: anasWs,
    });
  });

  it("drops a workspace the sender isn't in, and rejects unknown kinds and empty messages", async () => {
    expect(await send(ben, 'feedback', 'Nice', null, anasWs)).toBe(1);
    const [row] = await q<{ workspace_id: string | null }>(
      'select workspace_id from feedback where user_id = $1',
      [BEN],
    );
    expect(row!.workspace_id).toBeNull();
    await expect(send(ben, 'spam', 'x')).rejects.toThrow(/check/);
    await expect(send(ben, 'help', '   ')).rejects.toThrow(/check/);
  });

  it('allows 10 an hour per account', async () => {
    for (let i = 0; i < 9; i++) expect(await send(ana, 'feedback', `idea ${i}`)).toBe(1);
    expect(await send(ana, 'feedback', 'one more')).toBe(-1);
  });

  it("can't be read or written directly, or sent without logging in", async () => {
    expect(await as(db, ana, () => q('select * from feedback'))).toEqual([]);
    await expect(
      as(db, ana, () =>
        q(
          `insert into feedback (user_id, email, kind, message) values ($1, 'a@b.c', 'help', 'x')`,
          [ANA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(db, { role: 'anon' }, () => q(`select send_feedback('help', 'x')`)),
    ).rejects.toThrow(/permission denied/);
  });
});
