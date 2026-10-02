import { toSdkConfig } from '../functions/_shared/config.ts';
import type { ConfigSource } from '../functions/_shared/types.ts';
import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000f5';
const STRANGER = '00000000-0000-0000-0000-0000000000f6';
const owner = { role: 'authenticated', userId: OWNER } as const;
let db: Db;
let project: { id: string; public_key: string };
let segment: string;

beforeAll(async () => {
  db = await createDb();
  await createUser(db, OWNER);
  await createUser(db, STRANGER);
  await as(db, owner, async () => {
    const ws = (await db.query<{ id: string }>('select id from workspaces')).rows[0]!.id;
    project = (
      await db.query<{ id: string; public_key: string }>(
        `insert into projects (workspace_id, name, main_domain) values ($1, 'P', 'p.dev') returning id, public_key`,
        [ws],
      )
    ).rows[0]!;
    segment = (
      await db.query<{ id: string }>(
        `insert into segments (project_id, name, rules) values ($1, 'Mobile', '{"mode":"all","items":[]}') returning id`,
        [project.id],
      )
    ).rows[0]!.id;
    await db.query(
      `insert into feature_flags (project_id, key, name, enabled, rollout_pct, segment_ids) values
         ($1, 'new-search', 'New search', true, 25, '{}'),
         ($1, 'mobile-nav', 'Mobile nav', true, 100, array[$2::uuid]),
         ($1, 'off-flag', 'Off', false, 100, '{}')`,
      [project.id, segment],
    );
  });
});
afterAll(async () => {
  await db.close();
});

describe('feature flags', () => {
  it('are private to the project members', async () => {
    const own = await as(db, owner, () => db.query('select key from feature_flags'));
    expect(own.rows).toHaveLength(3);
    const other = await as(db, { role: 'authenticated', userId: STRANGER }, () =>
      db.query('select key from feature_flags'),
    );
    expect(other.rows).toEqual([]);
  });

  it('check keys and the rollout share', async () => {
    for (const sql of [
      `insert into feature_flags (project_id, key, name) values ($1, 'bad key', 'x')`,
      `insert into feature_flags (project_id, key, name, rollout_pct) values ($1, 'k', 'x', 101)`,
      `insert into feature_flags (project_id, key, name) values ($1, 'new-search', 'dup')`,
    ])
      await expect(db.query(sql, [project.id])).rejects.toThrow();
  });

  it('send only enabled flags to the SDK, as experiments with one on variant', async () => {
    const source = (
      await db.query<{ c: ConfigSource }>('select sdk_config_source($1) as c', [project.public_key])
    ).rows[0]!.c;
    expect(source.flags!.map((f) => f.key)).toEqual(['mobile-nav', 'new-search']);
    const config = toSdkConfig(source, 'prj', 'https://e.test');
    expect(config.experiments).toEqual([
      expect.objectContaining({
        key: 'mobile-nav',
        trafficPct: 100,
        flag: true,
        variants: [{ key: 'on', name: 'On', weight: 1 }],
        targeting: { who: [{ mode: 'any', items: [{ mode: 'all', items: [] }] }] },
      }),
      expect.objectContaining({ key: 'new-search', trafficPct: 25, targeting: {} }),
    ]);
  });
});
