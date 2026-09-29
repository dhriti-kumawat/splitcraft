import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000f7';
const owner = { role: 'authenticated', userId: OWNER } as const;
const service = { role: 'service_role' } as const;

let db: Db;
let project: string;
let experiment: string;
let ctr: string;
let timing: string;

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
    [{ id: ctr }] = (await q<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source, measure)
       values ($1, 'Banner CTR', 'banner', 'click', 'ctr') returning id`,
      [project],
    )) as [{ id: string }];
    [{ id: timing }] = (await q<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source, measure)
       values ($1, 'Time to book', 'book', 'click', 'time_to_click') returning id`,
      [project],
    )) as [{ id: string }];
    [{ id: experiment }] = (await q<{ id: string }>(
      `insert into experiments (project_id, key, name, status, primary_metric_id)
       values ($1, 'hero', 'Hero', 'live', $2) returning id`,
      [project, ctr],
    )) as [{ id: string }];
    await q(
      `insert into experiment_metrics (experiment_id, metric_id, role) values ($1, $2, 'secondary')`,
      [experiment, timing],
    );
  });

  const exposure = (v: string, variant: string) =>
    `('${project}', '${v}', '${experiment}', 'exposure', '${variant}', null, null, now() - interval '3 days')`;
  const goal = (v: string, key: string, value: number | null) =>
    `('${project}', '${v}', null, 'goal', null, '${key}', ${value ?? 'null'}, now() - interval '1 day')`;
  await as(db, service, () =>
    q(
      `insert into events (project_id, visitor_id, experiment_id, type, variant_key, key, value, created_at) values ${[
        exposure('v1', 'control'),
        goal('v1', 'banner:view', null),
        goal('v1', 'banner:view', null), // a second page: still one viewer
        goal('v1', 'banner', null),
        exposure('v2', 'control'),
        goal('v2', 'banner:view', null), // saw it, didn't click
        exposure('v3', 'control'), // never saw it: not in the denominator
        goal('v1', 'book', 4.5),
        goal('v1', 'book', 2), // quickest first click counts
        goal('v1', 'book', null), // later clicks carry no time
        goal('v2', 'book', 8),
      ].join(',')}`,
    ),
  );
});

afterAll(async () => {
  await db.close();
});

describe('click measures', () => {
  const results = () =>
    as(db, owner, () =>
      q<{
        metric_id: string;
        visitors: number;
        converters: number;
        value_sum: number;
        viewers: number;
      }>(
        `select metric_id, visitors, converters, value_sum, viewers
         from experiment_results($1) where variant_key = 'control'`,
        [experiment],
      ),
    );

  it('counts visitors who saw the element for click-through rate', async () => {
    const row = (await results()).find((r) => r.metric_id === ctr);
    expect(row).toEqual({ metric_id: ctr, visitors: 3, converters: 1, value_sum: 0, viewers: 2 });
  });

  it("uses each visitor's quickest first click for time to first click", async () => {
    const row = (await results()).find((r) => r.metric_id === timing);
    // 2 s and 8 s; values are capped at the 99th percentile, so 8 s counts as 7.94 s.
    expect(row).toMatchObject({ converters: 2, viewers: 0 });
    expect(row!.value_sum).toBeCloseTo(9.94, 2);
  });

  it('accepts the new measures and still rejects unknown ones', async () => {
    await expect(
      as(db, owner, () =>
        q(
          `insert into metrics (project_id, name, event_key, source, measure) values ($1, 'X', 'x', 'click', 'median')`,
          [project],
        ),
      ),
    ).rejects.toThrow(/metrics_measure_check/);
  });
});
