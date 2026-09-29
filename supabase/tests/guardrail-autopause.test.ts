import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000e9';
const owner = { role: 'authenticated', userId: OWNER } as const;

let db: Db;
let project: string;
let purchase: string;
let loadTime: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

/** A live experiment where `n` visitors saw each arm and some converted on `purchase`. */
async function experiment(key: string, conversions: { control: number; b: number }, n = 1000) {
  const [{ id }] = (await as(db, owner, () =>
    q<{ id: string }>(
      `insert into experiments (project_id, key, name, status) values ($1, $2, $2, 'live') returning id`,
      [project, key],
    ),
  )) as [{ id: string }];
  await as(db, owner, () =>
    q(
      `insert into variants (experiment_id, key, name) values ($1, 'control', 'Control'), ($1, 'b', 'B')`,
      [id],
    ),
  );
  await as(db, owner, () =>
    q(
      `insert into experiment_metrics (experiment_id, metric_id, role, "limit") values ($1, $2, 'guardrail', '{"maxPct": 2}')`,
      [id, purchase],
    ),
  );
  // Superuser inserts (the events endpoint normally writes these).
  await q(
    `insert into events (project_id, visitor_id, experiment_id, type, variant_key, created_at)
     select $1::uuid, $2 || '-' || arm || '-' || i, $3::uuid, 'exposure', arm, now() - interval '2 days'
     from unnest(array['control', 'b']) as arm, generate_series(1, $4::int) as i`,
    [project, key, id, n],
  );
  await q(
    `insert into events (project_id, visitor_id, type, key, created_at)
     select $1::uuid, $2 || '-control-' || i, 'goal', 'purchase', now() - interval '1 day' from generate_series(1, $3::int) as i
     union all
     select $1::uuid, $2 || '-b-' || i, 'goal', 'purchase', now() - interval '1 day' from generate_series(1, $4::int) as i`,
    [project, key, conversions.control, conversions.b],
  );
  return id;
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
    [{ id: purchase }] = (await q<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source) values ($1, 'Purchase', 'purchase', 'custom_js') returning id`,
      [project],
    )) as [{ id: string }];
    [{ id: loadTime }] = (await q<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source, measure, measure_config)
       values ($1, 'Load', 'load', 'custom_js', 'value_per_conversion', '{"direction": "decrease"}') returning id`,
      [project],
    )) as [{ id: string }];
  });
});

afterAll(async () => {
  await db.close();
});

describe('guardrail_status', () => {
  it('matches the results page: relative change and its 95% range', async () => {
    const id = await experiment('drop', { control: 100, b: 60 });
    const [row] = await as(db, owner, () =>
      q<{ uplift: number; uplift_low: number; uplift_high: number; crossed: boolean }>(
        'select uplift, uplift_low, uplift_high, max_pct, crossed from guardrail_status($1)',
        [id],
      ),
    );
    // p1 = 10%, p2 = 6%: −40%, range (−0.04 ± 1.96·√(.09/1000 + .0564/1000)) / .1
    expect(row!.uplift).toBeCloseTo(-0.4, 6);
    expect(row!.uplift_low).toBeCloseTo(-0.6372, 3);
    expect(row!.uplift_high).toBeCloseTo(-0.1628, 3);
    expect(row).toMatchObject({ max_pct: 2, crossed: true });
  });

  it("isn't crossed while the range still reaches the limit", async () => {
    const id = await experiment('noise', { control: 100, b: 95 });
    const [row] = await as(db, owner, () =>
      q<{ crossed: boolean }>('select crossed from guardrail_status($1)', [id]),
    );
    expect(row!.crossed).toBe(false);
  });

  it('handles lower-is-better value metrics', async () => {
    const id = await experiment('slow', { control: 0, b: 0 }, 10);
    await as(db, owner, () =>
      q(
        `insert into experiment_metrics (experiment_id, metric_id, role, "limit") values ($1, $2, 'guardrail', '{"maxPct": 5}')`,
        [id, loadTime],
      ),
    );
    await q(
      `insert into events (project_id, visitor_id, type, key, value, created_at)
       select $1::uuid, 'slow-' || arm || '-' || i, 'goal', 'load', case arm when 'control' then 2 + (i % 2) * 0.1 else 3 + (i % 2) * 0.1 end, now() - interval '1 day'
       from unnest(array['control', 'b']) as arm, generate_series(1, 10) as i`,
      [project],
    );
    const rows = await as(db, owner, () =>
      q<{ metric_id: string; crossed: boolean }>(
        'select metric_id, crossed from guardrail_status($1)',
        [id],
      ),
    );
    expect(rows.find((r) => r.metric_id === loadTime)!.crossed).toBe(true);
  });
});

describe('auto_pause_guardrails', () => {
  it('pauses live experiments with a crossed guardrail and records why, once', async () => {
    const bad = await experiment('bad', { control: 100, b: 50 });
    const fine = await experiment('fine', { control: 100, b: 101 });
    const [{ n }] = (await q<{ n: number }>('select public.auto_pause_guardrails() as n')) as [
      { n: number },
    ];
    expect(n).toBeGreaterThanOrEqual(1);
    const [badRow] = await q<{ status: string; auto_paused: Record<string, unknown> }>(
      'select status, auto_paused from experiments where id = $1',
      [bad],
    );
    expect(badRow).toMatchObject({
      status: 'paused',
      auto_paused: { metricId: purchase, variantKey: 'b', maxPct: 2 },
    });
    const [fineRow] = await q('select status, auto_paused from experiments where id = $1', [fine]);
    expect(fineRow).toEqual({ status: 'live', auto_paused: null });

    // Someone resumes it: it stays live on the next run.
    await as(db, owner, () => q(`update experiments set status = 'live' where id = $1`, [bad]));
    await q('select public.auto_pause_guardrails()');
    const [again] = await q('select status from experiments where id = $1', [bad]);
    expect(again).toEqual({ status: 'live' });
  });

  it("can't be called by users", async () => {
    await expect(as(db, owner, () => q('select public.auto_pause_guardrails()'))).rejects.toThrow(
      /permission denied/,
    );
  });
});
