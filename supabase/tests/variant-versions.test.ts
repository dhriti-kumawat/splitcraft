import { as, createDb, type Db } from './db';

const ANA = '00000000-0000-0000-0000-0000000ee001';
const BEN = '00000000-0000-0000-0000-0000000ee002';
const ana = { role: 'authenticated', userId: ANA } as const;
const ben = { role: 'authenticated', userId: BEN } as const;

let db: Db;
let variant: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createDb();
  await q(`insert into auth.users (id) values ($1), ($2)`, [ANA, BEN]);
  await as(db, ana, async () => {
    const [ws] = await q<{ id: string }>(`insert into workspaces (name) values ('A') returning id`);
    const [p] = await q<{ id: string }>(
      `insert into projects (workspace_id, name, main_domain) values ($1, 'P', 'p.dev') returning id`,
      [ws!.id],
    );
    const [e] = await q<{ id: string }>(
      `insert into experiments (project_id, key, name) values ($1, 'x', 'X') returning id`,
      [p!.id],
    );
    [{ id: variant }] = (await q<{ id: string }>(
      `insert into variants (experiment_id, key, name, js) values ($1, 'b', 'B', 'v1') returning id`,
      [e!.id],
    )) as [{ id: string }];
    // Saving new code keeps the old code as a version.
    await q(`update variants set js = 'v2' where id = $1`, [variant]);
  });
});

afterAll(async () => {
  await db.close();
});

describe('deleting variant versions', () => {
  it('lets members delete a version, and nobody outside the workspace', async () => {
    const [v] = await as(db, ana, () =>
      q<{ id: string }>('select id from variant_versions where variant_id = $1', [variant]),
    );
    expect(v).toBeDefined();
    // Ben isn't in the workspace: nothing to see, nothing deleted.
    await as(db, ben, () => q('delete from variant_versions where id = $1', [v!.id]));
    expect(await q('select 1 from variant_versions where id = $1', [v!.id])).toHaveLength(1);
    await as(db, ana, () => q('delete from variant_versions where id = $1', [v!.id]));
    expect(await q('select 1 from variant_versions where id = $1', [v!.id])).toHaveLength(0);
  });

  it('still lets nobody write versions directly', async () => {
    await expect(
      as(db, ana, () =>
        q(`insert into variant_versions (variant_id, js, css) values ($1, 'x', '')`, [variant]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
