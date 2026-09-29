import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000b7';
const OUTSIDER = '00000000-0000-0000-0000-0000000000b8';
const owner = { role: 'authenticated', userId: OWNER } as const;
const outsider = { role: 'authenticated', userId: OUTSIDER } as const;
const service = { role: 'service_role' } as const;

let db: Db;
let project: string;
let key: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createDb();
  for (const id of [OWNER, OUTSIDER]) await createUser(db, id);
  await as(db, owner, async () => {
    const [{ id: ws }] = (await q<{ id: string }>('select id from workspaces')) as [{ id: string }];
    [{ id: project, public_key: key }] = (await q<{ id: string; public_key: string }>(
      `insert into projects (workspace_id, name, main_domain) values ($1, 'P', 'p.dev') returning id, public_key`,
      [ws],
    )) as [{ id: string; public_key: string }];
  });
  const ping = (v: string, d: string) => ({
    type: 'ping',
    visitorId: `visitor_${v}`,
    url: `https://p.dev/${v}`,
    props: { d, w: 390, s: 'direct', n: 1 },
  });
  const [{ n }] = (await as(db, service, () =>
    q<{ n: number }>(`select public.ingest_events($1, 'p.dev', $2) as n`, [
      key,
      JSON.stringify([
        ping('aaaaaaaa', 'mobile'),
        ping('bbbbbbbb', 'desktop'),
        ping('cccccccc', 'mobile'),
      ]),
    ]),
  )) as [{ n: number }];
  expect(n).toBe(3);
  await as(db, service, () =>
    q(
      `update events set created_at = now() - interval '4 days' where visitor_id = 'visitor_aaaaaaaa'`,
    ),
  );
});

afterAll(async () => {
  await db.close();
});

describe('project_session_sample', () => {
  it('returns sampled sessions with totals', async () => {
    const rows = await as(db, owner, () =>
      q<{ url: string; props: { d: string }; sessions: number; days: number }>(
        'select * from project_session_sample($1, 10) order by url',
        [project],
      ),
    );
    expect(rows.map((r) => [r.url, r.props.d])).toEqual([
      ['https://p.dev/aaaaaaaa', 'mobile'],
      ['https://p.dev/bbbbbbbb', 'desktop'],
      ['https://p.dev/cccccccc', 'mobile'],
    ]);
    expect(rows[0]).toMatchObject({ sessions: 3, days: 4 });
  });

  it('respects the sample size', async () => {
    expect(
      await as(db, owner, () => q('select * from project_session_sample($1, 2)', [project])),
    ).toHaveLength(2);
  });

  it('shows nothing to someone outside the workspace', async () => {
    expect(
      await as(db, outsider, () => q('select * from project_session_sample($1)', [project])),
    ).toEqual([]);
  });
});
