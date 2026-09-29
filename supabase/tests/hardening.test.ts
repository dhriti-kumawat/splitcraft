import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000e1';
const ADMIN = '00000000-0000-0000-0000-0000000000e2';
const MEMBER = '00000000-0000-0000-0000-0000000000e3';
const owner = { role: 'authenticated', userId: OWNER } as const;
const admin = { role: 'authenticated', userId: ADMIN } as const;
const member = { role: 'authenticated', userId: MEMBER } as const;
const service = { role: 'service_role' } as const;

let db: Db;
let ws: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function newProject(name: string): Promise<{ id: string; public_key: string }> {
  const [p] = await as(db, owner, () =>
    q<{ id: string; public_key: string }>(
      `insert into projects (workspace_id, name, main_domain) values ($1, $2, 'p.dev') returning id, public_key`,
      [ws, name],
    ),
  );
  return p!;
}

const goal = (visitor: string) => ({
  type: 'goal',
  key: 'k',
  visitorId: visitor,
  url: 'https://p.dev/',
});

async function ingest(key: string, events: unknown[]): Promise<number> {
  const [r] = await as(db, service, () =>
    q<{ n: number }>(`select public.ingest_events($1, 'p.dev', $2) as n`, [
      key,
      JSON.stringify(events),
    ]),
  );
  return r!.n;
}

beforeAll(async () => {
  db = await createDb();
  for (const id of [OWNER, ADMIN, MEMBER]) await createUser(db, id);
  [{ id: ws }] = (await as(db, owner, () =>
    q<{ id: string }>(`insert into workspaces (name) values ('Team') returning id`),
  )) as [{ id: string }];
  await as(db, owner, () =>
    q(
      `insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member')`,
      [ws, ADMIN, MEMBER],
    ),
  );
});

afterAll(async () => {
  await db.close();
});

describe('deleting projects', () => {
  it('is refused for members and allowed for admins and owners', async () => {
    const p1 = await newProject('One');
    const p2 = await newProject('Two');
    await as(db, member, () => q('delete from projects where id = $1', [p1.id]));
    expect(
      await as(db, member, () => q('select id from projects where id = $1', [p1.id])),
    ).toHaveLength(1);
    await as(db, admin, () => q('delete from projects where id = $1', [p1.id]));
    await as(db, owner, () => q('delete from projects where id = $1', [p2.id]));
    expect(
      await as(db, owner, () => q('select id from projects where id in ($1, $2)', [p1.id, p2.id])),
    ).toEqual([]);
  });

  it('still lets members create and edit projects', async () => {
    const [p] = await as(db, member, () =>
      q<{ id: string }>(
        `insert into projects (workspace_id, name, main_domain) values ($1, 'M', 'm.dev') returning id`,
        [ws],
      ),
    );
    await as(db, member, () => q(`update projects set name = 'M2' where id = $1`, [p!.id]));
    expect(
      await as(db, member, () => q('select name from projects where id = $1', [p!.id])),
    ).toEqual([{ name: 'M2' }]);
  });
});

describe('rate limits', () => {
  it('refuses a visitor sending more than 300 events a minute', async () => {
    const p = await newProject('Busy visitor');
    const batch = Array.from({ length: 50 }, () => goal('v_ratelimit1'));
    for (let i = 0; i < 6; i++) expect(await ingest(p.public_key, batch)).toBe(50);
    expect(await ingest(p.public_key, batch)).toBe(-4);
    // Another visitor on the same project is fine.
    expect(await ingest(p.public_key, [goal('v_someoneelse')])).toBe(1);
  });

  it('refuses a project sending more than 3,000 events a minute', async () => {
    const p = await newProject('Busy project');
    for (let i = 0; i < 60; i++) {
      const batch = Array.from({ length: 50 }, (_, j) => goal(`v_p${i}_${j}_xxxx`));
      expect(await ingest(p.public_key, batch)).toBe(50);
    }
    expect(await ingest(p.public_key, [goal('v_onemore_xx')])).toBe(-4);
  });

  it('opens a new window after a minute', async () => {
    await as(db, service, () =>
      q(`update rate_limits set window_start = now() - interval '2 minutes'`),
    );
    const [p] = await as(db, owner, () =>
      q<{ public_key: string }>(`select public_key from projects where name = 'Busy project'`),
    );
    expect(await ingest(p!.public_key, [goal('v_newwindow_x')])).toBe(1);
  });
});

describe('monthly event limit', () => {
  it('stops ingesting and serves no experiments once the free plan’s 100,000 events are used', async () => {
    const p = await newProject('Big');
    await as(db, owner, () =>
      q(
        `insert into experiments (project_id, key, name, status) values ($1, 'live-one', 'Live', 'live')`,
        [p.id],
      ),
    );
    const configExperiments = async () => {
      const [r] = await as(db, service, () =>
        q<{ c: { experiments: unknown[] } }>('select public.sdk_config_source($1) as c', [
          p.public_key,
        ]),
      );
      return r!.c.experiments;
    };
    expect(await configExperiments()).toHaveLength(1);

    // Fill the month up to just under the limit (events already sent by the tests above count too).
    await as(db, service, () =>
      q(
        `insert into events (project_id, visitor_id, type, key)
         select $1, 'v_bulk', 'goal', 'k'
         from generate_series(1, 100000 - public.workspace_month_events($2) - 1)`,
        [p.id, ws],
      ),
    );
    expect(await ingest(p.public_key, [goal('v_last_one_x')])).toBe(1);
    expect(await ingest(p.public_key, [goal('v_too_many_x')])).toBe(-3);
    expect(await configExperiments()).toEqual([]);
  }, 60_000);
});

describe('experiment_stats counting window', () => {
  it('ignores conversions after the metric’s window, like the results page', async () => {
    const p = await newProject('Window');
    const [{ id: metric }] = (await as(db, owner, () =>
      q<{ id: string }>(
        `insert into metrics (project_id, name, event_key, source, measure_config)
         values ($1, 'Book', 'book', 'click', '{"windowDays": 7}') returning id`,
        [p.id],
      ),
    )) as [{ id: string }];
    const [{ id: exp }] = (await as(db, owner, () =>
      q<{ id: string }>(
        `insert into experiments (project_id, key, name, status, primary_metric_id) values ($1, 'w', 'W', 'live', $2) returning id`,
        [p.id, metric],
      ),
    )) as [{ id: string }];
    await as(db, service, () =>
      q(
        `insert into events (project_id, visitor_id, experiment_id, type, variant_key, key, created_at) values
         ($1, 'a', $2, 'exposure', 'b', null, now() - interval '20 days'),
         ($1, 'a', null, 'goal', null, 'book', now() - interval '1 day'),
         ($1, 'b', $2, 'exposure', 'b', null, now() - interval '3 days'),
         ($1, 'b', null, 'goal', null, 'book', now() - interval '2 days')`,
        [p.id, exp],
      ),
    );
    const rows = await as(db, owner, () =>
      q<{ visitors: number; conversions: number }>(
        'select visitors, conversions from experiment_stats($1) where experiment_id = $2',
        [p.id, exp],
      ),
    );
    expect(rows).toEqual([{ visitors: 2, conversions: 1 }]);
  });
});
