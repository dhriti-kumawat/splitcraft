import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000a1';
const STRANGER = '00000000-0000-0000-0000-0000000000b2';
const owner = { role: 'authenticated', userId: OWNER } as const;
const stranger = { role: 'authenticated', userId: STRANGER } as const;
const service = { role: 'service_role' } as const;

let db: Db;
let ws: string;
let project: string;
let publicKey: string;

beforeAll(async () => {
  db = await createDb();
  await createUser(db, OWNER);
  await createUser(db, STRANGER);
  await as(db, owner, async () => {
    ws = (await db.query<{ id: string }>(`select id from workspaces`)).rows[0]!.id;
    const p = (
      await db.query<{ id: string; public_key: string }>(
        `insert into projects (workspace_id, name, main_domain, allowed_domains)
         values ($1, 'Trip Demo', 'mytrips.dev', '{localhost:5173}') returning id, public_key`,
        [ws],
      )
    ).rows[0]!;
    project = p.id;
    publicKey = p.public_key;
    await db.query(
      `insert into experiments (project_id, key, name, status) values
       ($1, 'a', 'A', 'live'), ($1, 'b', 'B', 'live'), ($1, 'c', 'C', 'draft')`,
      [project],
    );
  });
  // Visitors: v1 today and 3 days ago, v2 today, v3 40 days ago (outside the window).
  await as(db, service, () =>
    db.query(
      `insert into events (project_id, visitor_id, type, created_at) values
       ($1, 'v1', 'goal', now()), ($1, 'v1', 'goal', now() - interval '3 days'),
       ($1, 'v2', 'goal', now()), ($1, 'v3', 'goal', now() - interval '40 days')`,
      [project],
    ),
  );
});

afterAll(async () => {
  await db.close();
});

describe('project_overview', () => {
  it('counts live tests, unique visitors in 30 days and daily visitors', async () => {
    const [row] = await as(
      db,
      owner,
      async () =>
        (
          await db.query<{
            live_tests: number;
            visitors_30d: number;
            daily_visitors: number[];
          }>('select * from project_overview($1)', [ws])
        ).rows,
    );
    expect(row!.live_tests).toBe(2);
    expect(row!.visitors_30d).toBe(2);
    expect(row!.daily_visitors).toHaveLength(30);
    expect(row!.daily_visitors.at(-1)).toBe(2);
    expect(row!.daily_visitors.at(-4)).toBe(1);
    expect(row!.daily_visitors.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('returns nothing for someone outside the workspace', async () => {
    const rows = await as(
      db,
      stranger,
      async () => (await db.query('select * from project_overview($1)', [ws])).rows,
    );
    expect(rows).toEqual([]);
  });
});

describe('workspace_events_this_month', () => {
  it('counts events since the start of the month', async () => {
    const [{ n }] = (
      await as(db, owner, () =>
        db.query<{ n: number }>('select workspace_events_this_month($1) as n', [ws]),
      )
    ).rows as [{ n: number }];
    // Events from 3 and 40 days ago may fall in an earlier month; today's two never do.
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(3);
  });
});

describe('host_allowed with ports', () => {
  it('matches an allowed domain stored with a port by hostname', async () => {
    const result = await as(db, service, () =>
      db.query<{ n: number }>(`select public.ingest_events($1, 'localhost', $2) as n`, [
        publicKey,
        JSON.stringify([
          { type: 'goal', key: 'x', visitorId: 'v_abcdefgh', url: 'http://localhost:5173/' },
        ]),
      ]),
    );
    expect(result.rows[0]!.n).toBe(1);
  });
});
