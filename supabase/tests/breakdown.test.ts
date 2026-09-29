import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000b9';
const owner = { role: 'authenticated', userId: OWNER } as const;
const service = { role: 'service_role' } as const;

let db: Db;
let project: string;
let experiment: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createDb();
  await createUser(db, OWNER);
  await as(db, owner, async () => {
    const [{ id: ws }] = (await q<{ id: string }>('select id from workspaces')) as [{ id: string }];
    [{ id: project }] = (await q<{ id: string }>(
      `insert into projects (workspace_id, name, main_domain) values ($1, 'P', 'p.dev') returning id`,
      [ws],
    )) as [{ id: string }];
    const [{ id: metric }] = (await q<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source) values ($1, 'Book', 'book', 'click') returning id`,
      [project],
    )) as [{ id: string }];
    [{ id: experiment }] = (await q<{ id: string }>(
      `insert into experiments (project_id, key, name, status, primary_metric_id) values ($1, 'x', 'X', 'live', $2) returning id`,
      [project, metric],
    )) as [{ id: string }];
  });
  const row = (v: string, type: string, extra: string) =>
    `('${project}', '${v}', ${type === 'exposure' ? `'${experiment}'` : 'null'}, '${type}', ${extra})`;
  await as(db, service, () =>
    q(
      `insert into events (project_id, visitor_id, experiment_id, type, variant_key, key, props, created_at) values ${[
        row('v1', 'ping', `null, null, '{"d":"mobile","s":"paid"}', now() - interval '3 days'`),
        row(
          'v1',
          'exposure',
          `'control', null, null, now() - interval '3 days' + interval '1 second'`,
        ),
        row('v1', 'goal', `null, 'book', null, now() - interval '2 days'`),
        row('v2', 'ping', `null, null, '{"d":"mobile","s":"organic"}', now() - interval '3 days'`),
        row('v2', 'exposure', `'b', null, null, now() - interval '3 days'`),
        row('v3', 'ping', `null, null, '{"d":"desktop","s":"paid"}', now() - interval '3 days'`),
        row('v3', 'exposure', `'b', null, null, now() - interval '3 days'`),
        row('v3', 'goal', `null, 'book', null, now() - interval '1 day'`),
        row('v3', 'ping', `null, null, '{"d":"tablet","s":"email"}', now() - interval '1 day'`),
        row('v4', 'exposure', `'b', null, null, now() - interval '3 days'`),
      ].join(',')}`,
    ),
  );
});

afterAll(async () => {
  await db.close();
});

describe('experiment_breakdown', () => {
  const breakdown = (dimension: string) =>
    as(db, owner, () =>
      q('select segment, variant_key, visitors, converters from experiment_breakdown($1, $2)', [
        experiment,
        dimension,
      ]),
    );

  it('groups visitors by the device of their first session', async () => {
    expect(await breakdown('device')).toEqual([
      { segment: 'desktop', variant_key: 'b', visitors: 1, converters: 1 },
      { segment: 'mobile', variant_key: 'b', visitors: 1, converters: 0 },
      { segment: 'mobile', variant_key: 'control', visitors: 1, converters: 1 },
      { segment: 'unknown', variant_key: 'b', visitors: 1, converters: 0 },
    ]);
  });

  it('groups by traffic source, and refuses other dimensions', async () => {
    expect((await breakdown('source')).map((r) => r.segment)).toEqual([
      'organic',
      'paid',
      'paid',
      'unknown',
    ]);
    expect(await breakdown('country; drop table events')).toEqual([]);
  });
});
