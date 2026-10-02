import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000f3';
const owner = { role: 'authenticated', userId: OWNER } as const;
let db: Db;

beforeAll(async () => {
  db = await createDb();
  await createUser(db, OWNER);
});
afterAll(async () => {
  await db.close();
});

describe('exclusion groups in the SDK config', () => {
  it("gives each live test in a group its place and the group's size", async () => {
    const { rows } = await as(db, owner, async () => {
      const ws = (await db.query<{ id: string }>('select id from workspaces')).rows[0]!.id;
      const p = (
        await db.query<{ id: string; public_key: string }>(
          `insert into projects (workspace_id, name, main_domain) values ($1, 'P', 'p.dev') returning id, public_key`,
          [ws],
        )
      ).rows[0]!;
      await db.query(
        `insert into experiments (project_id, key, name, status, exclusion_group) values
           ($1, 'b-test', 'B', 'live', 'checkout'),
           ($1, 'a-test', 'A', 'live', 'checkout'),
           ($1, 'c-draft', 'C', 'draft', 'checkout'),
           ($1, 'solo', 'S', 'live', null)`,
        [p.id],
      );
      return { rows: [p] };
    });
    const config = (
      await db.query<{ c: { experiments: Array<{ key: string; group: unknown }> } }>(
        'select sdk_config_source($1) as c',
        [rows[0]!.public_key],
      )
    ).rows[0]!.c;
    expect(Object.fromEntries(config.experiments.map((e) => [e.key, e.group]))).toEqual({
      'a-test': ['checkout', 0, 2],
      'b-test': ['checkout', 1, 2],
      solo: null,
    });
  });

  it('limits the group name length', async () => {
    await expect(
      db.query(`update experiments set exclusion_group = '' where key = 'solo'`),
    ).rejects.toThrow();
  });
});
