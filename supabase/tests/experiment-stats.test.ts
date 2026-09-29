import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000c1';
const owner = { role: 'authenticated', userId: OWNER } as const;
const service = { role: 'service_role' } as const;

let db: Db;
let project: string;
let experiment: string;

type Row = { variant_key: string; visitors: number; conversions: number; visitors_7d: number };

async function stats(): Promise<Row[]> {
  return as(
    db,
    owner,
    async () =>
      (
        await db.query<Row>(
          'select variant_key, visitors, conversions, visitors_7d from experiment_stats($1) order by variant_key',
          [project],
        )
      ).rows,
  );
}

beforeAll(async () => {
  db = await createDb();
  await createUser(db, OWNER);
  await as(db, owner, async () => {
    const ws = (await db.query<{ id: string }>('select id from workspaces')).rows[0]!.id;
    project = (
      await db.query<{ id: string }>(
        `insert into projects (workspace_id, name, main_domain) values ($1, 'P', 'p.dev') returning id`,
        [ws],
      )
    ).rows[0]!.id;
    const metric = (
      await db.query<{ id: string }>(
        `insert into metrics (project_id, name, event_key, source) values ($1, 'Book', 'book_click', 'click') returning id`,
        [project],
      )
    ).rows[0]!.id;
    experiment = (
      await db.query<{ id: string }>(
        `insert into experiments (project_id, key, name, status, primary_metric_id)
         values ($1, 'trust', 'Trust', 'live', $2) returning id`,
        [project, metric],
      )
    ).rows[0]!.id;
  });

  const ev = (visitor: string, type: string, extra: string) =>
    `('${project}', '${visitor}', ${type === 'exposure' ? `'${experiment}'` : 'null'}, '${type}', ${extra})`;
  await as(db, service, () =>
    db.query(
      `insert into events (project_id, visitor_id, experiment_id, type, variant_key, key, created_at) values
       ${[
         // v1: control, converts after exposure.
         ev('v1', 'exposure', `'control', null, now() - interval '2 days'`),
         ev('v1', 'goal', `null, 'book_click', now() - interval '1 day'`),
         // v2: b, converts twice (counted once).
         ev('v2', 'exposure', `'b', null, now() - interval '3 days'`),
         ev('v2', 'goal', `null, 'book_click', now() - interval '2 days'`),
         ev('v2', 'goal', `null, 'book_click', now()`),
         // v3: b, only converted before the exposure (not counted).
         ev('v3', 'goal', `null, 'book_click', now() - interval '5 days'`),
         ev('v3', 'exposure', `'b', null, now() - interval '4 days'`),
         // v4: control first, later exposed to b too: stays control. Old exposure.
         ev('v4', 'exposure', `'control', null, now() - interval '20 days'`),
         ev('v4', 'exposure', `'b', null, now() - interval '1 day'`),
         // v5: b, other goal only.
         ev('v5', 'exposure', `'b', null, now()`),
         ev('v5', 'goal', `null, 'newsletter', now()`),
       ].join(',\n')}`,
    ),
  );
});

afterAll(async () => {
  await db.close();
});

describe('experiment_stats', () => {
  it('counts visitors by first exposure and conversions after exposure', async () => {
    expect(await stats()).toEqual([
      { variant_key: 'b', visitors: 3, conversions: 1, visitors_7d: 3 },
      { variant_key: 'control', visitors: 2, conversions: 1, visitors_7d: 1 },
    ]);
  });
});
