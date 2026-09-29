import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000d1';
const owner = { role: 'authenticated', userId: OWNER } as const;
const service = { role: 'service_role' } as const;

let db: Db;
let project: string;
let experiment: string;
let book: string;
let revenue: string;

type Row = {
  metric_id: string;
  variant_key: string;
  visitors: number;
  converters: number;
  events: number;
  events_sumsq: number;
  value_sum: number;
  value_sumsq: number;
};

async function q<T>(sql: string, params: unknown[] = []): Promise<T[]> {
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
    [{ id: book }] = (await q<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source, measure_config)
       values ($1, 'Book', 'book_click', 'click', '{"windowDays": 7}') returning id`,
      [project],
    )) as [{ id: string }];
    [{ id: revenue }] = (await q<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source, measure)
       values ($1, 'Revenue', 'purchase', 'custom_js', 'sum') returning id`,
      [project],
    )) as [{ id: string }];
    [{ id: experiment }] = (await q<{ id: string }>(
      `insert into experiments (project_id, key, name, status, primary_metric_id)
       values ($1, 'trust', 'Trust', 'live', $2) returning id`,
      [project, book],
    )) as [{ id: string }];
    await q(
      `insert into experiment_metrics (experiment_id, metric_id, role) values ($1, $2, 'secondary')`,
      [experiment, revenue],
    );
  });

  const exposure = (v: string, variant: string, ago: string) =>
    `('${project}', '${v}', '${experiment}', 'exposure', '${variant}', null, null, now() - interval '${ago}')`;
  const goal = (v: string, key: string, value: number | null, ago: string) =>
    `('${project}', '${v}', null, 'goal', null, '${key}', ${value ?? 'null'}, now() - interval '${ago}')`;
  await as(db, service, () =>
    q(
      `insert into events (project_id, visitor_id, experiment_id, type, variant_key, key, value, created_at) values ${[
        exposure('v1', 'control', '10 days'),
        goal('v1', 'book_click', null, '9 days'), // inside 7 days of exposure
        goal('v1', 'book_click', null, '1 day'), // 9 days after exposure: outside window
        exposure('v2', 'control', '3 days'),
        exposure('v3', 'b', '3 days'),
        goal('v3', 'book_click', null, '2 days'),
        goal('v3', 'book_click', null, '1 day'),
        goal('v3', 'purchase', 100, '1 day'),
        goal('v3', 'purchase', 50, '1 day'),
        exposure('v4', 'b', '2 days'),
        goal('v4', 'purchase', 20, '1 day'),
      ].join(',')}`,
    ),
  );
});

afterAll(async () => {
  await db.close();
});

describe('experiment_results', () => {
  it('counts converters, events and capped values per variant and metric', async () => {
    const rows = await as(db, owner, () =>
      q<Row>(
        'select metric_id, variant_key, visitors, converters, events, events_sumsq, value_sum, value_sumsq from experiment_results($1) order by metric_id = $2 desc, variant_key',
        [experiment, book],
      ),
    );
    const pick = (metric: string, variant: string) =>
      rows.find((r) => r.metric_id === metric && r.variant_key === variant)!;

    expect(pick(book, 'control')).toMatchObject({ visitors: 2, converters: 1, events: 1 });
    expect(pick(book, 'b')).toMatchObject({
      visitors: 2,
      converters: 1,
      events: 2,
      events_sumsq: 4,
    });

    // v3 bought 150, v4 20. The 99th-percentile cap across buyers (p99 of 150 and 20 ≈ 148.7)
    // trims v3 slightly.
    const b = pick(revenue, 'b');
    expect(b).toMatchObject({ visitors: 2, converters: 2 });
    expect(b.value_sum).toBeCloseTo(20 + 148.7, 1);
    expect(pick(revenue, 'control')).toMatchObject({ visitors: 2, converters: 0, value_sum: 0 });
  });
});

describe('experiment_daily', () => {
  it('groups first exposures by day with primary-goal converters', async () => {
    const rows = await as(db, owner, () =>
      q<{ variant_key: string; visitors: number; converters: number }>(
        'select variant_key, visitors, converters from experiment_daily($1)',
        [experiment],
      ),
    );
    expect(rows).toEqual([
      { variant_key: 'control', visitors: 1, converters: 1 },
      { variant_key: 'b', visitors: 1, converters: 1 },
      { variant_key: 'control', visitors: 1, converters: 0 },
      { variant_key: 'b', visitors: 1, converters: 0 },
    ]);
  });
});
