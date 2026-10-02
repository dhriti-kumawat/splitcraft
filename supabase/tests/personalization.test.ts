import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000f4';
const owner = { role: 'authenticated', userId: OWNER } as const;
let db: Db;

beforeAll(async () => {
  db = await createDb();
  await createUser(db, OWNER);
});
afterAll(async () => {
  await db.close();
});

describe('personalization', () => {
  it('is a test type whose original gets no visitors in the SDK config', async () => {
    const key = await as(db, owner, async () => {
      const ws = (await db.query<{ id: string }>('select id from workspaces')).rows[0]!.id;
      const p = (
        await db.query<{ id: string; public_key: string }>(
          `insert into projects (workspace_id, name, main_domain) values ($1, 'P', 'p.dev') returning id, public_key`,
          [ws],
        )
      ).rows[0]!;
      const e = (
        await db.query<{ id: string }>(
          `insert into experiments (project_id, key, name, status, type) values ($1, 'inr', 'INR', 'live', 'personalization') returning id`,
          [p.id],
        )
      ).rows[0]!;
      await db.query(
        `insert into variants (experiment_id, key, name, weight) values ($1, 'control', 'Original', 0), ($1, 'b', 'Personalized', 100)`,
        [e.id],
      );
      return p.public_key;
    });
    const { c } = (
      await db.query<{
        c: { experiments: Array<{ variants: Array<{ key: string; weight: number }> }> };
      }>('select sdk_config_source($1) as c', [key])
    ).rows[0]!;
    expect(c.experiments[0]!.variants.map((v) => [v.key, Number(v.weight)])).toEqual([
      ['b', 100],
      ['control', 0],
    ]);
  });

  it('still rejects unknown types', async () => {
    await expect(db.query(`update experiments set type = 'other'`)).rejects.toThrow();
  });
});
